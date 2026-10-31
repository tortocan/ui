import * as React from "react"
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
    opts?: CarouselOptions
    plugins?: CarouselPlugin
    orientation?: "horizontal" | "vertical"
    setApi?: (api: CarouselApi) => void
    // Mouse-wheel horizontal scroll. On by default for horizontal carousels (so a vertical mouse
    // wheel scrolls the rail sideways via forceWheelAxis "y"); pass false where it would hijack page
    // scroll (e.g. the full-bleed hero at the top of the page).
    wheelScroll?: boolean
}

type CarouselContextProps = {
    carouselRef: ReturnType<typeof useEmblaCarousel>[0]
    api: ReturnType<typeof useEmblaCarousel>[1]
    scrollPrev: () => void
    scrollNext: () => void
    canScrollPrev: boolean
    canScrollNext: boolean
} & CarouselProps

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

function useCarousel() {
    const context = React.useContext(CarouselContext)

    if (!context) {
        throw new Error("useCarousel must be used within a <Carousel />")
    }

    return context
}

function Carousel({ orientation = "horizontal", opts, setApi, plugins, wheelScroll = true, className, children, ...props }: React.ComponentProps<"div"> & CarouselProps) {
    const [carouselRef, api] = useEmblaCarousel(
        {
            ...opts,
            axis: orientation === "horizontal" ? "x" : "y",
        },
        plugins
    )
    const [canScrollPrev, setCanScrollPrev] = React.useState(false)
    const [canScrollNext, setCanScrollNext] = React.useState(false)

    const onSelect = React.useCallback((api: CarouselApi) => {
        if (!api) return
        setCanScrollPrev(api.canScrollPrev())
        setCanScrollNext(api.canScrollNext())
    }, [])

    const scrollPrev = React.useCallback(() => {
        api?.scrollPrev()
    }, [api])

    const scrollNext = React.useCallback(() => {
        api?.scrollNext()
    }, [api])

    const handleKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "ArrowLeft") {
                event.preventDefault()
                scrollPrev()
            } else if (event.key === "ArrowRight") {
                event.preventDefault()
                scrollNext()
            }
        },
        [scrollPrev, scrollNext]
    )

    React.useEffect(() => {
        if (!api || !setApi) return
        setApi(api)
    }, [api, setApi])

    React.useEffect(() => {
        if (!api) return
        onSelect(api)
        api.on("reInit", onSelect)
        api.on("select", onSelect)

        return () => {
            api?.off("select", onSelect)
        }
    }, [api, onSelect])

    // Mouse-wheel → horizontal scroll, HORIZONTAL GESTURES ONLY. We drive Embla's engine ourselves
    // from the wheel's horizontal delta (deltaX — a trackpad/Magic Mouse sideways swipe or shift+wheel).
    // A vertical wheel (deltaY) is deliberately ignored so it scrolls the PAGE, not the rail. If the
    // rail can still move, preventDefault and scroll the track by that pixel distance via the engine's
    // scrollTo.distance; when maxed out we DON'T preventDefault so the page scrolls past it. iOS
    // touch-drag is untouched (this only binds `wheel`).
    React.useEffect(() => {
        if (!api || orientation !== "horizontal" || !wheelScroll) return
        const node = typeof api.rootNode === "function" ? api.rootNode() : null
        if (!node) return
        const isLoop = !!opts?.loop
        const onWheel = (e: WheelEvent) => {
            // Horizontal delta only — a vertical wheel falls through to the page. Normalize line-mode
            // deltas (Firefox) to pixels so the step feels the same everywhere.
            const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? node.clientWidth : 1
            const delta = e.deltaX * scale
            if (!delta) return
            const engine = api.internalEngine()
            if (isLoop) {
                // Loop carousels scroll infinitely — there's no pixel limit to clamp against.
                e.preventDefault()
                engine.scrollBody.useDuration(0)
                engine.scrollTo.distance(-delta, false)
                return
            }
            // Clamp the step to the TRUE pixel limit (engine.limit), NOT the snap index. Embla's
            // canScrollNext()/canScrollPrev() are snap-index based and flip false once you're inside the
            // last/first snap, which used to strand the final sub-snap pixels and clip the last card
            // (the "can't scroll more" bug). We base the room on engine.target — the committed
            // destination, stable across instant ticks — constrain the next position to the limit, and
            // only skip preventDefault when genuinely pinned at a boundary so the page scrolls past.
            const cur = engine.target.get()
            const applied = engine.limit.constrain(cur - delta) - cur // -delta: wheel-down moves toward the end
            if (Math.abs(applied) < 0.5) return
            e.preventDefault()
            engine.scrollBody.useDuration(0)
            engine.scrollTo.distance(applied, false)
        }
        node.addEventListener("wheel", onWheel, { passive: false })
        return () => node.removeEventListener("wheel", onWheel)
    }, [api, orientation, wheelScroll, opts?.loop])

    return (
        <CarouselContext.Provider
            value={{
                carouselRef,
                api: api,
                opts,
                orientation: orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
                scrollPrev,
                scrollNext,
                canScrollPrev,
                canScrollNext,
            }}
        >
            {/* data-lenis-prevent: on desktop the app runs Lenis smooth-scroll with a global wheel
                listener that would otherwise swallow the vertical wheel into page scroll (this is why
                rails scrolled vertically on macOS but worked on iOS, where Lenis isn't started). This
                tells Lenis to ignore the wheel over the rail so our onWheel handler owns it; when the
                rail is maxed out our handler skips preventDefault and native scroll moves the page. */}
            <div
                onKeyDownCapture={handleKeyDown}
                className={cn("relative", className)}
                role="region"
                aria-roledescription="carousel"
                data-slot="carousel"
                {...(wheelScroll && orientation === "horizontal" ? { "data-lenis-prevent": true } : {})}
                {...props}
            >
                {children}
            </div>
        </CarouselContext.Provider>
    )
}

function CarouselContent({ className, ...props }: React.ComponentProps<"div">) {
    const { carouselRef, orientation } = useCarousel()

    return (
        <div ref={carouselRef} className="overflow-hidden" data-slot="carousel-content">
            <div className={cn("flex", orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col", className)} {...props} />
        </div>
    )
}

function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
    const { orientation } = useCarousel()

    return (
        <div
            role="group"
            aria-roledescription="slide"
            data-slot="carousel-item"
            className={cn("min-w-0 shrink-0 grow-0 basis-full", orientation === "horizontal" ? "pl-4" : "pt-4", className)}
            {...props}
        />
    )
}

function CarouselPrevious({ className, variant = "outline", size = "icon-sm", ...props }: React.ComponentProps<typeof Button>) {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel()

    return (
        <Button
            data-slot="carousel-previous"
            variant={variant}
            size={size}
            className={cn("absolute touch-manipulation rounded-full backdrop-blur-xl", orientation === "horizontal" ? "top-1/2 -left-4" : "-top-12 left-1/2 -translate-x-1/2 rotate-90", className)}
            disabled={!canScrollPrev}
            onClick={scrollPrev}
            {...props}
        >
            <ChevronLeftIcon className="cn-rtl-flip" />
            <span className="sr-only">Previous slide</span>
        </Button>
    )
}

function CarouselNext({ className, variant = "outline", size = "icon-sm", ...props }: React.ComponentProps<typeof Button>) {
    const { orientation, scrollNext, canScrollNext } = useCarousel()

    return (
        <Button
            data-slot="carousel-next"
            variant={variant}
            size={size}
            className={cn(
                "absolute touch-manipulation rounded-full backdrop-blur-xl",
                orientation === "horizontal" ? "top-1/2 -right-4 -translate-y-1/2" : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
                className
            )}
            disabled={!canScrollNext}
            onClick={scrollNext}
            {...props}
        >
            <ChevronRightIcon className="cn-rtl-flip" />
            <span className="sr-only">Next slide</span>
        </Button>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export { type CarouselApi, Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, useCarousel }
