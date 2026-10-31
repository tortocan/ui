import * as React from "react"
import { useLocation } from "react-router-dom"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { SeeMoreCard } from "./SeeMoreCard.tsx"

type CarouselOpts = React.ComponentProps<typeof Carousel>["opts"]

const DEFAULT_OPTS = { align: "start", loop: false, dragFree: true } as const

export interface RailProps<T> {
    items: T[]
    renderItem: (item: T) => React.ReactNode
    getKey: (item: T) => React.Key
    /** Slide width/padding classes for each CarouselItem (basis + pl + any `last:` inset). */
    itemClassName: string
    /** Negative-margin gutter on the track that pairs with the items' left padding, e.g. "-ml-2 md:-ml-4". */
    contentClassName?: string
    seeMoreHref?: string
    showNav?: boolean
    opts?: CarouselOpts
    loading?: boolean
    skeletonCount?: number
    renderSkeleton?: (index: number) => React.ReactNode
}

/**
 * Shared presentational rail: the Carousel + track + items → CarouselItem + prev/next nav, plus an
 * optional trailing "See more" card and skeleton-loading state. Every horizontal rail (the media
 * rails, Continue Watching, and the drawer's Recommendations/Cast/Episodes) renders through this so
 * the carousel wiring — horizontal-swipe handler, nav arrows, gutter math — lives in one place. Data
 * fetching stays with the caller; this is purely presentational.
 */
export function Rail<T>({
    items,
    renderItem,
    getKey,
    itemClassName,
    contentClassName,
    seeMoreHref,
    showNav = true,
    opts,
    loading = false,
    skeletonCount = 6,
    renderSkeleton,
}: RailProps<T>) {
    const { pathname } = useLocation()
    // Only show a trailing "See more" when it leads somewhere other than the current page.
    const showSeeMore = !!seeMoreHref && pathname !== seeMoreHref

    const defaultSkeleton = (i: number) => <Skeleton key={`sk-${i}`} className="aspect-2/3 w-full" />

    return (
        <Carousel className="w-full" opts={opts ?? DEFAULT_OPTS}>
            <CarouselContent className={contentClassName}>
                {loading
                    ? Array.from({ length: skeletonCount }).map((_, i) => (
                          <CarouselItem key={`sk-${i}`} className={itemClassName}>
                              {renderSkeleton ? renderSkeleton(i) : defaultSkeleton(i)}
                          </CarouselItem>
                      ))
                    : items.map((item) => (
                          <CarouselItem key={getKey(item)} className={itemClassName}>
                              {renderItem(item)}
                          </CarouselItem>
                      ))}
                {!loading && items.length > 0 && showSeeMore && (
                    <CarouselItem className={itemClassName}>
                        <SeeMoreCard href={seeMoreHref!} />
                    </CarouselItem>
                )}
            </CarouselContent>
            {showNav && !loading && items.length > 0 && (
                <>
                    <CarouselPrevious className="hidden md:flex" />
                    <CarouselNext className="hidden md:flex" />
                </>
            )}
        </Carousel>
    )
}
