import { useEffect, useMemo, useState } from "react"
import type { TMDB } from "@lorenzopant/tmdb"
import Autoplay from "embla-carousel-autoplay"
import { Info, Play } from "lucide-react"
import { Carousel, type CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import { MediaHeroCard } from "@/components/media/MediaHeroCard.tsx"
import { useHeroSlides } from "./use-heroslides"
import type { HeroFetcherResult } from "./types"
import { Button } from "@/components/ui/button.tsx"
import "@/styles/animation.css"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer"
import { useIsMobile } from "@/hooks/use-mobile.ts"
import { useNavigate } from "react-router-dom"
import { useAppSettings } from "@/hooks/use-appsettings.ts"

export function HeroCarousel({ tmdb, fetcher }: { tmdb: TMDB; fetcher: HeroFetcherResult }) {
    const { open } = useMediaDrawer()
    const { slides, loading } = useHeroSlides(tmdb, fetcher)
    const isMobile = useIsMobile()
    const navigate = useNavigate()
    const { showCarouselDots } = useAppSettings()

    const [heroApi, setHeroApi] = useState<CarouselApi>()
    const [activeSlide, setActiveSlide] = useState(0)
    const [progressKey, setProgressKey] = useState(0)

    // Autoplay via embla-carousel-autoplay; delay matches the dot progress ring (6500ms). Keep embla's
    // accessibility safeguards ON (WCAG 2.2.2 Pause/Stop/Hide): pause on hover, on keyboard focus, and
    // on interaction so the motion can be stopped, and don't auto-start for prefers-reduced-motion users.
    const plugins = useMemo(() => {
        const reduceMotion = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        return [Autoplay({ delay: 6500, playOnInit: !reduceMotion, stopOnInteraction: true, stopOnMouseEnter: true, stopOnFocusIn: true })]
    }, [])

    // Keep the active dot + its progress ring in step with whatever slide the plugin (or a swipe) lands on.
    useEffect(() => {
        if (!heroApi) return
        const onSelect = () => {
            setActiveSlide(heroApi.selectedScrollSnap())
            setProgressKey((p) => p + 1)
        }
        onSelect()
        heroApi.on("select", onSelect)
        heroApi.on("reInit", onSelect)
        return () => {
            heroApi.off("select", onSelect)
            heroApi.off("reInit", onSelect)
        }
    }, [heroApi])

    const heroEmptyState = useMemo(
        () => (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
                <h1 className="animate-pulse text-2xl font-semibold">Loading content...</h1>
            </div>
        ),
        []
    )

    if (loading || slides.length === 0) return heroEmptyState

    return (
        <Carousel setApi={setHeroApi} opts={{ loop: true }} plugins={plugins} className="h-full w-full">
            <CarouselContent className="ml-0 h-full">
                {slides.map((slide, index) => (
                    <CarouselItem key={`${slide.type}-${slide.id}`} className="pl-0" aria-hidden={activeSlide !== index} inert={activeSlide !== index}>
                        <MediaHeroCard
                            image={slide.image}
                            logoUrl={slide.logo}
                            title={slide.title}
                            rating={slide.rating}
                            date={slide.year}
                            meta={slide.runtime}
                            genres={slide.genres}
                            description={slide.description}
                            descriptionClampChars={isMobile ? 160 : 420}
                            networkLogo={slide.networkLogo}
                            studioLogo={slide.studioLogo}
                            onPlay={() => navigate(slide.type === "movie" ? "/watch/movie/" + slide.id : "/watch/tv/" + slide.id + "?s=1&e=1")}
                            playLabel={
                                <>
                                    <Play className="size-4 fill-current" />
                                    Play
                                </>
                            }
                            secondary={
                                <Button
                                    variant="outline"
                                    className="rounded-full border-white/30 bg-white/10 px-7 text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
                                    onClick={() => open({ type: slide.type, id: slide.id })}
                                >
                                    <Info className="size-4" />
                                    Learn more
                                </Button>
                            }
                        />
                    </CarouselItem>
                ))}
            </CarouselContent>

            {/* Carousel controls at the TOP-center, just below the fixed nav pill. */}
            {showCarouselDots && (
                <div className="absolute top-24 left-1/2 z-10 flex -translate-x-1/2 gap-3">
                    {slides.map((slide, index) => {
                        const isActive = activeSlide === index

                        return (
                            <button
                                key={`dot-${slide.type}-${slide.id}`}
                                aria-label={`Go to ${slide.title}`}
                                aria-current={isActive}
                                onClick={() => {
                                    heroApi?.scrollTo(index)
                                    setProgressKey((p) => p + 1)
                                }}
                                className={`relative h-2.5 overflow-hidden rounded-full transition-all duration-300 ${isActive ? "w-10 bg-primary/20" : "w-2.5 bg-white/30 hover:bg-white/50"}`}
                            >
                                {isActive && <div key={`${progressKey}-${index}`} className="animate-carousel-progress absolute inset-0 origin-left rounded-full bg-primary" />}
                            </button>
                        )
                    })}
                </div>
            )}
        </Carousel>
    )
}
