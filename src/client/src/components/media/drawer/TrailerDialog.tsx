import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp, Film } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useOmss } from "@/hooks/use-omss"
import { cn } from "@/lib/utils"

// Load the YouTube IFrame Player API once (shared across every TrailerDialog instance). We need the
// JS API (not a bare iframe) so we can force autoplay, fall the search case back to loadPlaylist,
// and detect when the video ENDS to auto-close the player.
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

interface TrailerDialogProps {
    trailerId: string | null
    title: string
    /** Passed from the drawer so swipe-down can follow this title for release notifications. */
    mediaType?: "movie" | "tv"
    tmdbId?: number
}

export const TrailerDialog: React.FC<TrailerDialogProps> = ({ trailerId, title, mediaType, tmdbId }) => {
    const [active, setActive] = useState(false)
    const [followed, setFollowed] = useState(false)
    const stageRef = useRef<HTMLDivElement>(null) // the fullscreen target / full-viewport overlay
    const hostRef = useRef<HTMLDivElement>(null) // YT replaces an imperative child of this with its iframe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerRef = useRef<any>(null)
    const { client, valid } = useOmss()

    // Warm the API up front so onReady fires near-instantly on click (keeps the fullscreen activation fresh).
    useEffect(() => {
        void loadYouTubeApi()
    }, [])

    const close = useCallback(() => {
        exitFs()
        setActive(false)
    }, [])

    // Swipe-down → follow this title for new-release notifications (gatearr /follow). Guarded so a
    // second swipe doesn't re-POST, and gated on a reachable OMSS backend + a known tmdbId.
    const doFollow = useCallback(async () => {
        if (!valid || !mediaType || !tmdbId || followed) return
        setFollowed(true)
        try {
            await client.follow({ mediaType, tmdbId, title })
            toast.success(`Following — we'll notify you about new releases for ${title}`)
        } catch {
            setFollowed(false)
            toast.error("Couldn't follow this title")
        }
    }, [client, valid, mediaType, tmdbId, title, followed])

    // Vertical gestures on the capture strip (wheel & touch over the cross-origin iframe never reach
    // us, so they fire from the strip): swipe DOWN dismisses, swipe UP follows. (Mac natural scrolling:
    // a physical down-swipe is deltaY<0, an up-swipe is deltaY>0.)
    const touchStartY = useRef<number | null>(null)
    const onWheel = (e: React.WheelEvent) => {
        if (e.deltaY < -24) close()
        else if (e.deltaY > 24) void doFollow()
    }
    const onTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0]?.clientY ?? null
    }
    const onTouchEnd = (e: React.TouchEvent) => {
        const start = touchStartY.current
        touchStartY.current = null
        const end = e.changedTouches[0]?.clientY
        if (start == null || end == null) return
        if (end - start > 60) close()
        else if (start - end > 60) void doFollow()
    }

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
                    controls: 1,
                    modestbranding: 1,
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
                    // pointer-events-auto: the modal drawer sets body { pointer-events: none }, and this
                    // overlay is portaled to body (outside the drawer), so without this every click is dead.
                    <div ref={stageRef} className={cn("pointer-events-auto fixed inset-0 z-[2147483647] bg-black", !active && "hidden")}>
                        <div ref={hostRef} className="h-full w-full" />
                        {/* Gesture capture bands — TOP + BOTTOM only (where the hints are), NOT the center.
                            This leaves the player's centre (click-to-play / the big play button) and the whole
                            YouTube control bar directly clickable, while swipes over the hint bands still
                            follow (up) / close (down). A full-cover strip blocked the player's controls. */}
                        <div className="absolute inset-x-0 top-0 h-28 z-[5] touch-pan-x" onWheel={onWheel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />
                        <div className="absolute inset-x-0 bottom-20 h-28 z-[5] touch-pan-x" onWheel={onWheel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />
                        {/* Gesture hints (non-interactive). Up = follow, down = close. */}
                        <div className="pointer-events-none absolute inset-x-0 top-5 z-10 flex flex-col items-center gap-0.5 text-white/70">
                            <ChevronUp className="size-5" />
                            <span className="text-xs font-medium tracking-wide">{followed ? "Following — you'll be notified" : "Swipe up to follow"}</span>
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex flex-col items-center gap-0.5 text-white/70">
                            <span className="text-xs font-medium tracking-wide">Swipe down to close</span>
                            <ChevronDown className="size-5" />
                        </div>
                    </div>,
                    document.body
                )}
        </>
    )
}
