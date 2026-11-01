import { ArrowLeft } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Collection } from "@lorenzopant/tmdb"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { MediaHeroCard } from "@/components/media/MediaHeroCard.tsx"
import { MediaCard } from "@/components/media/MediaRail/MediaCard.tsx"
import { Rail } from "@/components/media/MediaRail/Rail.tsx"
import { useTmdb } from "@/hooks/use-tmdb"
import { useFilterOptions } from "@/components/media/filters/useFilterOptions.ts"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer.ts"
import { tmdbImage, yearOf } from "@/lib/tmdb.utils"
import { RAIL_ITEM_CLASS, RAIL_CONTENT_CLASS } from "@/components/media/MediaRail/rail.constants"

const img = tmdbImage

interface CollectionDrawerProps {
    id: number
    canGoBack: boolean
    isOpen: boolean
}

/**
 * Collection (movie-franchise) detail — the sibling of {@link MediaDrawer} for a `type: "collection"`
 * payload. It reuses the SAME pieces as a title's detail: the shared {@link MediaHeroCard} as the hero
 * (backdrop + title + chips + overview — no Play, a collection isn't itself playable) and a
 * {@link Rail} of our standard {@link MediaCard}s for the member movies. Clicking a member opens its
 * movie drawer on top (back returns here).
 */
export function CollectionDrawer({ id, canGoBack, isOpen }: CollectionDrawerProps) {
    const tmdb = useTmdb()
    const { open, close, closeAll } = useMediaDrawer()
    const { genres } = useFilterOptions(tmdb, "movie")

    const [col, setCol] = useState<Collection | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setCol(null)
        void (async () => {
            try {
                const data = await tmdb.collections.details({ collection_id: id })
                if (!cancelled) setCol(data)
            } catch {
                if (!cancelled) setCol(null)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [tmdb, id])

    // Pull-up / pull-down overscroll dismiss (mirrors MediaDrawer).
    const swipeRef = useRef<{ y: number; atTop: boolean } | null>(null)
    const onBodyWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.currentTarget.scrollTop <= 0 && e.deltaY < -24) closeAll()
    }
    const onBodyTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        swipeRef.current = { y: e.touches[0]?.clientY ?? 0, atTop: e.currentTarget.scrollTop <= 0 }
    }
    const onBodyTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        const start = swipeRef.current
        swipeRef.current = null
        if (!start || !start.atTop) return
        const end = e.changedTouches[0]?.clientY
        if (end != null && end - start.y > 60) closeAll()
    }

    // Member movies in chronological (release) order.
    const parts = useMemo(() => {
        const list = [...(col?.parts ?? [])]
        return list.sort((a, b) => (a.release_date || "9999").localeCompare(b.release_date || "9999"))
    }, [col])

    // Up to three genre names, most frequent across the franchise first.
    const genreNames = useMemo(() => {
        if (!parts.length || !genres.length) return [] as string[]
        const counts = new Map<number, number>()
        for (const p of parts) for (const g of p.genre_ids ?? []) counts.set(g, (counts.get(g) ?? 0) + 1)
        const nameOf = new Map(genres.map((g) => [g.id, g.name]))
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([gid]) => nameOf.get(gid))
            .filter((n): n is string => !!n)
            .slice(0, 3)
    }, [parts, genres])

    // Member cards use our standard GridCard shape (poster resolved, year/rating from the part).
    const cards = useMemo(
        () =>
            parts.map((p) => ({
                id: p.id,
                type: "movie" as const,
                title: p.title,
                poster: img(p.poster_path, "w342"),
                year: yearOf(p.release_date),
                rating: p.vote_average ?? 0,
            })),
        [parts]
    )

    return (
        <Drawer open={isOpen} onOpenChange={(o) => !o && closeAll()}>
            <DrawerContent
                className="lenis-stopped lenis-disabled inset-0 mt-0 h-full max-h-none! max-w-none rounded-none! border-0! bg-black pt-0 outline-none"
                data-lenis-prevent="true"
                onInteractOutside={(e) => e.preventDefault()}
                headerActions={
                    canGoBack && (
                        <Button variant="outline" size="icon" onClick={close}>
                            <span className="sr-only">Back</span>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )
                }
            >
                <DrawerHeader className="sr-only">
                    <DrawerTitle>Collection</DrawerTitle>
                    <DrawerDescription>Collection details</DrawerDescription>
                </DrawerHeader>

                {loading ? (
                    <CollectionDrawerSkeleton />
                ) : !col ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Failed to load collection.</div>
                ) : (
                    <div className="relative h-full overflow-y-auto" onWheel={onBodyWheel} onTouchStart={onBodyTouchStart} onTouchEnd={onBodyTouchEnd}>
                        {/* HERO — the same card a title's detail renders, minus the Play button. */}
                        <MediaHeroCard
                            image={img(col.backdrop_path, "original")}
                            logoUrl={null}
                            title={col.name}
                            meta={`${parts.length} ${parts.length === 1 ? "Movie" : "Movies"}`}
                            genres={genreNames}
                            description={col.overview}
                            heightClassName="h-screen"
                            className="animate-in duration-700 fade-in"
                        />

                        {/* MEMBERS — our standard MediaCards in a rail, floating up over the hero. */}
                        <div className="relative z-20 -mt-[8vh] px-4 pt-8 pb-10 text-white md:-mt-[10vh] md:px-8">
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Movies</h2>
                                <Rail
                                    items={cards}
                                    getKey={(c) => c.id}
                                    itemClassName={RAIL_ITEM_CLASS}
                                    contentClassName={RAIL_CONTENT_CLASS}
                                    renderItem={(c) => <MediaCard id={c.id} type={c.type} title={c.title} imagePath={c.poster} imageAlt={c.title} year={c.year} rating={c.rating} />}
                                />
                            </section>
                        </div>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}

function CollectionDrawerSkeleton() {
    return (
        <div className="relative h-full overflow-y-auto bg-black">
            <div className="sticky top-0 h-screen w-full">
                <div className="absolute inset-0 animate-pulse bg-muted" />
                <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />
            </div>
            <div className="relative z-20 -mt-[45vh] px-4 pb-10 md:px-8">
                <div className="mb-5 h-8 w-40 animate-pulse rounded-md bg-muted" />
                <div className="flex gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="aspect-2/3 w-1/2 animate-pulse rounded-md bg-muted sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/7" />
                    ))}
                </div>
            </div>
        </div>
    )
}
