import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Captions, Check, ChevronDown, ChevronUp, Clapperboard, Film, Maximize, Minimize, Pause, Play, Settings, Volume2, VolumeX } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useOmss } from "@/hooks/use-omss"
import { cn } from "@/lib/utils"

// Human labels for YouTube's quality-level tokens (getAvailableQualityLevels / getPlaybackQuality).
const QUALITY_LABELS: Record<string, string> = {
    highres: "Highres",
    hd2160: "2160p",
    hd1440: "1440p",
    hd1080: "1080p",
    hd720: "720p",
    large: "480p",
    medium: "360p",
    small: "240p",
    tiny: "144p",
}
const qualityLabel = (level: string) => QUALITY_LABELS[level] ?? level

/**
 * A caption LANGUAGE for the menu. On a controls:0 youtube-nocookie player the captions-MODULE
 * track API (setOption/getOption 'captions','track') is inert — it never shows or switches captions.
 * The reliable lever is the `cc_load_policy` + `cc_lang_pref` player vars, which address a LANGUAGE,
 * so the menu is one entry per language (not per raw track).
 */
interface CaptionLang {
    code: string // languageCode → cc_lang_pref value (e.g. "en", "en-US")
    label: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCaptionLangs(raw: any[]): CaptionLang[] {
    const seen = new Set<string>()
    const out: CaptionLang[] = []
    for (const t of raw) {
        if (!t || t.is_servable === false) continue
        const code = (t.languageCode ?? "").toString().trim()
        if (!code || seen.has(code)) continue // one entry per language (cc_lang_pref can't target a specific track)
        seen.add(code)
        const label = (t.languageName || t.displayName || code).toString()
        out.push({ code, label })
    }
    out.sort((a, b) => a.label.localeCompare(b.label))
    return out
}

// Load the YouTube IFrame Player API once (shared across every TrailerDialog instance). We need the
// JS API (not a bare iframe) so we drive playback ourselves: our own controls + swipe gestures over a
// full-area layer (YouTube's native controls are hidden), autoplay with a muted fallback, auto-close.
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
}

/** How a player instance should be (re)built — captured so caption switching can recreate it verbatim. */
interface BuildOpts {
    ccLang: string | null // cc_lang_pref (null = captions off)
    startSeconds: number
    play: boolean
    muted: boolean
    vol: number
}

export const TrailerDialog: React.FC<TrailerDialogProps> = ({ trailerId, title, mediaType, tmdbId }) => {
    const [active, setActive] = useState(false)
    const [followed, setFollowed] = useState(false)
    // Custom-control state, polled from the player.
    const [playing, setPlaying] = useState(false)
    const [muted, setMuted] = useState(false)
    const [cur, setCur] = useState(0)
    const [dur, setDur] = useState(0)
    const [isFs, setIsFs] = useState(false)
    // Settings menu (quality + subtitles) — YouTube exposes no audio-track API, so there's no audio tab.
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [settingsTab, setSettingsTab] = useState<"quality" | "subtitles">("quality")
    const [levels, setLevels] = useState<string[]>([]) // available quality tokens (minus "auto")
    const [quality, setQuality] = useState("auto") // current playback quality token
    const [tracks, setTracks] = useState<CaptionLang[]>([]) // available caption languages
    const [capLang, setCapLang] = useState<string | null>(null) // selected caption language, or null = off

    const stageRef = useRef<HTMLDivElement>(null) // the fullscreen target / full-viewport overlay
    const hostRef = useRef<HTMLDivElement>(null) // YT replaces an imperative child of this with its iframe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerRef = useRef<any>(null)
    const pollRef = useRef(0) // the state-poll interval id (cleared across recreate + on teardown)
    const curTimeRef = useRef(0) // latest position, so a caption-switch recreate resumes seamlessly
    const capLangRef = useRef<string | null>(null) // mirror of capLang for the (re)build closure
    const qualityPrefRef = useRef<string | null>(null) // user-chosen quality, re-applied across recreates
    const qualitySetRef = useRef(false)
    const draggingRef = useRef(false) // a slider (seek/volume) is being dragged — don't let the poll fight it
    const [vol, setVol] = useState(100) // player volume 0–100
    const { client, valid } = useOmss()

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

    // Pick a quality level. "auto" lets YouTube adapt ("default" token); otherwise nudge to that level
    // (setPlaybackQuality is deprecated but still the only lever; YT may still adapt down to bandwidth).
    // Remembered in qualityPrefRef so it survives the caption-switch recreate below.
    const selectQuality = useCallback((level: string) => {
        qualityPrefRef.current = level === "auto" ? null : level
        const p = playerRef.current
        try {
            p?.setPlaybackQuality?.(level === "auto" ? "default" : level)
        } catch {
            /* deprecated API — best-effort only */
        }
        setQuality(level)
    }, [])

    // Read the caption tracklist (only valid after onApiChange) and populate the menu; retry a few times
    // because the list can lag the module load. identity/selection is by LANGUAGE (cc_lang_pref), see above.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readTracks = useCallback((target: any, tries: number) => {
        if (target !== playerRef.current) return // player was replaced/destroyed — abandon this retry chain
        try {
            target.loadModule?.("captions")
            const tl = target.getOption?.("captions", "tracklist")
            if (Array.isArray(tl) && tl.length) {
                setTracks(normalizeCaptionLangs(tl))
                return
            }
        } catch {
            /* module not ready */
        }
        if (tries > 0) window.setTimeout(() => readTracks(target, tries - 1), 700)
    }, [])

    // (Re)build the YouTube player. The captions-module track API is inert on our controls:0 nocookie
    // embed, so captions are driven by the cc_load_policy/cc_lang_pref player vars — which are only read
    // at construction. Switching caption language therefore recreates the player, resuming at startSeconds.
    const buildPlayer = useCallback(
        (opts: BuildOpts) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const YT = (window as any).YT
            const host = hostRef.current
            if (!YT?.Player || !host) return

            // Tear down any existing player + poll first (recreate path).
            if (pollRef.current) {
                window.clearInterval(pollRef.current)
                pollRef.current = 0
            }
            try {
                playerRef.current?.destroy?.()
            } catch {
                /* already gone */
            }
            playerRef.current = null
            host.innerHTML = ""
            qualitySetRef.current = false

            // Give YT an imperative child (NOT a React-managed node) so unmount never collides with YT's DOM surgery.
            const mount = document.createElement("div")
            mount.style.width = "100%"
            mount.style.height = "100%"
            host.appendChild(mount)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const playerVars: any = {
                autoplay: opts.play ? 1 : 0,
                controls: 0, // hidden — we render our own control bar + full-area gesture/tap layer
                disablekb: 1,
                modestbranding: 1,
                rel: 0,
                iv_load_policy: 3,
                playsinline: 1,
                fs: 0,
                vq: "hd1080", // hint YouTube to start at HD (it still auto-adapts down to bandwidth)
                origin: window.location.origin,
            }
            if (opts.startSeconds > 0) playerVars.start = Math.floor(opts.startSeconds)
            // cc_load_policy:1 forces the caption overlay ON (independent of the control bar, so it shows
            // with controls:0); cc_lang_pref selects the language. Omitted → captions off.
            if (opts.ccLang) {
                playerVars.cc_load_policy = 1
                playerVars.cc_lang_pref = opts.ccLang
            }

            playerRef.current = new YT.Player(mount, {
                host: "https://www.youtube-nocookie.com",
                width: "100%",
                height: "100%",
                videoId: trailerId ?? undefined,
                playerVars,
                events: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onReady: (e: any) => {
                        if (e.target !== playerRef.current) return // superseded by a newer build — don't start a poll or touch state
                        if (!trailerId) e.target.loadPlaylist({ listType: "search", list: `${title} trailer`, index: 0 })
                        if (opts.muted) e.target.mute()
                        if (typeof opts.vol === "number") e.target.setVolume(opts.vol)
                        if (opts.play) e.target.playVideo()
                        readTracks(e.target, 6)
                        // Autoplay fallback: if sound-autoplay is blocked, mute and retry so it still plays.
                        window.setTimeout(() => {
                            try {
                                const s = e.target.getPlayerState?.()
                                if (opts.play && s !== 1 && s !== 3) {
                                    e.target.mute()
                                    e.target.playVideo()
                                }
                            } catch {
                                /* ignore */
                            }
                        }, 1200)
                        // Poll PLAYBACK state only (time/duration/state/mute/volume/quality). We do NOT read the
                        // captions module here — its track getter is inert on this build and only clobbers state.
                        pollRef.current = window.setInterval(() => {
                            const p = playerRef.current
                            if (!p?.getDuration) return
                            try {
                                const d = p.getDuration() || 0
                                const c = p.getCurrentTime() || 0
                                curTimeRef.current = c
                                setDur(d)
                                setPlaying(p.getPlayerState?.() === 1)
                                setMuted(!!p.isMuted?.())
                                // Don't fight an in-progress seek/volume drag (both write these same states).
                                if (!draggingRef.current) {
                                    setCur(c)
                                    setVol(p.getVolume?.() ?? 100) // underlying level; the slider shows 0 when muted via value=
                                }
                                // Available levels for the menu. We do NOT mirror getPlaybackQuality() into `quality`
                                // — that returns the live/adapted resolution (never "auto"), which would clobber the
                                // user's chosen preference. `quality` is set only by selectQuality (see the menu).
                                const avail: string[] = p.getAvailableQualityLevels?.() ?? []
                                setLevels(avail.filter((l) => l !== "auto"))
                            } catch {
                                /* ignore */
                            }
                        }, 250)
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onApiChange: (e: any) => {
                        // Captions-module metadata is only valid after this event — read the tracklist here.
                        readTracks(e.target, 6)
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onStateChange: (e: any) => {
                        setPlaying(e.data === 1)
                        // On first play, apply the chosen quality (or nudge to the highest; auto still adapts down).
                        if (e.data === 1 && !qualitySetRef.current) {
                            qualitySetRef.current = true
                            try {
                                if (qualityPrefRef.current) {
                                    e.target.setPlaybackQuality?.(qualityPrefRef.current)
                                } else {
                                    const ls: string[] = e.target.getAvailableQualityLevels?.() ?? []
                                    const best = ls.find((l) => l !== "auto")
                                    if (best) e.target.setPlaybackQuality?.(best)
                                }
                            } catch {
                                /* deprecated API — best-effort only */
                            }
                        }
                        if (e.data === YT.PlayerState.ENDED) close()
                    },
                },
            })
        },
        [trailerId, title, close, readTracks]
    )

    // Pick a caption language (null = off). The module track API doesn't work with controls:0, so we
    // recreate the player with cc_lang_pref set to this language and resume at the current time. The
    // selection is AUTHORITATIVE (capLang state) — nothing reads it back from the player to overwrite it.
    const selectCaption = useCallback(
        (code: string | null) => {
            setCapLang(code)
            capLangRef.current = code
            const p = playerRef.current
            const start = p?.getCurrentTime?.() ?? curTimeRef.current ?? 0
            const wasMuted = !!p?.isMuted?.()
            const curVol = p?.getVolume?.() ?? 100
            const play = p?.getPlayerState?.() !== 2 // keep playing unless currently paused
            buildPlayer({ ccLang: code, startSeconds: start, play, muted: wasMuted, vol: curVol })
        },
        [buildPlayer]
    )

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

    // Follow this title for new-release notifications (gatearr /follow). Guarded against re-POST.
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
        if (end - start > 60) {
            markSwipe()
            close()
        } else if (start - end > 60) {
            markSwipe()
            void doFollow()
        }
    }
    const onLayerClick = () => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
        }
        // A tap dismisses an open settings menu first; otherwise it toggles play/pause.
        if (settingsOpen) {
            setSettingsOpen(false)
            return
        }
        togglePlay()
    }

    // Launch straight into fullscreen from the click gesture (the only moment the browser grants it).
    const launch = useCallback(() => {
        setActive(true)
        setFollowed(false)
        const el = stageRef.current
        if (el) {
            el.classList.remove("hidden")
            void Promise.resolve(requestFs(el)).catch(() => {})
        }
    }, [])

    // Build the player whenever we go active; tear it down on close. Caption switching recreates it via
    // buildPlayer (outside this effect); this effect owns the initial build + listeners + teardown.
    useEffect(() => {
        if (!active) return
        let killed = false

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close()
        }
        const onFsChange = () => setIsFs(!!fsElement())
        document.addEventListener("keydown", onKey)
        document.addEventListener("fullscreenchange", onFsChange)
        document.addEventListener("webkitfullscreenchange", onFsChange)

        void loadYouTubeApi().then(() => {
            if (killed) return
            buildPlayer({ ccLang: capLangRef.current, startSeconds: 0, play: true, muted: false, vol: 100 })
        })

        return () => {
            killed = true
            if (pollRef.current) {
                window.clearInterval(pollRef.current)
                pollRef.current = 0
            }
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
            setSettingsOpen(false)
            setLevels([])
            setTracks([])
            setCapLang(null)
            capLangRef.current = null
            qualityPrefRef.current = null
            setQuality("auto")
            setVol(100)
            curTimeRef.current = 0
        }
    }, [active, trailerId, title, close, buildPlayer])

    return (
        <>
            <Button onClick={launch} variant={"outline"} className={"rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"}>
                <Film className="h-4 w-4" aria-hidden />
                <span className="ml-2 text-sm font-medium">Trailer</span>
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

                        {/* Our own control bar (native YouTube controls are hidden). */}
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
                            <button
                                type="button"
                                onClick={() => setSettingsOpen((v) => !v)}
                                aria-label="Settings"
                                aria-expanded={settingsOpen}
                                className={cn("rounded p-1 transition-colors hover:bg-white/15", settingsOpen && "bg-white/15")}
                            >
                                <Settings className="size-5" />
                            </button>
                            <button type="button" onClick={toggleFs} aria-label={isFs ? "Exit fullscreen" : "Fullscreen"} className="rounded p-1 transition-colors hover:bg-white/15">
                                {isFs ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
                            </button>
                        </div>

                        {/* Settings menu (quality + subtitles). Rendered INSIDE the stage — a portaled Radix popover
                            would be invisible while the stage is fullscreen. Sits above the gesture layer so its
                            clicks never reach play/pause. YouTube has no audio-track API, so there's no audio tab. */}
                        {settingsOpen && (
                            <div className="absolute right-4 bottom-20 z-20 w-60 overflow-hidden rounded-lg border border-white/10 bg-black/80 text-white shadow-xl backdrop-blur-md">
                                <div className="flex border-b border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setSettingsTab("quality")}
                                        className={cn(
                                            "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                                            settingsTab === "quality" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                                        )}
                                    >
                                        <Clapperboard className="size-4" /> Quality
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSettingsTab("subtitles")}
                                        className={cn(
                                            "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                                            settingsTab === "subtitles" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                                        )}
                                    >
                                        <Captions className="size-4" /> Subtitles
                                    </button>
                                </div>
                                <div className="max-h-64 overflow-y-auto p-1">
                                    {settingsTab === "quality" ? (
                                        <>
                                            <SettingRow label="Auto" selected={quality === "auto"} onClick={() => selectQuality("auto")} />
                                            {levels.map((l) => (
                                                <SettingRow key={l} label={qualityLabel(l)} selected={quality === l} onClick={() => selectQuality(l)} />
                                            ))}
                                        </>
                                    ) : (
                                        <>
                                            <SettingRow label="Off" selected={capLang === null} onClick={() => selectCaption(null)} />
                                            {tracks.length === 0 ? (
                                                <div className="px-3 py-4 text-center text-xs text-white/50">No subtitles available</div>
                                            ) : (
                                                tracks.map((t) => (
                                                    <SettingRow key={t.code} label={t.label} selected={capLang === t.code} onClick={() => selectCaption(t.code)} />
                                                ))
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>,
                    document.body
                )}
        </>
    )
}

/** One selectable row in the settings menu (quality level or caption language). */
const SettingRow: React.FC<{ label: string; selected: boolean; onClick: () => void }> = ({ label, selected, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
            selected ? "bg-primary/20 text-primary" : "text-white/80 hover:bg-white/10"
        )}
    >
        <span className="truncate">{label}</span>
        {selected && <Check className="size-4 shrink-0" />}
    </button>
)
