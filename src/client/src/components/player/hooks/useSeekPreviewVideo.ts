import { useCallback, useEffect, useRef, useState } from "react"
import Hls from "hls.js"
import type { NormalizedSource } from "../types/source.types"

export type PreviewStatus = "idle" | "seeking" | "ready" | "error"

/**
 * A canvas-free seek-preview frame engine for the main player's scrub tile. It owns a SECOND, always
 * paused/muted `<video>` (imperatively created so it survives tile show/hide) pointed at the same
 * source as the real player, and renders the frame at an arbitrary time simply by setting
 * `video.currentTime = t` — the browser decodes and presents that frame onto the element itself. We
 * NEVER draw it to a canvas, so the cross-origin stream (gatearr.lan → cinepro.lan) can't taint anything.
 *
 * For HLS we attach a dedicated second hls.js instance pinned to the lowest level with no playback
 * buffer, so each scrub fetches the smallest/fastest segment. Seeks are single-flight + latest-wins +
 * rate-capped so a fast hover collapses to ~2 network fetches instead of hundreds.
 */
export function useSeekPreviewVideo(source: NormalizedSource | undefined) {
    const elRef = useRef<HTMLVideoElement | null>(null)
    const hlsRef = useRef<Hls | null>(null) // SECOND instance — never the main player's hlsRef
    const readyRef = useRef(false)
    const seekingRef = useRef(false)
    const pendingRef = useRef<number | null>(null)
    const lastCommittedRef = useRef(-1)
    const lastCommitAtRef = useRef(0)
    const durationRef = useRef(0)
    const watchdogRef = useRef(0) // frees the single-flight lock if "seeked" never fires
    const flushRef = useRef(0) // trailing flush for a rate-capped target when no seek is in flight
    const [status, setStatus] = useState<PreviewStatus>("idle")

    // Create the element once (lazy ref init — safe in render).
    if (!elRef.current && typeof document !== "undefined") {
        const el = document.createElement("video")
        el.muted = true
        el.defaultMuted = true
        el.playsInline = true
        el.preload = "auto"
        el.setAttribute("playsinline", "")
        el.tabIndex = -1
        el.style.width = "100%"
        el.style.height = "100%"
        el.style.objectFit = "cover"
        el.style.pointerEvents = "none"
        elRef.current = el
    }

    // Change threshold scales with runtime so sub-pixel hover jitter doesn't thrash the network.
    const minDelta = useCallback(() => Math.max(0.5, (durationRef.current || 0) / 400), [])

    const commit = useCallback(
        (time: number) => {
            const v = elRef.current
            if (!v || !readyRef.current) return
            const now = typeof performance !== "undefined" ? performance.now() : Date.now()
            // In-flight → stash the newest target; onSeeked/watchdog will chase it (latest-wins).
            if (seekingRef.current) {
                pendingRef.current = time
                return
            }
            // Rate cap (~10 committed seeks/sec). Stash + schedule ONE trailing flush so the final
            // resting target is never dropped when no seek is in flight.
            const sinceLast = now - lastCommitAtRef.current
            if (sinceLast < 100) {
                pendingRef.current = time
                if (!flushRef.current) {
                    flushRef.current = window.setTimeout(() => {
                        flushRef.current = 0
                        if (pendingRef.current != null) commit(pendingRef.current)
                    }, 100 - sinceLast)
                }
                return
            }
            if (Math.abs(time - lastCommittedRef.current) < minDelta()) return
            seekingRef.current = true
            lastCommittedRef.current = time
            lastCommitAtRef.current = now
            setStatus("seeking")
            try {
                v.currentTime = Math.max(0, Math.min(time, durationRef.current || time))
            } catch {
                seekingRef.current = false
                return
            }
            // Watchdog: if "seeked" never fires (errored / ignored seek), free the lock so the preview
            // doesn't freeze for the rest of the session, and chase any newer pending target.
            if (watchdogRef.current) clearTimeout(watchdogRef.current)
            watchdogRef.current = window.setTimeout(() => {
                watchdogRef.current = 0
                if (!seekingRef.current) return
                seekingRef.current = false
                const p = pendingRef.current
                if (p != null && Math.abs(p - lastCommittedRef.current) >= minDelta()) commit(p)
            }, 2500)
        },
        [minDelta]
    )

    const seekTo = useCallback(
        (time: number) => {
            if (!Number.isFinite(time)) return
            pendingRef.current = time
            commit(time)
        },
        [commit]
    )

    // Attach/detach the source, keyed on its identity. Owns its own hls.js instance.
    useEffect(() => {
        const v = elRef.current
        if (!v || !source?.url) return

        readyRef.current = false
        seekingRef.current = false
        pendingRef.current = null
        lastCommittedRef.current = -1
        durationRef.current = 0
        setStatus("idle")

        const onReady = () => {
            durationRef.current = Number.isFinite(v.duration) ? v.duration : durationRef.current
            readyRef.current = true
            if (pendingRef.current != null) commit(pendingRef.current)
        }
        const onSeeked = () => {
            if (watchdogRef.current) {
                clearTimeout(watchdogRef.current)
                watchdogRef.current = 0
            }
            seekingRef.current = false
            setStatus("ready")
            // latest-wins: chase the resting target if it moved on while we were fetching (drops intermediates).
            const p = pendingRef.current
            if (p != null && Math.abs(p - lastCommittedRef.current) >= minDelta()) {
                window.setTimeout(() => commit(p), 0)
            }
        }
        const onError = () => {
            // Free the single-flight lock so a later scrub to a valid position can recover.
            if (watchdogRef.current) {
                clearTimeout(watchdogRef.current)
                watchdogRef.current = 0
            }
            seekingRef.current = false
            setStatus("error")
        }

        v.addEventListener("loadedmetadata", onReady)
        v.addEventListener("seeked", onSeeked)
        v.addEventListener("error", onError)

        let hls: Hls | null = null
        if (source.type === "hls") {
            if (Hls.isSupported()) {
                hls = new Hls({ startLevel: 0, maxBufferLength: 2, maxMaxBufferLength: 4, backBufferLength: 0, enableWorker: true, lowLatencyMode: false })
                hlsRef.current = hls
                hls.loadSource(source.url)
                hls.attachMedia(v)
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    try {
                        hls!.currentLevel = 0 // pin lowest quality — the tile is tiny
                    } catch {
                        /* ignore */
                    }
                    // Don't commit here: at MANIFEST_PARSED the element isn't seekable yet and duration is
                    // NaN, so an eager currentTime write is silently ignored (no "seeked"). loadedmetadata
                    // fires onReady once the media is actually seekable.
                })
                hls.on(Hls.Events.ERROR, (_e, data) => {
                    if (data.fatal) onError()
                })
            } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
                v.src = source.url // Safari native HLS
            } else {
                setStatus("error")
            }
        } else {
            v.src = source.url // progressive: seeks served by HTTP range requests
        }

        return () => {
            if (watchdogRef.current) {
                clearTimeout(watchdogRef.current)
                watchdogRef.current = 0
            }
            if (flushRef.current) {
                clearTimeout(flushRef.current)
                flushRef.current = 0
            }
            v.removeEventListener("loadedmetadata", onReady)
            v.removeEventListener("seeked", onSeeked)
            v.removeEventListener("error", onError)
            if (hls) {
                hls.destroy()
                if (hlsRef.current === hls) hlsRef.current = null
            }
            try {
                v.removeAttribute("src")
                v.load()
            } catch {
                /* ignore */
            }
            readyRef.current = false
        }
    }, [source?.url, source?.type, commit, minDelta])

    // Callback ref: mount the owned <video> into the tile's frame area (stable across show/hide).
    const attach = useCallback((container: HTMLDivElement | null) => {
        const el = elRef.current
        if (!el || !container) return
        if (el.parentElement !== container) container.appendChild(el)
    }, [])

    return { attach, seekTo, status }
}
