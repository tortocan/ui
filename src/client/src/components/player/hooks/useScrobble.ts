import { useCallback, useEffect, useRef } from "react"
import type { ScrobbleAction, ScrobbleMediaType } from "@omss/sdk"
import { useOmss } from "@/hooks/use-omss"
import { readActiveProfileId } from "@/hooks/use-localstorage.ts"
import type { UnifiedMedia } from "../types/media.types"

// How often, while playing, we checkpoint progress to the backend.
const PROGRESS_INTERVAL_MS = 5_000
// Ignore a near-zero resume point (nothing to resume) and a near-finished one (treat as done).
const RESUME_FLOOR = 0.02
const RESUME_CAP = 0.95

/** Map a player media item to the backend's scrobble reference (tv → episode). */
function scrobbleRef(media: UnifiedMedia): {
    mediaType: ScrobbleMediaType
    tmdbId: number
    season?: number
    episode?: number
} {
    return {
        mediaType: media.type === "movie" ? "movie" : "episode",
        tmdbId: Number(media.id),
        season: media.seasonNumber,
        episode: media.episodeNumber,
    }
}

function refKey(r: ReturnType<typeof scrobbleRef>): string {
    return `${r.mediaType}:${r.tmdbId}:${r.season ?? 0}:${r.episode ?? 0}`
}

/**
 * Drives gatearr's local Trakt-style scrobbler (the OMSS `/scrobble` extension) from the <video>
 * element, giving the player resume / "continue watching":
 *  - On load (once duration is known), looks up the stored resume point for this title and seeks to it.
 *  - Reports start/pause/stop on the matching video events, plus a periodic progress checkpoint while
 *    playing.
 *  - Critically, checkpoints the current position on `pagehide` / `visibilitychange→hidden` with a
 *    `keepalive` request so the leave point survives a browser reload, a tab close, or an SPA
 *    navigation — none of which reliably run React's unmount cleanup, which is why an early leave used
 *    to lose the position entirely.
 *
 * All calls are best-effort and gated on a reachable OMSS backend (`valid`); a stateless backend that
 * doesn't implement /scrobble simply 404s and nothing breaks.
 */
export function useScrobble(videoRef: React.RefObject<HTMLVideoElement | null>, media: UnifiedMedia | null) {
    const { client, baseUrl, valid } = useOmss()
    const lastSentRef = useRef(0)
    // The key whose resume has been RESOLVED (looked up + seeked, or determined none). Scrobbling is
    // gated on this: until a title's resume is resolved we post nothing, so the initial "start" can't
    // race the async resume lookup and overwrite the saved position with ~0 (which would then make the
    // next open start from the beginning). Doubles as the "already handled this title" guard.
    const resolvedKeyRef = useRef<string | null>(null)

    // Current progress (0–100) for this title, or null when we can't compute it yet.
    const snapshot = useCallback(() => {
        const video = videoRef.current
        if (!video || !media || !valid) return null
        const ref = scrobbleRef(media)
        if (!Number.isFinite(ref.tmdbId) || ref.tmdbId <= 0) return null
        const duration = video.duration
        if (!duration || !Number.isFinite(duration)) return null
        const progress = Math.max(0, Math.min(100, (video.currentTime / duration) * 100))
        return { ref, progress, title: media.title }
    }, [media, valid, videoRef])

    const post = useCallback(
        (action: ScrobbleAction) => {
            const snap = snapshot()
            if (!snap) return
            if (resolvedKeyRef.current !== refKey(snap.ref)) return // wait until resume is resolved
            void client.scrobble({ ...snap.ref, progress: snap.progress, action, title: snap.title }).catch(() => {})
        },
        [client, snapshot]
    )

    // A checkpoint that must survive the page tearing down (reload / tab close / nav / backgrounding).
    // Uses navigator.sendBeacon with a text/plain body: text/plain is a CORS-"simple" content type, so
    // it needs NO preflight — a preflighted request is routinely dropped during page unload, which was
    // silently losing the leave-time position. Falls back to a keepalive fetch (also text/plain) if
    // sendBeacon is unavailable or refuses. gatearr parses the JSON regardless of Content-Type.
    const checkpointBeacon = useCallback(
        (action: ScrobbleAction) => {
            const snap = snapshot()
            if (!snap || !baseUrl) return
            if (resolvedKeyRef.current !== refKey(snap.ref)) return // wait until resume is resolved
            // sendBeacon can't set an X-Profile-Id header, so carry the active profile as ?profile=
            // (gatearr's POST /scrobble accepts it; omitted when no profile is chosen → default profile).
            const pid = readActiveProfileId()
            const url = `${baseUrl.replace(/\/+$/, "")}/scrobble${pid != null ? `?profile=${pid}` : ""}`
            const payload = JSON.stringify({ ...snap.ref, progress: snap.progress, action, title: snap.title })
            try {
                const blob = new Blob([payload], { type: "text/plain" })
                if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return
                void fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: payload, keepalive: true, mode: "cors" }).catch(() => {})
            } catch {
                // ignore
            }
        },
        [snapshot, baseUrl]
    )

    // Resolve the resume point for this title BEFORE any scrobble is allowed to post: look up the saved
    // position once, seek to it once metadata (duration) is known, then mark the key resolved (which
    // unblocks posting). Resume is purely by stored percent — a title watched one or more times still
    // resumes to wherever it was left (RESUME_FLOOR/CAP is the only gate).
    useEffect(() => {
        const video = videoRef.current
        if (!video || !media || !valid) return
        const ref = scrobbleRef(media)
        if (!Number.isFinite(ref.tmdbId) || ref.tmdbId <= 0) return
        const key = refKey(ref)
        if (resolvedKeyRef.current === key) return // already resolved this title

        let cancelled = false
        let fetched = false
        let resumeFrac: number | null = null

        // Seek (if there's a resume point and duration is known) and then mark resolved → posting opens.
        const settle = () => {
            if (cancelled || !fetched) return
            if (resumeFrac != null) {
                const d = video.duration
                if (!d || !Number.isFinite(d)) return // metadata not ready yet; wait for loadedmetadata
                video.currentTime = resumeFrac * d
            }
            resolvedKeyRef.current = key
        }

        void (async () => {
            const state = await client.getScrobbleFor(ref)
            if (cancelled) return
            const frac = state ? state.progress / 100 : 0
            resumeFrac = state && frac > RESUME_FLOOR && frac < RESUME_CAP ? frac : null
            fetched = true
            settle()
        })()

        const onMeta = () => settle()
        video.addEventListener("loadedmetadata", onMeta)
        // Safety valve: never block scrobbling forever if the fetch or metadata stalls.
        const fallback = window.setTimeout(() => {
            resolvedKeyRef.current = key
        }, 6000)

        return () => {
            cancelled = true
            video.removeEventListener("loadedmetadata", onMeta)
            window.clearTimeout(fallback)
        }
    }, [client, media, valid, videoRef])

    // Report play/pause/ended + a periodic progress checkpoint; checkpoint on page teardown + unmount.
    useEffect(() => {
        const video = videoRef.current
        if (!video || !media || !valid) return

        const onPlay = () => post("start")
        const onPause = () => {
            if (!video.ended) post("pause")
        }
        const onEnded = () => post("stop")
        const onTime = () => {
            if (video.paused) return
            const now = Date.now()
            if (now - lastSentRef.current < PROGRESS_INTERVAL_MS) return
            lastSentRef.current = now
            post("start")
        }
        // Fires on reload, tab close, and (for visibilitychange) tab switch / app backgrounding.
        const onHide = () => checkpointBeacon("pause")
        const onVisibility = () => {
            if (document.visibilityState === "hidden") checkpointBeacon("pause")
        }

        video.addEventListener("play", onPlay)
        video.addEventListener("pause", onPause)
        video.addEventListener("ended", onEnded)
        video.addEventListener("timeupdate", onTime)
        window.addEventListener("pagehide", onHide)
        document.addEventListener("visibilitychange", onVisibility)
        return () => {
            video.removeEventListener("play", onPlay)
            video.removeEventListener("pause", onPause)
            video.removeEventListener("ended", onEnded)
            video.removeEventListener("timeupdate", onTime)
            window.removeEventListener("pagehide", onHide)
            document.removeEventListener("visibilitychange", onVisibility)
            // SPA navigation away: checkpoint where we are so the next visit resumes.
            checkpointBeacon("pause")
        }
    }, [media, valid, videoRef, post, checkpointBeacon])
}
