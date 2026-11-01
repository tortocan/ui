import { useEffect, useState } from "react"
import { Info } from "lucide-react"
import { useTmdb } from "@/hooks/use-tmdb"
import { useAppSettings, tmdbLanguageFor } from "@/hooks/use-appsettings"
import { Button } from "@/components/ui/button.tsx"
import { MediaHeroCard } from "@/components/media/MediaHeroCard.tsx"
import { useHeroActions } from "@/components/media/hooks/use-hero-actions.tsx"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer"
import { pickYouTubeTrailerKey } from "@/lib/tmdb.utils"
import type { Language } from "@lorenzopant/tmdb"
import type { HeroSlide } from "./types"

/** Slide fields that swap when the original-language toggle is on (title/overview/logo/backdrop/trailer). */
interface OriginalOverride {
    title: string
    description: string
    logo: string
    image: string
    trailer: string | null
}

/**
 * One hero-carousel slide. Renders {@link MediaHeroCard} with the SAME shared action row as the media
 * drawer (Resume + original-language toggle + Trailer + streaming providers, via {@link useHeroActions}),
 * plus the carousel's own "Learn more" (opens the detail drawer). Owns a per-slide original-language
 * toggle: the first time it's turned on, the slide's content is refetched in its original language and
 * cached, so the chip swaps the title/overview/logo/backdrop/trailer just like the drawer does.
 */
export function HeroSlideCard({ slide, active, descriptionClampChars }: { slide: HeroSlide; active: boolean; descriptionClampChars: number }) {
    const { open } = useMediaDrawer()
    const { locale } = useAppSettings()
    const tmdb = useTmdb()

    const [showOriginal, setShowOriginal] = useState(false)
    const [override, setOverride] = useState<OriginalOverride | null>(null)
    const [loadingOriginal, setLoadingOriginal] = useState(false)

    const canToggle = !!slide.originalLanguage && slide.originalLanguage !== locale

    // Lazily fetch the slide in its original language the first time the toggle turns on, then cache it.
    // NOTE: loadingOriginal is deliberately NOT a dependency (nor part of the guard): setting it inside
    // the effect would otherwise re-run the effect, trip its own cleanup (cancelled=true) before the
    // fetch resolves, and strand override=null / loadingOriginal=true forever. The per-run `cancelled`
    // flag handles re-entrancy, and no listed dep changes mid-fetch, so there's no duplicate request.
    useEffect(() => {
        if (!showOriginal || !canToggle || override) return
        let cancelled = false
        setLoadingOriginal(true)
        const language = tmdbLanguageFor(slide.originalLanguage) as Language
        const req =
            slide.type === "movie"
                ? tmdb.movies.details({ movie_id: slide.id, append_to_response: ["images", "videos"], language })
                : tmdb.tv_series.details({ series_id: slide.id, append_to_response: ["images", "videos"], language })
        void req
            .then((m) => {
                if (cancelled) return
                const isMovie = "title" in m
                setOverride({
                    title: (isMovie ? m.title : m.name) || slide.title,
                    description: m.overview || slide.description,
                    logo: m.images?.logos?.[0]?.file_path ?? slide.logo,
                    image: m.backdrop_path ?? m.images?.backdrops?.[0]?.file_path ?? slide.image,
                    trailer: pickYouTubeTrailerKey(m.videos?.results) ?? slide.trailer,
                })
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoadingOriginal(false)
            })
        return () => {
            cancelled = true
        }
    }, [showOriginal, canToggle, override, slide, tmdb])

    const showOrig = showOriginal && !!override
    const title = showOrig ? override.title : slide.title
    const description = showOrig ? override.description : slide.description
    const logo = showOrig ? override.logo : slide.logo
    const image = showOrig ? override.image : slide.image
    const trailer = showOrig ? override.trailer : slide.trailer

    const hero = useHeroActions({
        media: { type: slide.type, id: slide.id, title, trailer, originalLanguage: slide.originalLanguage },
        locale,
        showOriginal,
        onToggleShowOriginal: setShowOriginal,
        isLoading: loadingOriginal,
        active,
    })

    return (
        <MediaHeroCard
            image={image}
            logoUrl={logo}
            title={title}
            rating={slide.rating}
            date={slide.year}
            meta={slide.runtime}
            genres={slide.genres}
            description={description}
            descriptionClampChars={descriptionClampChars}
            networkLogo={slide.networkLogo}
            studioLogo={slide.studioLogo}
            actionChips={hero.actionChips}
            onPlay={hero.onPlay}
            playLabel={hero.playLabel}
            secondary={
                <>
                    {hero.secondary}
                    <Button
                        variant="outline"
                        className="rounded-full border-white/30 bg-white/10 px-7 text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
                        onClick={() => open({ type: slide.type, id: slide.id })}
                    >
                        <Info className="size-4" />
                        Learn more
                    </Button>
                </>
            }
            afterActions={hero.afterActions}
        />
    )
}
