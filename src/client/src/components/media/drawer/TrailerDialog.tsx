import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, ChevronUp, Film, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useOmss } from "@/hooks/use-omss"
import { useProfiles } from "@/app/providers/profile-provider"
import { cn } from "@/lib/utils"

// Load the YouTube IFrame Player API once (shared across every TrailerDialog instance). We need the
// JS API (not a bare iframe) so we drive playback ourselves: our own controls + swipe gestures over a
// full-area layer (YouTube's native controls are hidden), autoplay with a muted fallback, auto-close.
//
// NOTE: there is deliberately NO quality or subtitle menu. On a controls:0 youtube-nocookie embed
// YouTube's API cannot honor either — setPlaybackQuality was deprecated in 2018 (YouTube auto-selects
// and ignores requests) and the captions-module track API is inert without native controls. A settings
// menu for them was built and removed because it could not actually change quality or display captions.
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

function fmtTime(s: number): string {
    if (!Number.isFinite(s) || s < 0) s = 0
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, "0")}`
}

interface TrailerDialogProps {
    trailerId: string | null
    title: string
    /** Passed from the drawer so swipe-up can follow this title for release notifications. */
    mediaType?: "movie" | "tv"
    tmdbId?: number
    /** Active display language (iso-639-1, e.g. "es") — biases the YouTube player + search fallback so
     * the trailer loads in the toggled language. `trailerId`/`title` already reflect it. */
    language?: string
    /** Localized label for the trigger button (defaults to "Trailer"). */
    label?: string
}

export const TrailerDialog: React.FC<TrailerDialogProps> = ({ trailerId, title, mediaType, tmdbId, language, label = "Trailer" }) => {
    const [active, setActive] = useState(false)
    const [followed, setFollowed] = useState(false)
    // Custom-control state, polled from the player.
    const [playing, setPlaying] = useState(false)
    const [muted, setMuted] = useState(false)
    const [cur, setCur] = useState(0)
    const [dur, setDur] = useState(0)
    const [isFs, setIsFs] = useState(false)
    const [vol, setVol] = useState(100) // player volume 0–100
    // Profile picker: which profiles to apply the follow to (the current one is always included).
    const [pickerOpen, setPickerOpen] = useState(false)
    const [picked, setPicked] = useState<Set<number>>(new Set())

    const stageRef = useRef<HTMLDivElement>(null) // the fullscreen target / full-viewport overlay
    const hostRef = useRef<HTMLDivElement>(null) // YT replaces an imperative child of this with its iframe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerRef = useRef<any>(null)
    const qualitySetRef = useRef(false)
    const draggingRef = useRef(false) // a slider (seek/volume) is being dragged — don't let the poll fight it
    const { client, valid, baseUrl } = useOmss()
    const { profiles, activeProfile } = useProfiles()

    useEffect(() => {
        void loadYouTubeApi()
    }, [])

    const close = useCallback(() => {
        exitFs()
        setActive(false)
    }, [])

    // ---- Player controls (driven via the YT API, since native controls are hidden) ----
    const togglePlay = useCallback(() => {
        const p = playerRef.current
        if (!p?.getPlayerState) return
        if (p.getPlayerState() === 1) p.pauseVideo?.()
        else p.playVideo?.()
    }, [])
    const toggleMute = useCallback(() => {
        const p = playerRef.current
        if (!p?.isMuted) return
        if (p.isMuted()) {
            p.unMute?.()
            // If the level was dragged to 0 before muting, restore an audible default so unmute isn't silent.
            if ((p.getVolume?.() ?? 0) === 0) {
                p.setVolume?.(100)
                setVol(100)
            }
            setMuted(false)
        } else {
            p.mute?.()
            setMuted(true)
        }
    }, [])
    const onSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Number(e.target.value)
        playerRef.current?.seekTo?.(v, true)
        setCur(v)
    }, [])
    const toggleFs = useCallback(() => {
        if (fsElement()) exitFs()
        else if (stageRef.current) void Promise.resolve(requestFs(stageRef.current)).catch(() => {})
    }, [])

    // Volume slider (0–100). A non-zero level unmutes + applies it; zero MUTES but preserves the
    // underlying level (so the mute button later restores sound) rather than driving volume to 0.
    const onVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Number(e.target.value)
        const p = playerRef.current
        try {
            if (v === 0) {
                p?.mute?.()
                setMuted(true)
            } else {
                p?.setVolume?.(v)
                if (p?.isMuted?.()) p.unMute?.()
                setMuted(false)
                setVol(v)
            }
        } catch {
            /* ignore */
        }
    }, [])

    // Follow this title for new-release notifications (gatearr /follow). Applies to the given profiles
    // (the "current + selection" set). A direct text/plain POST (no custom header → no CORS preflight)
    // carries profileIds; gatearr upserts a follow for each. Guarded against re-POST.
    const applyFollow = useCallback(
        async (profileIds: number[]) => {
            if (!valid || !mediaType || !tmdbId || followed) return
            setFollowed(true)
            setPickerOpen(false)
            try {
                // A single profile with no multi-select → the SDK call (carries X-Profile-Id). Multiple →
                // the explicit profileIds body so gatearr fans the follow out to each at once.
                if (profileIds.length <= 1) {
                    await client.follow({ mediaType, tmdbId, title })
                } else {
                    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/follow`, {
                        method: "POST",
                        headers: { "Content-Type": "text/plain" },
                        body: JSON.stringify({ mediaType, tmdbId, title, profileIds }),
                    })
                    if (!res.ok) throw new Error(`follow ${res.status}`)
                }
                const n = profileIds.length
                toast.success(n > 1 ? `Following on ${n} profiles — we'll notify you about new releases for ${title}` : `Following — we'll notify you about new releases for ${title}`)
            } catch {
                setFollowed(false)
                toast.error("Couldn't follow this title")
            }
        },
        [client, valid, baseUrl, mediaType, tmdbId, title, followed]
    )

    // The follow gesture. With more than one profile, pop the selection box (current profile preselected
    // + locked); with a single/no profile, just follow directly.
    const requestFollow = useCallback(() => {
        if (!valid || !mediaType || !tmdbId || followed || pickerOpen) return
        if (profiles.length > 1) {
            setPicked(new Set(activeProfile ? [activeProfile.id] : []))
            setPickerOpen(true)
        } else {
            void applyFollow(activeProfile ? [activeProfile.id] : [])
        }
    }, [valid, mediaType, tmdbId, followed, pickerOpen, profiles.length, activeProfile, applyFollow])

    // ---- Full-area gesture + tap layer. Swipe UP follows, swipe DOWN closes; a tap toggles play/pause.
    // A swipe suppresses the trailing (ghost) click so it doesn't also toggle play.
    const touchStartY = useRef<number | null>(null)
    const suppressClickRef = useRef(false)
    const markSwipe = () => {
        suppressClickRef.current = true
        window.setTimeout(() => (suppressClickRef.current = false), 500)
    }
    const onWheel = (e: React.WheelEvent) => {
        if (e.deltaY < -24) close()
        else if (e.deltaY > 24) requestFollow()
    }
    const onTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0]?.clientY ?? null
    }
    const onTouchEnd = (e: React.TouchEvent) => {
        const start = touchStartY.current
        touchStartY.current = null
        const end = e.changedTouches[0]?.clientY
        if (start == null || end == null) return
        if (end - start > 60) {
            markSwipe()
            close()
        } else if (start - end > 60) {
            markSwipe()
            requestFollow()
        }
    }
    const onLayerClick = () => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
        }
        togglePlay()
    }

    // Launch straight into fullscreen from the click gesture (the only moment the browser grants it).
    const launch = useCallback(() => {
        setActive(true)
        setFollowed(false)
        setPickerOpen(false)
        const el = stageRef.current
        if (el) {
            el.classList.remove("hidden")
            void Promise.resolve(requestFs(el)).catch(() => {})
        }
    }, [])

    // Build the player whenever we go active; poll its state for the custom controls; tear it down on close.
    useEffect(() => {
        if (!active) return
        let killed = false
        qualitySetRef.current = false

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close()
        }
        const onFsChange = () => setIsFs(!!fsElement())
        document.addEventListener("keydown", onKey)
        document.addEventListener("fullscreenchange", onFsChange)
        document.addEventListener("webkitfullscreenchange", onFsChange)

        let poll = 0
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
                    controls: 0, // hidden — we render our own control bar + full-area gesture/tap layer
                    disablekb: 1,
                    modestbranding: 1,
                    rel: 0,
                    iv_load_policy: 3,
                    playsinline: 1,
                    fs: 0,
                    vq: "hd1080", // best-effort HD hint (YouTube still auto-selects — quality can't be forced via the API)
                    origin: window.location.origin,
                    ...(language ? { hl: language } : {}), // bias the player + search-fallback results to the language
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
                        // Poll playback state for the custom controls.
                        poll = window.setInterval(() => {
                            const p = playerRef.current
                            if (!p?.getDuration) return
                            try {
                                setDur(p.getDuration() || 0)
                                setPlaying(p.getPlayerState?.() === 1)
                                setMuted(!!p.isMuted?.())
                                // Don't fight an in-progress seek/volume drag (both write these same states).
                                if (!draggingRef.current) {
                                    setCur(p.getCurrentTime() || 0)
                                    setVol(p.getVolume?.() ?? 100) // underlying level; the slider shows 0 when muted via value=
                                }
                            } catch {
                                /* ignore */
                            }
                        }, 250)
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onStateChange: (e: any) => {
                        setPlaying(e.data === 1)
                        // On first play, nudge to the highest available level (best-effort only; YouTube ultimately
                        // auto-selects and the request is not guaranteed — quality cannot be forced via the API).
                        if (e.data === 1 && !qualitySetRef.current) {
                            qualitySetRef.current = true
                            try {
                                const ls: string[] = e.target.getAvailableQualityLevels?.() ?? []
                                const best = ls.find((l) => l !== "auto")
                                if (best) e.target.setPlaybackQuality?.(best)
                            } catch {
                                /* deprecated API — best-effort only */
                            }
                        }
                        if (e.data === YT.PlayerState.ENDED) close()
                    },
                },
            })
        })

        return () => {
            killed = true
            if (poll) window.clearInterval(poll)
            document.removeEventListener("keydown", onKey)
            document.removeEventListener("fullscreenchange", onFsChange)
            document.removeEventListener("webkitfullscreenchange", onFsChange)
            try {
                playerRef.current?.destroy?.()
            } catch {
                /* player may already be gone */
            }
            playerRef.current = null
            if (hostRef.current) hostRef.current.innerHTML = ""
            setPlaying(false)
            setCur(0)
            setDur(0)
            setVol(100)
        }
    }, [active, trailerId, title, language, close])

    return (
        <>
            <Button onClick={launch} variant={"outline"} className={"rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"}>
                <Film className="h-4 w-4" aria-hidden />
                <span className="ml-2 text-sm font-medium">{label}</span>
            </Button>

            {typeof document !== "undefined" &&
                createPortal(
                    // pointer-events-auto: the modal drawer sets body { pointer-events: none }, and this overlay is
                    // portaled to body (outside the drawer), so without it every click is dead.
                    <div ref={stageRef} className={cn("pointer-events-auto fixed inset-0 z-[2147483647] bg-black select-none", !active && "hidden")}>
                        <div ref={hostRef} className="h-full w-full" />

                        {/* Full-area gesture + tap layer (over the whole player). Swipe up = follow, down = close,
                            tap = play/pause. It sits BELOW the custom control bar (z-10), so the bar stays clickable. */}
                        <div
                            className="absolute inset-0 z-[5] touch-pan-x"
                            onWheel={onWheel}
                            onTouchStart={onTouchStart}
                            onTouchEnd={onTouchEnd}
                            onClick={onLayerClick}
                        />

                        {/* Gesture hints (non-interactive). Up = follow, down = close. */}
                        <div className="pointer-events-none absolute inset-x-0 top-5 z-10 flex flex-col items-center gap-0.5 text-white/70">
                            <ChevronUp className="size-5" />
                            <span className="text-xs font-medium tracking-wide">{followed ? "Following — you'll be notified" : "Swipe up to follow"}</span>
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex flex-col items-center gap-0.5 text-white/70">
                            <span className="text-xs font-medium tracking-wide">Swipe down to close</span>
                            <ChevronDown className="size-5" />
                        </div>

                        {/* Our own control bar (native YouTube controls are hidden). No quality/subtitle menu —
                            YouTube's API can't honor either on a controls:0 embed (see the note at the top). */}
                        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-10 pb-4 text-white">
                            <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="rounded p-1 transition-colors hover:bg-white/15">
                                {playing ? <Pause className="size-5" /> : <Play className="size-5 fill-current" />}
                            </button>
                            <span className="w-10 text-right text-xs tabular-nums text-white/80">{fmtTime(cur)}</span>
                            <input
                                type="range"
                                min={0}
                                max={dur || 0}
                                step="any"
                                value={Math.min(cur, dur || 0)}
                                onChange={onSeek}
                                onPointerDown={() => (draggingRef.current = true)}
                                onPointerUp={() => (draggingRef.current = false)}
                                onPointerCancel={() => (draggingRef.current = false)}
                                aria-label="Seek"
                                className="h-1 flex-1 cursor-pointer accent-primary"
                            />
                            <span className="w-10 text-xs tabular-nums text-white/80">{fmtTime(dur)}</span>
                            <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="rounded p-1 transition-colors hover:bg-white/15">
                                {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                            </button>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={muted ? 0 : vol}
                                onChange={onVolume}
                                onPointerDown={() => (draggingRef.current = true)}
                                onPointerUp={() => (draggingRef.current = false)}
                                onPointerCancel={() => (draggingRef.current = false)}
                                aria-label="Volume"
                                className="h-1 w-16 cursor-pointer accent-primary sm:w-20"
                            />
                            <button type="button" onClick={toggleFs} aria-label={isFs ? "Exit fullscreen" : "Fullscreen"} className="rounded p-1 transition-colors hover:bg-white/15">
                                {isFs ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
                            </button>
                        </div>

                        {/* Profile picker — which profiles to apply the follow to (rendered INSIDE the stage so
                            it's visible in fullscreen; a body-portaled popover would not be). The current
                            profile is preselected and locked; others toggle. */}
                        {pickerOpen && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6" onClick={() => setPickerOpen(false)}>
                                <div className="w-full max-w-sm rounded-2xl bg-zinc-900/95 p-5 text-white shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
                                    <h3 className="text-base font-semibold">Follow on which profiles?</h3>
                                    <p className="mt-1 text-xs text-white/60">We'll notify the selected profiles about new releases for {title}.</p>
                                    <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
                                        {profiles.map((p) => {
                                            const isCurrent = activeProfile?.id === p.id
                                            const checked = isCurrent || picked.has(p.id)
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    disabled={isCurrent}
                                                    onClick={() =>
                                                        setPicked((prev) => {
                                                            const next = new Set(prev)
                                                            if (next.has(p.id)) next.delete(p.id)
                                                            else next.add(p.id)
                                                            return next
                                                        })
                                                    }
                                                    className={cn(
                                                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                                                        checked ? "bg-primary/20" : "hover:bg-white/10",
                                                        isCurrent ? "cursor-default" : "cursor-pointer"
                                                    )}
                                                >
                                                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", checked ? "border-primary bg-primary text-primary-foreground" : "border-white/30")}>
                                                        {checked && <Check className="size-3.5" />}
                                                    </span>
                                                    <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                                                    {isCurrent && <span className="text-[10px] font-medium tracking-wide text-white/45 uppercase">Current</span>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <div className="mt-5 flex justify-end gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => setPickerOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button size="sm" onClick={() => void applyFollow(Array.from(new Set([...(activeProfile ? [activeProfile.id] : []), ...picked])))}>
                                            Follow
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>,
                    document.body
                )}
        </>
    )
}
