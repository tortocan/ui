import { ArrowLeft, Play, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useOmss } from "@/hooks/use-omss"
import { Button } from "@/components/ui/button"
import { TitleCardContent } from "@/components/media/TitleCardContent.tsx"
import { useMediaDetails } from "./hooks/useMediaDetails"
import { MediaCast } from "./MediaCast"
import { MediaEpisodes } from "./MediaEpisodes"
import { MediaRecommendations } from "./MediaRecommendations"
import { TrailerDialog } from "./TrailerDialog"
import type { MediaDrawerPayload } from "./types/drawer.types"
import { formatRuntime } from "@/components/media/drawer/mappers/media.mapper.ts"
import { cn } from "@/lib/utils.ts"
import { useNavigate } from "react-router-dom"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer.ts"

interface MediaDrawerProps {
    payload: MediaDrawerPayload
    canGoBack: boolean
    isOpen: boolean
    className?: string
}

export function MediaDrawer({ payload, canGoBack, isOpen, className }: MediaDrawerProps) {
    const { data, isLoading } = useMediaDetails(payload.type, payload.id)
    const { closeAll, close } = useMediaDrawer()

    const navigate = useNavigate()

    // Turn Play into "Resume" from the scrobbler. For a movie: the stored position → "Resume · {time}".
    // For a show: the in-progress episode, else the earliest unwatched episode → "Resume · S{s}E{e}",
    // and Play navigates straight to that episode.
    const { client, valid } = useOmss()
    const [resume, setResume] = useState<{ label: string; season?: number; episode?: number } | null>(null)

    useEffect(() => {
        let cancelled = false
        setResume(null)
        if (!data || !valid) return

        // The backend owns the continue-watching decision; the client just asks and presents it.
        void client.getResume(data.type, Number(data.id)).then(({ data: rt }) => {
            if (cancelled || !rt || !rt.resumable) return
            if (rt.mediaType === "movie") {
                setResume({ label: "Resume" })
            } else {
                setResume({ label: `Resume · S${rt.season}E${rt.episode}`, season: rt.season, episode: rt.episode })
            }
        })

        return () => {
            cancelled = true
        }
    }, [client, valid, data])

    const handlePlay = () => {
        if (!data) return

        const path = payload.type === "movie" ? `/watch/movie/${data.id}` : resume?.episode != null ? `/watch/tv/${data.id}/?s=${resume.season}&e=${resume.episode}` : `/watch/tv/${data.id}`

        closeAll()

        requestAnimationFrame(() => {
            navigate(path)
        })
    }

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && closeAll()}>
            <DrawerContent
                className={cn("lenis-stopped lenis-disabled inset-0 mt-0 h-full max-h-none! max-w-none rounded-none! border-0! bg-black pt-0 outline-none", className)}
                data-lenis-prevent="true"
                // The drawer is full-screen (nothing to click "outside"); don't let an outside pointer/focus
                // interaction (e.g. focus entering the trailer's YouTube iframe) dismiss it.
                onInteractOutside={(e) => e.preventDefault()}
                headerActions={
                    canGoBack && (
                        <Button variant="outline" size="icon" onClick={close}>
                            <span className="sr-only">Back</span>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )
                }
            >
                <DrawerHeader className="sr-only">
                    <DrawerTitle>Media Drawer</DrawerTitle>
                    <DrawerDescription>Content below</DrawerDescription>
                </DrawerHeader>

                {isLoading ? (
                    <MediaDrawerSkeleton />
                ) : !data ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Failed to load media details.</div>
                ) : (
                    <div className="relative h-full overflow-y-auto">
                        {/* STICKY HERO */}
                        <div className="sticky top-0 h-screen w-full">
                            {data.backdropUrl ? (
                                <img src={data.backdropUrl} alt={`${data.title} backdrop`} draggable={false} className="h-full w-full object-cover object-top" />
                            ) : (
                                <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">No backdrop available</div>
                            )}

                            {/* MULTI-LAYER OVERLAY */}
                            <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.45)_35%,rgba(0,0,0,0.75)_100%)]" />
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(0,0,0,0)_0%,rgba(0,0,0,0.4)_100%)]" />
                        </div>

                        {/* CONTENT */}
                        <div className="relative z-20 -mt-[45vh] px-4 pb-10 text-white md:px-8">
                            {/* Shared title header (logo + chips + Play/Trailer + description) — same as the hero card. */}
                            <div className="mb-8 animate-in duration-700 fade-in">
                                <TitleCardContent
                                    logoUrl={data.logoUrl}
                                    title={data.title}
                                    rating={data.rating}
                                    date={data.releaseDate}
                                    meta={data.runtime ? formatRuntime(data.runtime) : null}
                                    genres={data.genres}
                                    description={data.overview}
                                    logoClassName="mb-1 h-auto w-full max-w-[70%] object-contain drop-shadow-2xl md:max-w-[40%]"
                                    onPlay={handlePlay}
                                    playLabel={
                                        resume ? (
                                            <>
                                                <RotateCcw className="size-5" />
                                                {resume.label}
                                            </>
                                        ) : (
                                            <>
                                                <Play className="size-5 fill-white" />
                                                Play
                                            </>
                                        )
                                    }
                                    secondary={<TrailerDialog trailerId={data.trailer} title={data.title} mediaType={data.type} tmdbId={Number(data.id)} />}
                                />
                            </div>

                            {/* TV EPISODES */}
                            {data.type === "tv" && data.seasons && (
                                <div className="mb-8">
                                    <MediaEpisodes tvId={data.id} seasons={data.seasons} />
                                </div>
                            )}

                            {/* CAST */}
                            <div className="mb-8">
                                <MediaCast cast={data.cast} />
                            </div>

                            {/* RECOMMENDATIONS */}
                            <div>
                                <MediaRecommendations recommendations={data.recommendations} />
                            </div>
                        </div>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}

function MediaDrawerSkeleton() {
    return (
        <div className="relative h-full overflow-y-auto bg-black">
            {/* STICKY HERO */}
            <div className="sticky top-0 h-screen w-full">
                <div className="absolute inset-0 animate-pulse bg-muted" />
                <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />
            </div>

            {/* CONTENT */}
            <div className="relative z-20 -mt-[45vh] px-4 pb-10 md:px-8">
                <div className="mb-5 h-12 w-[40%] animate-pulse rounded-md bg-muted" />

                <div className="mb-5 flex flex-wrap gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-muted" />
                    ))}
                </div>

                <div className="mb-6 flex gap-2">
                    <div className="h-10 w-28 animate-pulse rounded-full bg-muted" />
                    <div className="h-10 w-28 animate-pulse rounded-full bg-muted" />
                    <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                </div>

                <div className="max-w-2xl space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-[80%] animate-pulse rounded bg-muted" />
                </div>
            </div>
        </div>
    )
}
