import React, { useEffect, useRef, useState } from "react"
import { Film } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

// Load the YouTube IFrame Player API once (shared across every TrailerDialog instance).
// We need the JS API (not a bare iframe) so we can force autoplay — including on the
// search fallback — and detect when the video ENDS to auto-close the player.
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

interface TrailerDialogProps {
    trailerId: string | null
    title: string
}

export const TrailerDialog: React.FC<TrailerDialogProps> = ({ trailerId, title }) => {
    const [open, setOpen] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null) // the fullscreen target
    const hostRef = useRef<HTMLDivElement>(null) // YT replaces an inner child of this with its iframe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerRef = useRef<any>(null)

    useEffect(() => {
        if (!open) return
        let cancelled = false

        void loadYouTubeApi().then(() => {
            if (cancelled || !hostRef.current) return
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const YT = (window as any).YT
            // YT replaces its target node with an <iframe>; give it an imperative child (NOT a
            // React-managed node) so React's unmount never collides with YT's DOM surgery.
            const mount = document.createElement("div")
            mount.className = "h-full w-full"
            hostRef.current.appendChild(mount)

            playerRef.current = new YT.Player(mount, {
                host: "https://www.youtube-nocookie.com",
                width: "100%",
                height: "100%",
                videoId: trailerId ?? undefined,
                playerVars: {
                    autoplay: 1,
                    controls: 1,
                    modestbranding: 1, // trim the YouTube logo chrome
                    rel: 0, // keep related results to the same channel
                    iv_load_policy: 3, // hide annotations
                    playsinline: 1,
                    fs: 1,
                    origin: window.location.origin,
                },
                events: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onReady: (e: any) => {
                        // No TMDB key → search YouTube for the trailer and play the top hit.
                        if (!trailerId) e.target.loadPlaylist({ listType: "search", list: `${title} trailer`, index: 0 })
                        e.target.playVideo()
                        // Best-effort fullscreen (succeeds while the Trailer click's activation is still fresh).
                        contentRef.current?.requestFullscreen?.().catch(() => {})
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onStateChange: (e: any) => {
                        if (e.data === YT.PlayerState.ENDED) setOpen(false)
                    },
                },
            })
        })

        return () => {
            cancelled = true
            if (typeof document !== "undefined" && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
            try {
                playerRef.current?.destroy?.()
            } catch {
                /* player may already be gone */
            }
            playerRef.current = null
            if (hostRef.current) hostRef.current.innerHTML = ""
        }
    }, [open, trailerId, title])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant={"outline"} className={"rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"}>
                    <Film className="h-4 w-4" aria-hidden />
                    <span className="ml-2 text-sm font-medium">Trailer</span>
                </Button>
            </DialogTrigger>
            {/* flex (not the base grid) + sm:max-w-none defeats the dialog's sm:max-w-md cap so the panel fills the screen. */}
            <DialogContent ref={contentRef} className="flex h-screen w-screen max-w-none items-center justify-center gap-0 rounded-none border-none bg-black p-0 sm:max-w-none">
                <DialogHeader className="sr-only">
                    <DialogTitle>{title} Trailer</DialogTitle>
                </DialogHeader>
                {/* Maximal centered 16:9 stage: width = min(100vw, 100vh*16/9) so it never exceeds the viewport. */}
                <div className="aspect-video max-h-screen w-full max-w-[calc(100vh*16/9)]">
                    <div ref={hostRef} className="h-full w-full" />
                </div>
            </DialogContent>
        </Dialog>
    )
}
