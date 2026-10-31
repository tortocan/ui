import { useEffect, useMemo, useState } from "react"
import type { TMDB } from "@lorenzopant/tmdb"
import Autoplay from "embla-carousel-autoplay"
import { Calendar, Play, Star } from "lucide-react"
import { Carousel, type CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import { useHeroSlides } from "./use-heroslides"
import type { HeroFetcherResult } from "./types"
import { Button } from "@/components/ui/button.tsx"
import "@/styles/animation.css"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer"
import { useIsMobile } from "@/hooks/use-mobile.ts"
import { useNavigate } from "react-router-dom"

export function HeroCarousel({ tmdb, fetcher }: { tmdb: TMDB; fetcher: HeroFetcherResult }) {
    const { open } = useMediaDrawer()
    const { slides, loading } = useHeroSlides(tmdb, fetcher)
    const isMobile = useIsMobile()
    const navigate = useNavigate()

    const [heroApi, setHeroApi] = useState<CarouselApi>()
    const [activeSlide, setActiveSlide] = useState(0)
    const [progressKey, setProgressKey] = useState(0)

    // Autoplay is fully managed by the embla-carousel-autoplay plugin (no custom hover-pause hook).
    // delay matches the dot progress ring (6500ms); it keeps playing through interaction/hover.
    const plugins = useMemo(() => [Autoplay({ delay: 6500, stopOnInteraction: false, stopOnMouseEnter: false, stopOnFocusIn: false })], [])

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
                {slides.map((slide) => (
                    <CarouselItem key={`${slide.type}-${slide.id}`} className="pl-0">
                        <section className="relative h-[80vh] w-full overflow-hidden md:h-screen">
                            <div className="absolute inset-0">
                                <img src={slide.image} alt={slide.title} className="h-full w-full object-cover object-center" />
                            </div>
                            <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(0,0,0,0.92)_10%,rgba(0,0,0,0.45)_45%,rgba(0,0,0,0.82)_100%)]" />

                            {/* Network logo top-right, studio logo bottom-right. */}
                            {slide.networkLogo && (
                                <img
                                    src={slide.networkLogo}
                                    alt=""
                                    className="pointer-events-none absolute top-20 right-6 z-10 max-h-20 w-auto max-w-[220px] object-contain opacity-90 [filter:invert(1)_hue-rotate(180deg)] sm:right-8 lg:right-12"
                                />
                            )}
                            {slide.studioLogo && (
                                <img
                                    src={slide.studioLogo}
                                    alt=""
                                    // Lift above the bottom-10% float band (mirrors the hero text) so it isn't covered.
                                    className="pointer-events-none absolute right-6 bottom-[calc(2rem+8vh)] z-10 max-h-20 w-auto max-w-[240px] object-contain opacity-90 [filter:invert(1)_hue-rotate(180deg)] sm:right-8 md:bottom-[calc(2rem+10vh)] lg:right-12"
                                />
                            )}
                            {/* pb-[…vh] lifts the hero text/buttons up ~10% so they clear the content that floats over the hero's bottom. */}
                            <div className="relative z-10 flex h-full items-end pb-[8vh] md:pb-[10vh]">
                                {/* Flush-left (no mx-auto/max-w centering) so the hero text hugs the left edge. */}
                                <div className="w-full px-6 sm:px-8 lg:px-12">
                                    <div className="max-w-2xl space-y-5">
                                        <img className="max-h-34 max-w-[50vw] sm:max-w-140" src={slide.logo} alt={slide.title} />
                                        {/* Metadata as chips: rating, year, status (Returning Series/Ended) + genres. */}
                                        <div className="flex flex-wrap items-center gap-2 text-sm">
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 font-semibold text-white backdrop-blur-sm">
                                                <Star className="size-4 fill-primary text-primary" />
                                                {slide.rating}
                                            </span>
                                            {slide.year && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 font-medium text-white/90 backdrop-blur-sm">
                                                    <Calendar className="size-4 opacity-70" />
                                                    {new Date(slide.year).getFullYear()}
                                                </span>
                                            )}
                                            {slide.runtime && <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 font-medium text-white/90 backdrop-blur-sm">{slide.runtime}</span>}
                                            {slide.genres.map((g) => (
                                                <span key={g} className="rounded-full border border-white/15 bg-black/40 px-3 py-1 font-medium text-white/90 backdrop-blur-sm">
                                                    {g}
                                                </span>
                                            ))}
                                        </div>

                                        <p className="max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
                                            {slide.description.length > (isMobile ? 100 : 235)
                                                ? `${slide.description
                                                      .slice(0, isMobile ? 100 : 235)
                                                      .split(" ")
                                                      .slice(0, -1)
                                                      .join(" ")}...`
                                                : slide.description}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3 pt-4">
                                            <Button
                                                className="rounded-full px-7"
                                                onClick={() => {
                                                    if (slide.type === "movie") {
                                                        navigate("/watch/movie/" + slide.id)
                                                    } else if (slide.type === "tv") {
                                                        navigate("/watch/tv/" + slide.id + "?s=1&e=1")
                                                    }
                                                }}
                                            >
                                                <Play className="size-4 fill-current" />
                                                Play
                                            </Button>

                                            <Button
                                                variant="outline"
                                                className="rounded-full border-white/30 bg-white/10 px-7 text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
                                                onClick={() => open({ type: slide.type, id: slide.id })}
                                            >
                                                Learn more
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </CarouselItem>
                ))}
            </CarouselContent>

            {/* Carousel controls at the TOP-center, just below the fixed nav pill. */}
            <div className="absolute top-24 left-1/2 z-10 flex -translate-x-1/2 gap-3">
                {slides.map((slide, index) => {
                    const isActive = activeSlide === index

                    return (
                        <button
                            key={`dot-${slide.title}-${slide.year}`}
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
        </Carousel>
    )
}
