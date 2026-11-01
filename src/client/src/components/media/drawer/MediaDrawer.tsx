import { ArrowLeft, Languages, Play, RotateCcw } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useOmss } from "@/hooks/use-omss"
import { useAppSettings, tmdbLanguageFor } from "@/hooks/use-appsettings"
import { useTmdbLanguages } from "@/hooks/use-tmdb-languages"
import { Button } from "@/components/ui/button"
import { MediaHeroCard } from "@/components/media/MediaHeroCard.tsx"
import { CHIP } from "@/components/media/TitleCardContent.tsx"
import { useMediaDetails } from "./hooks/useMediaDetails"
import { MediaCast } from "./MediaCast"
import { MediaCollection } from "./MediaCollection"
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
    const { locale } = useAppSettings()
    const { labelOf } = useTmdbLanguages()
    // Toggle the displayed metadata between the profile (first) language and the title's original one.
    const [showOriginal, setShowOriginal] = useState(false)
    // The original-language code is known from the first (profile-language) fetch; feed it back when toggled.
    const [originalLang, setOriginalLang] = useState<string | null>(null)
    const { data, isLoading } = useMediaDetails(payload.type, payload.id, showOriginal && originalLang ? tmdbLanguageFor(originalLang) : undefined)
    const { closeAll, close } = useMediaDrawer()

    const navigate = useNavigate()

    // Swipe/scroll UP to close — but only when the body is already at the top, so it never fights
    // normal downward scrolling through the episodes/cast/recommendations. Wheel covers a trackpad
    // two-finger swipe; touch covers a finger flick.
    const swipeRef = useRef<{ y: number; atTop: boolean } | null>(null)
    // Swipe DOWN to close (same as the trailer modal). Gated to scrollTop <= 0 so it's a pull-down
    // overscroll dismiss, never fighting normal scrolling. Wheel: deltaY < -24 (a physical down-swipe
    // under Mac natural scrolling, the overscroll-at-top direction). Touch: finger moved down.
    const onBodyWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.currentTarget.scrollTop <= 0 && e.deltaY < -24) closeAll()
    }
    const onBodyTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        swipeRef.current = { y: e.touches[0]?.clientY ?? 0, atTop: e.currentTarget.scrollTop <= 0 }
    }
    const onBodyTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        const start = swipeRef.current
        swipeRef.current = null
        if (!start || !start.atTop) return
        const end = e.changedTouches[0]?.clientY
        if (end != null && end - start.y > 60) closeAll()
    }

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
        // Keyed on the stable title identity (not the whole `data` object) so a language toggle — which
        // produces a new data ref but the same title — doesn't re-run this and flicker the Play button.
    }, [client, valid, data?.type, data?.id])

    // Remember the title's original language from the (profile-language) fetch so the toggle can request it.
    useEffect(() => {
        if (data?.originalLanguage) setOriginalLang(data.originalLanguage)
    }, [data?.originalLanguage])

    // The original-language toggle chip — only when the original differs from the profile language.
    // Green (profile accent) while the original is showing; a plain chip otherwise.
    const canToggleLang = !!originalLang && originalLang !== locale
    const langChip = canToggleLang ? (
        <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            disabled={isLoading}
            title={showOriginal ? "Showing the original language — click for your language" : "Show the original language"}
            className={cn(CHIP, "transition-colors", showOriginal ? "border-primary/60 bg-primary/25" : "hover:bg-white/20", isLoading && "opacity-60")}
        >
            <Languages className="size-4 opacity-80" />
            {labelOf(originalLang!)}
        </button>
    ) : null

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

                {/* Only skeleton the INITIAL load (no data yet). A language-toggle refetch keeps the
                    current content mounted — avoids a full-screen skeleton flash + hero re-animation. */}
                {isLoading && !data ? (
                    <MediaDrawerSkeleton />
                ) : !data ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Failed to load media details.</div>
                ) : (
                    <div className="relative h-full overflow-y-auto" onWheel={onBodyWheel} onTouchStart={onBodyTouchStart} onTouchEnd={onBodyTouchEnd}>
                        {/* HERO — the same card the home carousel renders per slide (logo + chips +
                            Play/Trailer + description over the backdrop), so the two stay identical. */}
                        <MediaHeroCard
                            image={data.backdropUrl}
                            logoUrl={data.logoUrl}
                            title={data.title}
                            rating={data.rating}
                            date={data.releaseDate}
                            meta={data.runtime ? formatRuntime(data.runtime) : null}
                            genres={data.genres}
                            tags={data.collection ? ["Collection"] : undefined}
                            actionChips={langChip}
                            description={data.overview}
                            networkLogo={data.networkLogo}
                            studioLogo={data.studioLogo}
                            heightClassName="h-screen"
                            className="animate-in duration-700 fade-in"
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

                        {/* DETAIL SECTIONS — float ~10% up over the hero card's bottom, exactly like the
                            BrowseLayout content float (same -mt + a p-8-style top padding), so the hero shows
                            through the overlap (no black gap) while the first section keeps breathing room
                            below the hero's Play/Trailer buttons instead of hugging them. */}
                        <div className="relative z-20 -mt-[8vh] px-4 pt-8 pb-10 text-white md:-mt-[10vh] md:px-8">
                            {/* TV EPISODES */}
                            {data.type === "tv" && data.seasons && (
                                <div className="mb-8">
                                    <MediaEpisodes tvId={data.id} seasons={data.seasons} />
                                </div>
                            )}

                            {/* COLLECTION — the rest of the franchise, above Top Cast. */}
                            {data.collection && (
                                <div className="mb-8">
                                    <MediaCollection collectionId={data.collection.id} name={data.collection.name} currentId={Number(data.id)} />
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
