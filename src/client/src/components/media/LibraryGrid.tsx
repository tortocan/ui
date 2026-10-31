import { useEffect, useState } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { MediaCard } from "@/components/media/MediaRail/MediaCard.tsx"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

const PAGE_SIZE = 35

type Card = { id: number; title: string; poster: string | null | undefined; year: number; rating: number }

/**
 * Renders a paged grid of the given TMDB ids as MediaCards — the "library" view used by the
 * Movies/TV pages when `libraryOnly` is on. OMSS only gives us ids, so we fetch TMDB details for
 * the current page's ids (the TMDB client caches, so revisiting a page is cheap). Dead ids (TMDB
 * 404s) are dropped.
 */
export function LibraryGrid({ ids, type, externalLoading = false }: { ids: number[]; type: "movie" | "tv"; externalLoading?: boolean }) {
    const tmdb = useTmdb()
    const [page, setPage] = useState(1)
    const [cards, setCards] = useState<Card[]>([])
    const [loading, setLoading] = useState(true)

    const busy = loading || externalLoading
    const totalPages = Math.max(1, Math.ceil(ids.length / PAGE_SIZE))

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setPage(1), [ids, type])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        const slice = ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

        void (async () => {
            const results = await Promise.all(
                slice.map(async (id): Promise<Card | null> => {
                    try {
                        if (type === "movie") {
                            const m = await tmdb.movies.details({ movie_id: id })
                            return { id, title: m.title, poster: m.poster_path, year: new Date(m.release_date).getFullYear(), rating: m.vote_average }
                        }
                        const s = await tmdb.tv_series.details({ series_id: id })
                        return { id, title: s.name, poster: s.poster_path, year: new Date(s.first_air_date).getFullYear(), rating: s.vote_average }
                    } catch {
                        return null
                    }
                })
            )
            if (!cancelled) {
                setCards(results.filter((c): c is Card => c !== null))
                setLoading(false)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [ids, page, type, tmdb])

    if (!busy && ids.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>Nothing in your library yet</EmptyTitle>
                    <EmptyDescription>
                        Your OMSS server reports no {type === "movie" ? "movies" : "TV shows"}. Add some to Radarr/Sonarr, or turn off "only show my library" in Settings.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        )
    }

    return (
        <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
                {busy
                    ? Array.from({ length: PAGE_SIZE }).map((_, i) => <Skeleton key={i} className="aspect-2/3 rounded-md" />)
                    : cards.map((c) => (
                          <MediaCard key={c.id} id={c.id} type={type} title={c.title} imagePath={c.poster} imageAlt={c.title} year={c.year} rating={c.rating} />
                      ))}
            </div>

            {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3">
                    <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {page} / {totalPages}
                    </span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                        Next
                    </Button>
                </div>
            )}
        </>
    )
}
