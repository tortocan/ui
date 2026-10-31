import * as React from "react"
import { Rail } from "./Rail.tsx"
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

    if (error) {
        return null
    }

    return (
        <div className={cn("space-y-4", className)}>
            {typeof title === "string" ? <h2 className="text-2xl font-semibold">{title}</h2> : title}
            <Rail
                items={items}
                loading={isLoading}
                getKey={getKey}
                renderItem={(item) => <div>{renderItem(item)}</div>}
                itemClassName={cn(RAIL_ITEM_CLASS, itemClassName)}
                contentClassName="-ml-2 md:-ml-4"
                seeMoreHref={seeMoreHref}
                skeletonCount={skeletonCount}
                renderSkeleton={renderSkeleton}
            />
        </div>
    )
}
