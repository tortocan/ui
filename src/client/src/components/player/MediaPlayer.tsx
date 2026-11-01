import React, { useCallback, useEffect, useRef, useState } from "react"
import Hls from "hls.js"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePlayerState } from "./hooks/usePlayerState"
import { PlayerControls } from "./PlayerControls"
import { LoadingState } from "./LoadingState"
import { useEpisodeAutoplay } from "./hooks/useEpisodeAutoplay"
import { EpisodeAutoplayOverlay } from "./EpisodeAutoplayOverlay"
import { useSubtitles } from "@/components/player/hooks/useSubtitles.ts"
import { useAudioTracks } from "@/components/player/hooks/useAudioTracks.ts"
import { useScrobble } from "@/components/player/hooks/useScrobble.ts"
import { CustomSubtitles } from "@/components/player/CustomSubtitles"
import { useSeekPreviewVideo } from "./hooks/useSeekPreviewVideo"
import { useThumbnailSprites } from "./hooks/useThumbnailSprites"
import { TranscodingNotice } from "./TranscodingNotice"
import { ErrorState } from "./ErrorState"

export function MediaPlayer() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const hlsRef = useRef<Hls | null>(null)

    const { media, isPlaying, isLoading, currentTime, duration, volume, isMuted, error, setIsPlaying, setIsLoading, setCurrentTime, setDuration, setVolume, setIsMuted, setError } = usePlayerState()
    const { t } = useTranslation("player")

    const { handleEpisodeEnded } = useEpisodeAutoplay()
    const { selectedSubtitle } = useSubtitles()
    const { audioTracks, selectedAudioTrack } = useAudioTracks()

    // Resume playback from gatearr's local scrobbler, and report start/pause/stop/progress back to it.
    useScrobble(videoRef, media)

    const [showControls, setShowControls] = useState(true)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showAutoplay, setShowAutoplay] = useState(false)
    const [isPiP, setIsPiP] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)
    // Bumped by "Try Again" to re-run the source-init effect (re-attach HLS / reload the <video>).
    const [reloadNonce, setReloadNonce] = useState(0)

    // Swipe DOWN to close the player (back), like the trailer modal. The old swipe up/down → volume
    // binding is removed. Wheel deltaY < -24 is a physical down-swipe under Mac natural scrolling; the
    // controls bar stops wheel propagation so scrolling it never closes. Touch: a finger-down swipe.
    const navigate = useNavigate()
    const closeTouchStartY = useRef<number | null>(null)
    const closePlayer = () => navigate(-1)
    const onPlayerWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.deltaY < -24) closePlayer()
    }
    const onPlayerTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        closeTouchStartY.current = e.touches[0]?.clientY ?? null
    }
    const onPlayerTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        const start = closeTouchStartY.current
        closeTouchStartY.current = null
        const end = e.changedTouches[0]?.clientY
        if (start != null && end != null && end - start > 60) closePlayer()
    }
    const [qualities, setQualities] = useState<
        {
            index: number
            height: number
            label: string
        }[]
    >([])

    const [currentQuality, setCurrentQuality] = useState(-1)
    const [buffered, setBuffered] = useState(0)
    const scrubbingRef = useRef(false) // a scrub is in flight — freeze the controls-autohide timer

    const controlsTimeoutRef = useRef<number | null>(null)

    const selectedSource = media?.playback.selectedSource

    // Seek-preview: backend sprite sheet (instant) when available, else the client-side frame engine.
    const { attach: previewAttach, seekTo: previewSeekTo, status: previewStatus } = useSeekPreviewVideo(selectedSource)
    const { spriteAt, ensureLoaded: ensureThumbs } = useThumbnailSprites(selectedSource)

    // Initialize HLS or Native Video
    useEffect(() => {
        const video = videoRef.current
        if (!video || !selectedSource) return

        setIsLoading(true)
        setError(undefined) // clear any prior fatal error when (re)attaching a source

        if (selectedSource.type === "hls") {
            if (Hls.isSupported()) {
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: false,
                })
                hls.loadSource(selectedSource.url)
                hls.attachMedia(video)
                hlsRef.current = hls

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    void video.play().catch(() => {}) // autoplay when ready; onPlay syncs isPlaying
                    const levels = hls.levels.map((level, index) => ({
                        index,
                        height: level.height,
                        label: `${level.height}p`,
                    }))

                    setQualities(levels)
                    setIsLoading(false)
                })

                hls.on(Hls.Events.ERROR, (_, data) => {
                    if (data.fatal) {
                        setError(`HLS Fatal Error: ${data.type}`)
                    }
                })
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = selectedSource.url
            }
        } else {
            video.src = selectedSource.url
            // Autoplay once the source is set; onPlay syncs isPlaying. If the browser's autoplay
            // policy blocks it (no user activation), it stays paused and the user presses play.
            void video.play().catch(() => {})
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy()
                hlsRef.current = null
            }
        }
    }, [selectedSource, reloadNonce, setError, setIsLoading, setIsPlaying])

    // Apply the selected audio track. HLS (hls.js / MSE) is the primary source type and does NOT populate
    // HTMLMediaElement.audioTracks in Chrome/Firefox, so switching must go through the hls.js API
    // (hls.audioTrack). Fall back to the HTMLMediaElement list (.enabled) for a multi-audio mp4 / Safari
    // native HLS. Match by language code, else the OMSS list index; skip when the target is already active.
    useEffect(() => {
        const video = videoRef.current as (HTMLVideoElement & { audioTracks?: any }) | null
        if (!video || !selectedAudioTrack) return

        const matchIndex = (langs: (string | undefined)[], count: number): number => {
            const want = (selectedAudioTrack.language ?? "").toLowerCase()
            if (want) {
                for (let i = 0; i < count; i++) {
                    const l = (langs[i] ?? "").toLowerCase()
                    if (l && (l === want || l.slice(0, 2) === want.slice(0, 2))) return i
                }
            }
            const idx = audioTracks.findIndex((t) => t.language === selectedAudioTrack.language && t.label === selectedAudioTrack.label)
            return idx >= 0 && idx < count ? idx : -1
        }

        const apply = () => {
            const hls = hlsRef.current
            if (hls && hls.audioTracks && hls.audioTracks.length > 1) {
                const target = matchIndex(
                    hls.audioTracks.map((t) => t.lang),
                    hls.audioTracks.length
                )
                if (target >= 0 && hls.audioTrack !== target) hls.audioTrack = target
                return
            }
            const list = video.audioTracks
            if (!list || list.length <= 1) return
            const target = matchIndex(
                Array.from({ length: list.length }, (_, i) => list[i].language as string | undefined),
                list.length
            )
            if (target < 0 || list[target].enabled) return
            for (let i = 0; i < list.length; i++) list[i].enabled = i === target
        }

        apply()
        video.addEventListener("loadedmetadata", apply)
        return () => video.removeEventListener("loadedmetadata", apply)
    }, [selectedAudioTrack, audioTracks, selectedSource])

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate
        }
    }, [playbackRate])

    // Sync isPlaying state
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        if (isPlaying) {
            video.play().catch(() => setIsPlaying(false))
        } else {
            video.pause()
        }
    }, [isPlaying, setIsPlaying])

    // Sync volume/mute to video element
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = isMuted ? 0 : volume
            videoRef.current.muted = isMuted
        }
    }, [volume, isMuted])

    useEffect(() => {
        const video = videoRef.current

        if (!video) return

        const handleEnterPiP = () => setIsPiP(true)
        const handleLeavePiP = () => setIsPiP(false)

        video.addEventListener("enterpictureinpicture", handleEnterPiP)
        video.addEventListener("leavepictureinpicture", handleLeavePiP)

        return () => {
            video.removeEventListener("enterpictureinpicture", handleEnterPiP)
            video.removeEventListener("leavepictureinpicture", handleLeavePiP)
        }
    }, [])

    const handleTimeUpdate = () => {
        const video = videoRef.current
        if (video) {
            setCurrentTime(video.currentTime)
            const b = video.buffered
            if (b.length) setBuffered(b.end(b.length - 1))
        }
    }

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration)
            setIsLoading(false)
        }
    }

    const handleEnded = () => {
        setIsPlaying(false)
        if (media?.type === "tv" && media.episodeNumber !== undefined) {
            setShowAutoplay(true)
        }
    }

    const handleMouseMove = () => {
        setShowControls(true)
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
        if (scrubbingRef.current) return // don't re-arm the autohide while a scrub is in flight
        controlsTimeoutRef.current = window.setTimeout(() => setShowControls(false), 3000)
    }

    // A scrub pauses the controls-autohide (touch drags emit no mousemove, so the timer must be frozen).
    const handleScrubbingChange = (active: boolean) => {
        scrubbingRef.current = active
        if (active) {
            setShowControls(true)
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
        } else {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
            controlsTimeoutRef.current = window.setTimeout(() => setShowControls(false), 3000)
        }
    }

    // Drive play()/pause() DIRECTLY from the click so it runs inside the user-gesture activation.
    // Safari blocks an unmuted play() that happens later in a useEffect (outside the gesture), which
    // made the first play click get swallowed and require a second click. The isPlaying effect still
    // syncs programmatic toggles (keyboard, autoplay-next).
    const togglePlay = () => {
        const video = videoRef.current
        if (!video) {
            setIsPlaying(!isPlaying)
            return
        }
        if (video.paused) {
            setIsPlaying(true)
            void video.play().catch(() => setIsPlaying(false))
        } else {
            setIsPlaying(false)
            video.pause()
        }
    }

    const handleSeek = (val: number[]) => {
        if (videoRef.current) {
            videoRef.current.currentTime = val[0]
            setCurrentTime(val[0])
        }
    }

    const togglePictureInPicture = async () => {
        const video = videoRef.current

        if (!video) return

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture()
                setIsPiP(false)
            } else {
                await video.requestPictureInPicture()
                setIsPiP(true)
            }
        } catch (err) {
            console.error("PiP failed:", err)
        }
    }

    const handleQualityChange = (level: number) => {
        if (!hlsRef.current) return

        hlsRef.current.currentLevel = level
        setCurrentQuality(level)
    }

    const toggleMute = () => setIsMuted(!isMuted)

    const handleVolumeChange = (val: number[]) => {
        setVolume(val[0])
        if (val[0] === 0) {
            setIsMuted(true)
        } else if (isMuted) {
            setIsMuted(false)
        }
    }

    const toggleFullscreen = () => {
        if (!containerRef.current) return
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    const handleRetry = () => setReloadNonce((n) => n + 1)

    // Stable callbacks so the autoplay-next countdown effect isn't torn down + restarted (bar snaps to 0,
    // advance delayed) on unrelated re-renders — the controls auto-hide toggles state frequently.
    const handleAutoplayNext = useCallback(() => {
        setShowAutoplay(false)
        handleEpisodeEnded()
    }, [handleEpisodeEnded])
    const handleAutoplayCancel = useCallback(() => setShowAutoplay(false), [])

    if (!selectedSource)
        return (
            <LoadingState
                message={
                    <div className={"flex flex-col items-center justify-center"}>
                        <span className={"text-lg"}>{t("states.resolving")}</span>
                        <span>{t("states.resolvingSub")}</span>
                    </div>
                }
            />
        )

    // Container the browser can't decode (gatearr returns type "mkv"/"dash"). gatearr has queued it for
    // transcode on source build; show a notice + let the bell announce it instead of a silent <video> error.
    if (selectedSource.type === "mkv" || selectedSource.type === "dash")
        return <TranscodingNotice title={media?.title} container={selectedSource.type} onBack={() => navigate(-1)} />

    return (
        <div
            ref={containerRef}
            className="group relative h-screen w-full overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setShowControls(false)}
            onWheel={onPlayerWheel}
            onTouchStart={onPlayerTouchStart}
            onTouchEnd={onPlayerTouchEnd}
        >
            <video
                ref={videoRef}
                className="h-full w-full"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                onWaiting={() => setIsLoading(true)}
                onPlaying={() => setIsLoading(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={() => setError(t("states.error", "Something went wrong during playback."))}
                onClick={togglePlay}
                autoPlay
                preload="auto"
                crossOrigin="anonymous"
                poster={media?.backdropUrl.replace("w300", "original")}
                playsInline
            />

            {selectedSubtitle && <CustomSubtitles url={selectedSubtitle.url} currentTime={currentTime} />}

            {isLoading && !isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                    <LoadingState message={t("states.buffering")} />
                </div>
            )}

            <PlayerControls
                isPlaying={isPlaying}
                onDoubleClick={toggleFullscreen}
                currentTime={currentTime}
                onDivClick={togglePlay}
                duration={duration}
                buffered={buffered}
                volume={volume}
                isMuted={isMuted}
                isFullscreen={isFullscreen}
                onTogglePlay={togglePlay}
                onSeek={handleSeek}
                previewAttach={previewAttach}
                onPreviewTime={previewSeekTo}
                previewStatus={previewStatus}
                spriteAt={spriteAt}
                ensureLoaded={ensureThumbs}
                onScrubbingChange={handleScrubbingChange}
                onToggleMute={toggleMute}
                onVolumeChange={handleVolumeChange}
                onToggleFullscreen={toggleFullscreen}
                show={showControls || !isPlaying}
                ref={containerRef}
                isPiP={isPiP}
                onTogglePiP={togglePictureInPicture}
                playbackRate={playbackRate}
                onPlaybackRateChange={setPlaybackRate}
                qualities={qualities}
                currentQuality={currentQuality}
                onQualityChange={handleQualityChange}
            />

            <EpisodeAutoplayOverlay show={showAutoplay} onNext={handleAutoplayNext} onCancel={handleAutoplayCancel} />

            {error && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95">
                    <ErrorState error={error} onRetry={handleRetry} />
                </div>
            )}
        </div>
    )
}
