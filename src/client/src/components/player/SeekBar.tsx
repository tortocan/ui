import React, { useEffect, useRef, useState } from "react"
import { ChevronUp, Loader2 } from "lucide-react"
import { formatTime } from "./utils/time"
import type { PreviewStatus } from "./hooks/useSeekPreviewVideo"
import type { SpriteCue } from "./hooks/useThumbnailSprites"
import { cn } from "@/lib/utils"

interface SeekBarProps {
    currentTime: number
    duration: number
    /** End of the buffered range near the playhead (seconds), for the lighter buffered bar. */
    buffered?: number
    /** Commit the real seek (same contract as before: MediaPlayer.handleSeek(val[0])). */
    onSeek: (time: number[]) => void
    /** Mounts the preview `<video>` (owned by useSeekPreviewVideo) into the tile's frame area. */
    previewAttach: (el: HTMLDivElement | null) => void
    /** Drive the preview frame to this time (hover on desktop, drag on touch). */
    onPreviewTime: (time: number) => void
    previewStatus: PreviewStatus
    /** Backend sprite-sheet tile for a scrub time (instant); null → fall back to the live-frame engine. */
    spriteAt?: (time: number) => SpriteCue | null
    /** Let the player freeze its controls-autohide timer while a scrub is in flight (touch emits no mousemove). */
    onScrubbingChange?: (active: boolean) => void
}

const TILE_W = 320 // px — the preview tile width (matches the 320×180 sprite cell / the w-80 frame)
const PULL_RANGE = 220 // px of upward pull to reach minimum sensitivity
const MIN_SENS = 0.08 // most precise seek (8% of normal horizontal sensitivity)
const PRECISE_AT = 24 // px pulled up before the "precise" indicator kicks in

/**
 * A YouTube-style custom seek bar: hover/drag shows a live frame-preview tile + timecode above the
 * scrubber, and dragging the finger UP reduces seek sensitivity ("pull up for precise seeking").
 * Replaces the Radix Slider so the vertical gesture can be expressed; keyboard + ARIA are preserved.
 */
export function SeekBar({ currentTime, duration, buffered = 0, onSeek, previewAttach, onPreviewTime, previewStatus, spriteAt, onScrubbingChange }: SeekBarProps) {
    const trackRef = useRef<HTMLDivElement>(null)
    const gestureRef = useRef<{ startX: number; startY: number; startTime: number; rectLeft: number; width: number } | null>(null)
    const dragTimeRef = useRef(0) // live drag target (state lags a frame; the commit reads this)

    const [tileX, setTileX] = useState<number | null>(null) // tile center px within the track; null = hidden
    const [tileTime, setTileTime] = useState(0)
    const [dragging, setDragging] = useState(false)
    const [dragTime, setDragTime] = useState<number | null>(null)
    const [precise, setPrecise] = useState(false)
    // Once a frame has shown, keep it visible during later seeks instead of re-dimming on every scrub step.
    const [everReady, setEverReady] = useState(false)
    useEffect(() => {
        if (previewStatus === "ready") setEverReady(true)
        else if (previewStatus === "idle") setEverReady(false) // source changed → reset
    }, [previewStatus])

    const hasDur = duration > 0 && Number.isFinite(duration)
    const value = dragging && dragTime != null ? dragTime : currentTime
    const frac = hasDur ? Math.max(0, Math.min(1, value / duration)) : 0
    const bufFrac = hasDur ? Math.max(0, Math.min(1, buffered / duration)) : 0

    const clampTileX = (x: number, width: number) => Math.max(TILE_W / 2, Math.min(width - TILE_W / 2, x))

    // Only drive the (slow) live-frame engine when the backend sprite sheet has no tile for this time.
    const drivePreview = (t: number) => {
        if (!spriteAt?.(t)) onPreviewTime(t)
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (dragging) {
            const g = gestureRef.current
            if (!g || !hasDur) return
            const dx = e.clientX - g.startX
            const up = Math.max(0, g.startY - e.clientY)
            const sens = Math.max(MIN_SENS, Math.min(1, 1 - up / PULL_RANGE))
            let t = g.startTime + (dx / g.width) * duration * sens
            t = Math.max(0, Math.min(duration, t))
            dragTimeRef.current = t
            setDragTime(t)
            setTileTime(t)
            setPrecise(up > PRECISE_AT)
            setTileX(clampTileX(e.clientX - g.rectLeft, g.width))
            drivePreview(t)
            return
        }
        // Hover preview (mouse only — touch has no hover).
        if (e.pointerType !== "mouse" || !hasDur || !trackRef.current) return
        const rect = trackRef.current.getBoundingClientRect()
        if (rect.width <= 0) return
        const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration
        setTileTime(t)
        setTileX(clampTileX(e.clientX - rect.left, rect.width))
        drivePreview(t)
    }

    const onPointerLeave = () => {
        if (!dragging) setTileX(null)
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!hasDur || !trackRef.current) return
        const rect = trackRef.current.getBoundingClientRect()
        if (rect.width <= 0) return
        try {
            trackRef.current.setPointerCapture(e.pointerId)
        } catch {
            /* ignore */
        }
        const startTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration
        gestureRef.current = { startX: e.clientX, startY: e.clientY, startTime, rectLeft: rect.left, width: rect.width }
        dragTimeRef.current = startTime
        setDragging(true)
        setDragTime(startTime)
        setTileTime(startTime)
        setPrecise(false)
        setTileX(clampTileX(e.clientX - rect.left, rect.width))
        drivePreview(startTime)
        onScrubbingChange?.(true)
        e.preventDefault()
    }

    const finishDrag = (e: React.PointerEvent<HTMLDivElement>, commitSeek: boolean) => {
        if (!dragging) return
        try {
            trackRef.current?.releasePointerCapture(e.pointerId)
        } catch {
            /* ignore */
        }
        if (commitSeek) onSeek([dragTimeRef.current]) // pointerup commits; pointercancel aborts
        setDragging(false)
        setPrecise(false)
        gestureRef.current = null
        onScrubbingChange?.(false)
        if (e.pointerType !== "mouse") setTileX(null) // touch: hide tile; mouse keeps hovering
    }
    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => finishDrag(e, true)
    // pointercancel = the OS aborted the gesture (2nd finger, notification, edge-gesture); don't seek.
    const cancelDrag = (e: React.PointerEvent<HTMLDivElement>) => finishDrag(e, false)

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!hasDur) return
        let t: number | null = null
        if (e.key === "ArrowLeft") t = Math.max(0, currentTime - 10)
        else if (e.key === "ArrowRight") t = Math.min(duration, currentTime + 10)
        else if (e.key === "Home") t = 0
        else if (e.key === "End") t = duration
        if (t == null) return
        e.preventDefault()
        e.stopPropagation() // don't let PlayerControls' window keydown also seek
        onSeek([t])
    }

    return (
        <div className="relative">
            {/* Preview tile (frame + pull-up hint + timecode), shown on hover/drag. */}
            {tileX != null && hasDur && (
                <div className="pointer-events-none absolute bottom-6 z-20 flex -translate-x-1/2 flex-col items-center gap-1" style={{ left: tileX }}>
                    {dragging && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-white/80">
                            <ChevronUp className={cn("size-3.5 transition-transform", precise && "-translate-y-0.5 text-primary")} />
                            <span>{precise ? "Precise seeking" : "Pull up for precise seeking"}</span>
                        </div>
                    )}
                    <div className="relative h-[180px] w-80 max-w-[90vw] overflow-hidden rounded-lg border border-white/20 bg-black shadow-xl">
                        {/* Live-frame engine (fallback), always mounted so it keeps the element stable. */}
                        <div ref={previewAttach} className="h-full w-full" />
                        {(() => {
                            const sprite = spriteAt?.(tileTime) ?? null
                            if (sprite) {
                                // Backend sprite sheet: show the exact 160×90 cell instantly (no decode).
                                return (
                                    <div
                                        className="absolute inset-0"
                                        style={{
                                            backgroundImage: `url("${sprite.url}")`,
                                            backgroundPosition: `-${sprite.x}px -${sprite.y}px`,
                                            backgroundRepeat: "no-repeat",
                                        }}
                                    />
                                )
                            }
                            // No sprite yet → live-frame engine's dim/spinner ONLY before its first frame.
                            if (previewStatus === "error" && !everReady)
                                return (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                        <span className="text-xs text-white/60">No preview</span>
                                    </div>
                                )
                            if (!everReady)
                                return (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                                        <Loader2 className="size-5 animate-spin text-white/70" />
                                    </div>
                                )
                            return null
                        })()}
                    </div>
                    <span className="rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">{formatTime(tileTime)}</span>
                </div>
            )}

            {/* Track (pointer-driven). touch-action:none so the vertical pull-up never scrolls the page. */}
            <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={hasDur ? Math.floor(duration) : 0}
                aria-valuenow={Math.floor(value)}
                aria-valuetext={`${formatTime(value)} of ${formatTime(duration)}`}
                className="group relative cursor-pointer touch-none rounded-full py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
                onPointerDown={onPointerDown}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
                onKeyDown={onKeyDown}
            >
                <div className="relative h-1 w-full rounded-full bg-white/30">
                    {/* Buffered */}
                    <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${bufFrac * 100}%` }} />
                    {/* Played */}
                    <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${frac * 100}%` }} />
                    {/* Thumb */}
                    <div
                        className={cn(
                            "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow transition-[height,width]",
                            (dragging || tileX != null) && "size-4"
                        )}
                        style={{ left: `${frac * 100}%` }}
                    />
                </div>
            </div>
        </div>
    )
}
