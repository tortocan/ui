import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Film, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Load the YouTube IFrame Player API once (shared across every TrailerDialog instance). We need the
// JS API (not a bare iframe) so we can force autoplay, fall the search case back to loadPlaylist,
// drive play/pause + seek from our own gestures, and detect when the video ENDS.
let ytApiPromise: Promise<void> | null = null
function loadYouTubeApi(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve()
    const w = window as unknown as { YT?: { Player: unknown }; onYouTubeIframeAPIReady?: () => void }
    if (w.YT?.Player) return Promise.resolve()
    if (ytApiPromise) return ytApiPromise
    ytApiPromise = new Promise<void>((resolve) => {
        const prev = w.onYouTubeIframeAPIReady
        w.onYouTubeIframeAPIReady = () => {
            prev?.()
            resolve()
        }
        const tag = document.createElement("script")
        tag.src = "https://www.youtube.com/iframe_api"
        document.head.appendChild(tag)
    })
    return ytApiPromise
}

// Cross-browser (Safari is webkit-prefixed) fullscreen helpers.
function requestFs(el: HTMLElement) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = el.requestFullscreen ?? (el as any).webkitRequestFullscreen
    try {
        return fn?.call(el)
    } catch {
        return undefined
    }
}
function fsElement(): Element | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return document.fullscreenElement ?? (document as any).webkitFullscreenElement ?? null
}
function exitFs() {
    if (!fsElement()) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = document.exitFullscreen ?? (document as any).webkitExitFullscreen
    try {
        void fn?.call(document)
    } catch {
        /* ignore */
    }
}

const SWIPE_CLOSE = 60 // px of upward travel that dismisses
const SCRUB_START = 12 // px of horizontal travel before we treat it as a scrub
const TAP_SLOP = 8 // px of total travel still counted as a tap

interface TrailerDialogProps {
    trailerId: string | null
    title: string
}

export const TrailerDialog: React.FC<TrailerDialogProps> = ({ trailerId, title }) => {
    const [active, setActive] = useState(false)
    const stageRef = useRef<HTMLDivElement>(null) // the fullscreen target / full-viewport overlay
    const hostRef = useRef<HTMLDivElement>(null) // YT replaces an imperative child of this with its iframe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerRef = useRef<any>(null)
    // Active pointer gesture: start point, the playback position it began at, and whether it became a scrub.
    const gestureRef = useRef<{ x: number; y: number; base: number; dur: number; scrub: boolean } | null>(null)

    // Warm the API up front so onReady fires near-instantly on click (keeps the fullscreen activation fresh).
    useEffect(() => {
        void loadYouTubeApi()
    }, [])

    const close = useCallback(() => {
        exitFs()
        setActive(false)
    }, [])

    // Launch straight into fullscreen from the click gesture (the only moment the browser grants it).
    const launch = useCallback(() => {
        setActive(true)
        const el = stageRef.current
        if (el) {
            el.classList.remove("hidden")
            void Promise.resolve(requestFs(el)).catch(() => {})
        }
    }, [])

    // Build the player whenever we go active; tear it down when we close.
    useEffect(() => {
        if (!active) return
        let killed = false

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close()
        }
        document.addEventListener("keydown", onKey)

        void loadYouTubeApi().then(() => {
            if (killed || !hostRef.current) return
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const YT = (window as any).YT
            // Give YT an imperative child (NOT a React-managed node) so unmount never collides with YT's DOM surgery.
            const mount = document.createElement("div")
            mount.style.width = "100%"
            mount.style.height = "100%"
            hostRef.current.appendChild(mount)

            playerRef.current = new YT.Player(mount, {
                host: "https://www.youtube-nocookie.com",
                width: "100%",
                height: "100%",
                videoId: trailerId ?? undefined,
                playerVars: {
                    autoplay: 1,
                    controls: 0, // no native chrome — our gesture layer drives play/pause + seek
                    modestbranding: 1,
                    disablekb: 1,
                    rel: 0,
                    iv_load_policy: 3,
                    playsinline: 1,
                    fs: 1,
                    origin: window.location.origin,
                },
                events: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onReady: (e: any) => {
                        if (!trailerId) e.target.loadPlaylist({ listType: "search", list: `${title} trailer`, index: 0 })
                        e.target.playVideo()
                        // Autoplay fallback: if sound-autoplay is blocked, mute and retry so it still plays.
                        window.setTimeout(() => {
                            try {
                                const s = e.target.getPlayerState?.()
                                if (s !== 1 && s !== 3) {
                                    e.target.mute()
                                    e.target.playVideo()
                                }
                            } catch {
                                /* ignore */
                            }
                        }, 1200)
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onStateChange: (e: any) => {
                        if (e.data === YT.PlayerState.ENDED) close()
                    },
                },
            })
        })

        return () => {
            killed = true
            document.removeEventListener("keydown", onKey)
            try {
                playerRef.current?.destroy?.()
            } catch {
                /* player may already be gone */
            }
            playerRef.current = null
            if (hostRef.current) hostRef.current.innerHTML = ""
        }
    }, [active, trailerId, title, close])

    // ---- Gesture layer: tap = play/pause, swipe up = close, swipe left/right = scrub the timeline. ----
    const seekTarget = (g: { base: number; dur: number }, dx: number) => Math.max(0, Math.min(g.dur, g.base + (dx / window.innerWidth) * g.dur))

    const onPointerDown = (e: React.PointerEvent) => {
        e.stopPropagation() // keep the drawer's dismissable-layer from seeing this as an outside interaction
        const p = playerRef.current
        gestureRef.current = { x: e.clientX, y: e.clientY, base: p?.getCurrentTime?.() ?? 0, dur: p?.getDuration?.() ?? 0, scrub: false }
        e.currentTarget.setPointerCapture?.(e.pointerId)
    }

    const onPointerMove = (e: React.PointerEvent) => {
        const g = gestureRef.current
        if (!g) return
        const dx = e.clientX - g.x
        const dy = e.clientY - g.y
        if (!g.scrub && Math.abs(dx) > SCRUB_START && Math.abs(dx) > Math.abs(dy)) g.scrub = true
        if (g.scrub && g.dur > 0) playerRef.current?.seekTo?.(seekTarget(g, dx), false) // live preview, no network until release
    }

    const onPointerUp = (e: React.PointerEvent) => {
        const g = gestureRef.current
        gestureRef.current = null
        if (!g) return
        const dx = e.clientX - g.x
        const dy = e.clientY - g.y

        if (g.scrub) {
            if (g.dur > 0) {
                playerRef.current?.seekTo?.(seekTarget(g, dx), true)
                playerRef.current?.playVideo?.()
            }
            return
        }
        // Swipe up → close.
        if (dy < -SWIPE_CLOSE && Math.abs(dy) > Math.abs(dx)) {
            close()
            return
        }
        // Tap → toggle play/pause.
        if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) {
            const p = playerRef.current
            if (p?.getPlayerState?.() === 1) p?.pauseVideo?.()
            else p?.playVideo?.()
        }
    }

    return (
        <>
            <Button onClick={launch} variant={"outline"} className={"rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"}>
                <Film className="h-4 w-4" aria-hidden />
                <span className="ml-2 text-sm font-medium">Trailer</span>
            </Button>

            {typeof document !== "undefined" &&
                createPortal(
                    // z-max so it sits above the (full-screen) drawer; stays a full-viewport black panel even
                    // if the Fullscreen API is refused. Rendered hidden until launched.
                    <div ref={stageRef} className={cn("fixed inset-0 z-[2147483647] bg-black", !active && "hidden")}>
                        <div ref={hostRef} className="h-full w-full" />
                        {/* Transparent gesture layer on top of the player: it swallows clicks (so focus never enters
                            the cross-origin iframe and the drawer can't be dismissed) and drives the player itself. */}
                        <div
                            className="absolute inset-0 z-10 touch-none"
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={() => {
                                gestureRef.current = null
                            }}
                        />
                        <button
                            type="button"
                            aria-label="Close trailer"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={close}
                            className="absolute top-4 right-4 z-20 flex size-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                        >
                            <X className="size-5" />
                        </button>
                    </div>,
                    document.body
                )}
        </>
    )
}
