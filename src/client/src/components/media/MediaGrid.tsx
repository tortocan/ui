import type { ReactNode } from "react"
import { MediaCard } from "@/components/media/MediaRail/MediaCard.tsx"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

export type GridCard = { id: number; type: "movie" | "tv"; title: string; poster?: string | null; year: number; rating: number }

export interface MediaGridProps {
    cards: GridCard[]
    loading?: boolean
    skeletonCount?: number
    /** Pager is shown when page is set, totalPages > 1 and onPageChange is provided. */
    page?: number
    totalPages?: number
    onPageChange?: (page: number) => void
    emptyTitle?: string
    emptyDescription?: ReactNode
}

const GRID = "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7"

/**
 * Shared responsive poster grid + Previous/Next pager, used by both the "Your Movies/TV" library view
 * (LibraryGrid) and the Discover results. Purely presentational — callers resolve the cards and own
 * the paging state; this just renders the grid, skeletons, empty state and pager consistently.
 */
export function MediaGrid({ cards, loading = false, skeletonCount = 21, page, totalPages = 1, onPageChange, emptyTitle = "No results", emptyDescription = "Try widening your filters." }: MediaGridProps) {
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

    const showPager = page != null && totalPages > 1 && !!onPageChange

    return (
        <>
            <div className={GRID}>
                {cards.map((c) => (
                    <MediaCard key={`${c.type}-${c.id}`} id={c.id} type={c.type} title={c.title} imagePath={c.poster} imageAlt={c.title} year={c.year} rating={c.rating} />
                ))}
            </div>

            {showPager && (
                <div className="mt-6 flex items-center justify-center gap-4">
                    <Button variant="outline" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                    </span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>
                        Next
                    </Button>
                </div>
            )}
        </>
    )
}
