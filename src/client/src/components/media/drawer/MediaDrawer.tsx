import { ArrowLeft } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useAppSettings, tmdbLanguageFor } from "@/hooks/use-appsettings"
import i18n from "@/app/i18n/i18n"
import { Button } from "@/components/ui/button"
import { MediaHeroCard } from "@/components/media/MediaHeroCard.tsx"
import { useHeroActions } from "@/components/media/hooks/use-hero-actions.tsx"
import { useMediaDetails } from "./hooks/useMediaDetails"
import { MediaCast } from "./MediaCast"
import { MediaCollection } from "./MediaCollection"
import { MediaEpisodes } from "./MediaEpisodes"
import { MediaRecommendations } from "./MediaRecommendations"
import type { MediaDrawerPayload } from "./types/drawer.types"
import { formatRuntime } from "@/components/media/drawer/mappers/media.mapper.ts"
import { cn } from "@/lib/utils.ts"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer.ts"

interface MediaDrawerProps {
    payload: MediaDrawerPayload
    canGoBack: boolean
    isOpen: boolean
    className?: string
}

export function MediaDrawer({ payload, canGoBack, isOpen, className }: MediaDrawerProps) {
    const { locale, preferOriginalContent } = useAppSettings()
    // Toggle the displayed metadata between the profile (first) language and the title's original one.
    const [showOriginal, setShowOriginal] = useState(false)
    // Apply the "prefer original" setting at most once per opened title (user can still toggle after).
    const preferAppliedRef = useRef(false)
    // The original-language code is known from the first (profile-language) fetch; feed it back when toggled.
    const [originalLang, setOriginalLang] = useState<string | null>(null)
    // MediaDrawerRoot routes collections to CollectionDrawer, so payload.type is always movie|tv here.
    // ALWAYS pass an explicit language (profile language, or the original when toggled) — never omit it.
    // The TMDB SDK response cache (cache:true) keys on the request, and a language-less request collides
    // with whatever language was cached first for this id (e.g. a zh-CN fetch from another profile),
    // which showed titles in the wrong language (a Chinese title under an English profile).
    const { data, isLoading } = useMediaDetails(payload.type as "movie" | "tv", payload.id, tmdbLanguageFor(showOriginal && originalLang ? originalLang : locale))
    const { closeAll, close } = useMediaDrawer()

    // UI chrome language for THIS drawer only: a fixed-T bound to the toggled language (not a global
    // i18n.changeLanguage), so Play/Trailer/Top Cast/… localize to the content's language here while the
    // rest of the app stays in the profile language. Load the target language's resources, then re-render.
    const uiLang = showOriginal && originalLang ? originalLang : i18n.language
    const [, setLangTick] = useState(0)
    useEffect(() => {
        void i18n
            .loadLanguages(uiLang)
            .then(() => setLangTick((n) => n + 1))
            .catch(() => {})
    }, [uiLang])
    const dt = i18n.getFixedT(uiLang, "common")

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

    // Remember the title's original language from the (profile-language) fetch so the toggle can request
    // it. If "prefer original content" is on and the title has a distinct original, default to it (once);
    // a title whose original IS the profile language stays on the profile language (the US/profile fallback).
    useEffect(() => {
        if (!data?.originalLanguage) return
        setOriginalLang(data.originalLanguage)
        if (preferOriginalContent && data.originalLanguage !== locale && !preferAppliedRef.current) {
            preferAppliedRef.current = true
            setShowOriginal(true)
        }
    }, [data?.originalLanguage, preferOriginalContent, locale])

    // The hero action row (Resume + original-language toggle + Trailer + providers) is the SHARED element
    // the home/discover carousel renders too. The drawer owns showOriginal (it also drives the detail
    // refetch above) and reuses the hook's displayLang/providerRegion for the collection rail below.
    const hero = useHeroActions({
        media: { type: payload.type as "movie" | "tv", id: payload.id, title: data?.title ?? "", trailer: data?.trailer ?? null, originalLanguage: originalLang },
        locale,
        showOriginal,
        onToggleShowOriginal: setShowOriginal,
        isLoading,
        onBeforePlay: closeAll,
    })

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
                            tags={data.collection ? [dt("detail.collection", "Collection")] : undefined}
                            actionChips={hero.actionChips}
                            description={data.overview}
                            networkLogo={data.networkLogo}
                            studioLogo={data.studioLogo}
                            heightClassName="h-screen"
                            className="animate-in duration-700 fade-in"
                            onPlay={hero.onPlay}
                            playLabel={hero.playLabel}
                            secondary={hero.secondary}
                            afterActions={hero.afterActions}
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
                                    <MediaCollection collectionId={data.collection.id} name={data.collection.name} currentId={Number(data.id)} language={tmdbLanguageFor(hero.displayLang)} providerRegion={hero.providerRegion} />
                                </div>
                            )}

                            {/* CAST */}
                            <div className="mb-8">
                                <MediaCast cast={data.cast} heading={dt("detail.topCast", "Top Cast")} />
                            </div>

                            {/* RECOMMENDATIONS */}
                            <div>
                                <MediaRecommendations recommendations={data.recommendations} heading={dt("detail.recommendations", "Recommendations")} />
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
