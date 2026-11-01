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
 * source and exposes <c>spriteAt(time)</c> for instant scrub tiles. The sheet is generated eagerly on
 * stream start but can take ~a minute, so a 404 is retried with backoff; until it lands, <c>ready</c> is
 * false and the SeekBar falls back to the live-frame engine.
 */
export function useThumbnailSprites(source: NormalizedSource | undefined) {
    const [cues, setCues] = useState<SpriteCue[] | null>(null)
    const lastRef = useRef<SpriteCue | null>(null)

    useEffect(() => {
        setCues(null)
        lastRef.current = null
        const streamUrl = source?.url
        if (!streamUrl) return
        const vttUrl = deriveVttUrl(streamUrl)
        if (!vttUrl) return

        let cancelled = false
        let tries = 0
        let timer = 0
        const attempt = async () => {
            try {
                const res = await fetch(vttUrl)
                if (res.ok) {
                    const parsed = parseVtt(await res.text(), vttUrl)
                    if (!cancelled && parsed.length) {
                        setCues(parsed)
                        return
                    }
                }
            } catch {
                /* network / not ready */
            }
            // Not ready yet (generation ~a minute). Retry a bounded number of times, then give up (live-frame fallback stays).
            if (!cancelled && tries++ < 24) timer = window.setTimeout(attempt, 5000)
        }
        void attempt()
        return () => {
            cancelled = true
            if (timer) window.clearTimeout(timer)
        }
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

    return { ready: !!cues, spriteAt }
}
