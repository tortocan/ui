import { useCallback, useEffect, useRef, useState } from "react"
import type { NormalizedSource } from "../types/source.types"

/** One VTT cue → a region of the sprite sheet shown for [start, end). */
export interface SpriteCue {
    start: number
    end: number
    url: string
    x: number
    y: number
    w: number
    h: number
}

// gatearr serves the trick-play track next to the stream: /v1/stream/{key} → /v1/thumbnails/{key}/thumbs.vtt
function deriveVttUrl(streamUrl: string): string | null {
    const m = streamUrl.match(/^(.*)\/v1\/stream\/([^/?#]+)/)
    if (!m) return null
    return `${m[1]}/v1/thumbnails/${m[2]}/thumbs.vtt`
}

function parseTime(s: string): number {
    // HH:MM:SS.mmm or MM:SS.mmm
    const parts = s.trim().split(":")
    if (parts.length < 2) return NaN
    const sec = parseFloat(parts[parts.length - 1])
    const min = parseInt(parts[parts.length - 2], 10)
    const hr = parts.length >= 3 ? parseInt(parts[parts.length - 3], 10) : 0
    return hr * 3600 + min * 60 + sec
}

function parseVtt(text: string, vttUrl: string): SpriteCue[] {
    const cues: SpriteCue[] = []
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
        const arrow = lines[i].indexOf("-->")
        if (arrow < 0) continue
        const start = parseTime(lines[i].slice(0, arrow))
        const end = parseTime(lines[i].slice(arrow + 3))
        const payload = (lines[i + 1] ?? "").trim()
        if (!payload || !Number.isFinite(start) || !Number.isFinite(end)) continue
        const hash = payload.indexOf("#xywh=")
        if (hash < 0) continue
        const rel = payload.slice(0, hash)
        const [x, y, w, h] = payload
            .slice(hash + 6)
            .split(",")
            .map((n) => parseInt(n, 10))
        if ([x, y, w, h].some((n) => !Number.isFinite(n))) continue
        let url: string
        try {
            url = new URL(rel, vttUrl).href
        } catch {
            continue
        }
        cues.push({ start, end, url, x, y, w, h })
        i++ // consumed the payload line
    }
    return cues
}

/**
 * Loads gatearr's backend-generated seek-preview sprite track (sprite sheet + WebVTT) for the current
 * source and exposes <c>spriteAt(time)</c> for instant scrub tiles. LAZY: nothing is fetched until the
 * user first scrubs and calls <c>ensureLoaded()</c> — so passive hover triggers no network at all. The
 * sheet is generated on the backend (~a minute), so a 404 is retried with backoff; until it lands,
 * <c>ready</c> is false and the SeekBar falls back to the (also lazy) live-frame engine.
 */
export function useThumbnailSprites(source: NormalizedSource | undefined) {
    const [cues, setCues] = useState<SpriteCue[] | null>(null)
    const lastRef = useRef<SpriteCue | null>(null)
    const startedRef = useRef(false)
    const cancelledRef = useRef(false)

    // Reset (and stop any in-flight retry loop) when the source changes.
    useEffect(() => {
        setCues(null)
        lastRef.current = null
        startedRef.current = false
        cancelledRef.current = false
        return () => {
            cancelledRef.current = true
        }
    }, [source?.url])

    // Start fetching the VTT (once) — called on the first scrub, NOT on mount/hover.
    const ensureLoaded = useCallback(() => {
        if (startedRef.current) return
        const streamUrl = source?.url
        if (!streamUrl) return
        const vttUrl = deriveVttUrl(streamUrl)
        if (!vttUrl) return
        startedRef.current = true
        let tries = 0
        const attempt = async () => {
            if (cancelledRef.current) return
            try {
                const res = await fetch(vttUrl)
                if (res.ok) {
                    const parsed = parseVtt(await res.text(), vttUrl)
                    if (!cancelledRef.current && parsed.length) {
                        setCues(parsed)
                        return
                    }
                }
            } catch {
                /* network / not ready */
            }
            if (!cancelledRef.current && tries++ < 24) window.setTimeout(attempt, 5000) // bounded backoff
        }
        void attempt()
    }, [source?.url])

    const spriteAt = useCallback(
        (time: number): SpriteCue | null => {
            if (!cues || cues.length === 0) return null
            // Cues are ordered; linear scan is fine (≤200). Remember the last hit as a cheap fallback.
            for (const c of cues) {
                if (time >= c.start && time < c.end) {
                    lastRef.current = c
                    return c
                }
            }
            // Past the last cue's end (rounding) → clamp to the last tile.
            return time >= cues[cues.length - 1].start ? cues[cues.length - 1] : lastRef.current
        },
        [cues]
    )

    return { ready: !!cues, spriteAt, ensureLoaded }
}
