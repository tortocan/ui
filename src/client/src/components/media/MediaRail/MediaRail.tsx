import * as React from "react"
import { Rail } from "./Rail.tsx"
import { RAIL_ITEM_CLASS } from "./rail.constants.ts"
import { cn } from "@/lib/utils.ts"

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
