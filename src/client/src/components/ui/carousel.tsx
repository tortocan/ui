import * as React from "react"
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"

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
    // Add wheel-to-horizontal scroll by default on horizontal carousels, merged with any caller
    // plugins (e.g. the hero's autoplay). forceWheelAxis "y" maps a vertical mouse wheel to the rail.
    const resolvedPlugins = React.useMemo(
        () => [...(plugins ?? []), ...(wheelScroll && orientation === "horizontal" ? [WheelGesturesPlugin({ forceWheelAxis: "y" })] : [])],
        [plugins, wheelScroll, orientation]
    )
    const [carouselRef, api] = useEmblaCarousel(
        {
            ...opts,
            axis: orientation === "horizontal" ? "x" : "y",
        },
        resolvedPlugins
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

    // Stop the native vertical page scroll while the wheel is driving a horizontal rail. The
    // wheel-gestures plugin moves the rail sideways but doesn't reliably cancel the page's own
    // scroll, so a mouse wheel scrolled the page up/down AND nudged the rail. Here we preventDefault
    // only while the rail can still scroll in the wheel's direction, releasing at the ends so the
    // page scrolls past a maxed-out rail (non-passive listener required for preventDefault to apply).
    React.useEffect(() => {
        if (!api || !wheelScroll || orientation !== "horizontal") return
        const node = typeof api.rootNode === "function" ? api.rootNode() : null
        if (!node) return
        const onWheel = (e: WheelEvent) => {
            const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
            if (!delta) return
            if ((delta > 0 && api.canScrollNext()) || (delta < 0 && api.canScrollPrev())) {
                e.preventDefault()
            }
        }
        node.addEventListener("wheel", onWheel, { passive: false })
        return () => node.removeEventListener("wheel", onWheel)
    }, [api, wheelScroll, orientation])

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
            <div onKeyDownCapture={handleKeyDown} className={cn("relative", className)} role="region" aria-roledescription="carousel" data-slot="carousel" {...props}>
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
