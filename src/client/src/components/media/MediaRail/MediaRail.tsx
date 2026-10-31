import * as React from "react"
import { useLocation } from "react-router-dom"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { SeeMoreCard } from "./SeeMoreCard.tsx"
import { cn } from "@/lib/utils.ts"

// Shared slide sizing for every rail item (incl. skeletons and the trailing See-more card).
// `last:mr-*` gives the DOM-last slide a trailing inset: Embla folds the last slide's margin-right
// into contentSize, so the scroll limit extends past the last card by that much — the last card
// clears the edge with breathing room instead of jamming flush-right (the iOS/macOS feel).
const RAIL_ITEM_CLASS = "basis-1/2 pl-2 sm:basis-1/3 md:basis-1/4 md:pl-4 lg:basis-1/5 xl:basis-1/7 last:mr-4 md:last:mr-6"

export interface MediaRailProps<T> {
    title?: React.ReactNode | string
    fetcher: () => Promise<{ results: T[] } | T[]>
    getKey: (item: T) => string | number
    renderItem: (item: T) => React.ReactNode
    onSelect?: (item: T) => void
    className?: string
    itemClassName?: string
    skeletonCount?: number
    renderSkeleton?: (index: number) => React.ReactNode
    /** When set, a trailing "See more" card at the end of the rail navigates to this route. */
    seeMoreHref?: string
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMediaRail<T>(fetcher: () => Promise<{ results: T[] } | T[]>) {
    const [items, setItems] = React.useState<T[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [error, setError] = React.useState<Error | null>(null)

    const fetchData = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await fetcher()
            const results = Array.isArray(data) ? data : data.results
            setItems(results || [])
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
            setIsLoading(false)
        }
    }, [fetcher])

    React.useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchData()
    }, [fetchData])

    return { items, isLoading, error, refetch: fetchData }
}

export function MediaRail<T>({ title, fetcher, getKey, renderItem, className, itemClassName, skeletonCount = 6, renderSkeleton, seeMoreHref }: MediaRailProps<T>) {
    const { items, isLoading, error } = useMediaRail(fetcher)
    const { pathname } = useLocation()
    // Only append the trailing "See more" card when it leads somewhere other than the current page
    // (the Movies / TV Shows pages reuse these rails and would otherwise self-link).
    const showSeeMore = !!seeMoreHref && pathname !== seeMoreHref

    if (error) {
        return null
    }

    const defaultRenderSkeleton = (index: number) => (
        <div key={`skeleton-${index}`} className="space-y-3">
            <Skeleton className="aspect-2/3 w-full" />
        </div>
    )

    return (
        <div className={cn("space-y-4", className)}>
            {typeof title === "string" ? <h2 className="text-2xl font-semibold">{title}</h2> : title}
            <Carousel
                opts={{
                    align: "start",
                    loop: false,
                    dragFree: true,
                }}
                className="w-full"
            >
                <CarouselContent className="-ml-2 md:-ml-4">
                    {isLoading
                        ? Array.from({ length: skeletonCount }).map((_, i) => (
                              <CarouselItem key={`skeleton-${i}`} className={cn(RAIL_ITEM_CLASS, itemClassName)}>
                                  {renderSkeleton ? renderSkeleton(i) : defaultRenderSkeleton(i)}
                              </CarouselItem>
                          ))
                        : items.map((item) => (
                              <CarouselItem key={getKey(item)} className={cn(RAIL_ITEM_CLASS, itemClassName)}>
                                  <div>{renderItem(item)}</div>
                              </CarouselItem>
                          ))}
                    {!isLoading && items.length > 0 && showSeeMore && (
                        <CarouselItem className={cn(RAIL_ITEM_CLASS, itemClassName)}>
                            <SeeMoreCard href={seeMoreHref!} />
                        </CarouselItem>
                    )}
                </CarouselContent>
                {!isLoading && items.length > 0 && (
                    <>
                        <CarouselPrevious className="hidden md:flex" />
                        <CarouselNext className="hidden md:flex" />
                    </>
                )}
            </Carousel>
        </div>
    )
}
