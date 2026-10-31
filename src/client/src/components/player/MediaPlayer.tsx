import React, { useEffect, useRef, useState } from "react"
import Hls from "hls.js"
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

export function MediaPlayer() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const hlsRef = useRef<Hls | null>(null)

    const { media, isPlaying, isLoading, currentTime, duration, volume, isMuted, setIsPlaying, setIsLoading, setCurrentTime, setDuration, setVolume, setIsMuted, setError } = usePlayerState()
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
    const [qualities, setQualities] = useState<
        {
            index: number
            height: number
            label: string
        }[]
    >([])

    const [currentQuality, setCurrentQuality] = useState(-1)

    const controlsTimeoutRef = useRef<number | null>(null)

    const selectedSource = media?.playback.selectedSource

    // Initialize HLS or Native Video
    useEffect(() => {
        const video = videoRef.current
        if (!video || !selectedSource) return

        setIsLoading(true)

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
    }, [selectedSource, setError, setIsLoading, setIsPlaying])

    // Apply the selected audio track to the <video> element (OMSS only gives the track list; the
    // player stored the choice without applying it). For a multi-audio mp4, HTMLMediaElement exposes
    // `video.audioTracks` (Safari) whose `.enabled` flag switches the active track. Match by language
    // code, falling back to the OMSS list index. Skip when the target is already active (the load-time
    // default) so we never toggle `.enabled` needlessly. No-op when the element exposes <=1 track.
    useEffect(() => {
        const video = videoRef.current as (HTMLVideoElement & { audioTracks?: any }) | null
        if (!video || !selectedAudioTrack) return
        const apply = () => {
            const list = video.audioTracks
            if (!list || list.length <= 1) return
            const want = (selectedAudioTrack.language ?? "").toLowerCase()
            let target = -1
            if (want) {
                for (let i = 0; i < list.length; i++) {
                    const l = (list[i].language ?? "").toLowerCase()
                    if (l && (l === want || l.slice(0, 2) === want.slice(0, 2))) { target = i; break }
                }
            }
            if (target < 0) {
                const idx = audioTracks.findIndex(
                    (t) => t.language === selectedAudioTrack.language && t.label === selectedAudioTrack.label)
                if (idx >= 0 && idx < list.length) target = idx
            }
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
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime)
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
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000)
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

    return (
        <div ref={containerRef} className="group relative h-screen w-full overflow-hidden" onMouseMove={handleMouseMove} onMouseLeave={() => setShowControls(false)}>
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
                onWheel={(e: React.WheelEvent<HTMLDivElement>) => {
                    // scroll up = increase volume
                    const delta = -e.deltaY * 0.001

                    const newVolume = Math.max(0, Math.min(1, volume + delta))

                    setVolume(newVolume)

                    if (newVolume === 0) {
                        setIsMuted(true)
                    } else if (isMuted) {
                        setIsMuted(false)
                    }
                }}
                currentTime={currentTime}
                onDivClick={togglePlay}
                duration={duration}
                volume={volume}
                isMuted={isMuted}
                isFullscreen={isFullscreen}
                onTogglePlay={togglePlay}
                onSeek={handleSeek}
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

            <EpisodeAutoplayOverlay
                show={showAutoplay}
                onNext={() => {
                    setShowAutoplay(false)
                    handleEpisodeEnded()
                }}
                onCancel={() => setShowAutoplay(false)}
            />
        </div>
    )
}
