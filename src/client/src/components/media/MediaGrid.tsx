import { useEffect, useRef, type ReactNode } from "react"
import { MediaCard } from "@/components/media/MediaRail/MediaCard.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils.ts"

export type GridCard = { id: number; type: "movie" | "tv"; title: string; poster?: string | null; year: number; rating: number }

export interface MediaGridProps {
    cards: GridCard[]
    loading?: boolean
    skeletonCount?: number
    /** Infinite scroll: when hasMore is true, onLoadMore fires as the bottom sentinel nears the viewport. */
    hasMore?: boolean
    onLoadMore?: () => void
    emptyTitle?: string
    emptyDescription?: ReactNode
}

const GRID = "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7"

/**
 * Shared responsive poster grid with infinite scroll, used by the "Your Movies/TV" library view
 * (LibraryBrowser) and the Discover results. Purely presentational — callers resolve the cards and
 * decide how `onLoadMore` extends them (Discover fetches + appends the next TMDB page; the library
 * grows its visible slice). An IntersectionObserver on a trailing sentinel triggers the load a bit
 * before the user reaches the bottom; the sentinel also shows a few skeletons as the loading hint.
 */
export function MediaGrid({ cards, loading = false, skeletonCount = 21, hasMore = false, onLoadMore, emptyTitle = "No results", emptyDescription = "Try widening your filters." }: MediaGridProps) {
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    // Guard so we request the next page only once per distinct card count (not repeatedly while the
    // sentinel stays on screen before the new cards arrive).
    const lastRequestedCount = useRef(-1)

    useEffect(() => {
        if (!onLoadMore || !hasMore) return
        const el = sentinelRef.current
        if (!el) return
        const io = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && cards.length !== lastRequestedCount.current) {
                    lastRequestedCount.current = cards.length
                    onLoadMore()
                }
            },
            { rootMargin: "800px 0px" }
        )
        io.observe(el)
        return () => io.disconnect()
    }, [onLoadMore, hasMore, cards.length])

    if (loading) {
        return (
            <div className={GRID}>
                {Array.from({ length: skeletonCount }).map((_, i) => (
                    <Skeleton key={i} className="aspect-2/3 w-full" />
                ))}
            </div>
        )
    }

    if (cards.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{emptyTitle}</EmptyTitle>
                    <EmptyDescription>{emptyDescription}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        )
    }

    return (
        <>
            <div className={GRID}>
                {cards.map((c) => (
                    <MediaCard key={`${c.type}-${c.id}`} id={c.id} type={c.type} title={c.title} imagePath={c.poster} imageAlt={c.title} year={c.year} rating={c.rating} />
                ))}
            </div>

            {hasMore && onLoadMore && (
                <div ref={sentinelRef} className={cn(GRID, "mt-4")}>
                    {Array.from({ length: Math.min(7, skeletonCount) }).map((_, i) => (
                        <Skeleton key={i} className="aspect-2/3 w-full" />
                    ))}
                </div>
            )}
        </>
    )
}
