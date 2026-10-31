import { useEffect, useMemo, useState } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { MediaGrid, type GridCard } from "@/components/media/MediaGrid.tsx"
import { MediaFilters, type SortKey } from "@/components/media/filters/MediaFilters.tsx"
import { useFilterOptions } from "@/components/media/filters/useFilterOptions.ts"

const PAGE_SIZE = 35
const CHUNK = 20 // concurrent TMDB detail calls per batch

type LibTitle = GridCard & { popularity: number; genreIds: number[]; companyIds: number[]; networkIds: number[] }

async function inChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = []
    for (let i = 0; i < items.length; i += size) {
        out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
    }
    return out
}

/**
 * The "Your Movies / Your TV Shows" library view with the shared filter bar. OMSS only gives us owned
 * ids, so we resolve TMDB details for ALL of them once (genre/company/network/year/rating/popularity —
 * the TMDB client caches, chunked to avoid a request storm) and then filter + sort + paginate client
 * side. Everything is instant since genres, production companies (Studios) and TV networks all come
 * from the title details — no extra per-title calls.
 */
export function LibraryBrowser({ ids, type, externalLoading = false, heading }: { ids: number[]; type: "movie" | "tv"; externalLoading?: boolean; heading?: string }) {
    const tmdb = useTmdb()
    const { genres } = useFilterOptions(tmdb, type)

    const [titles, setTitles] = useState<LibTitle[] | null>(null)
    const [genreIds, setGenreIds] = useState<number[]>([])
    const [networkIds, setNetworkIds] = useState<number[]>([])
    const [studioIds, setStudioIds] = useState<number[]>([])
    const [sortKey, setSortKey] = useState<SortKey>("popularity")
    const [fromYear, setFromYear] = useState<number | null>(null)
    const [toYear, setToYear] = useState<number | null>(null)
    const [page, setPage] = useState(1)

    // Reset everything when the library (ids/type) changes.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(1)
        setGenreIds([])
        setNetworkIds([])
        setStudioIds([])
        setSortKey("popularity")
        setFromYear(null)
        setToYear(null)
    }, [ids, type])

    // Resolve details for every owned id (chunked, cached).
    useEffect(() => {
        let cancelled = false
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitles(null)
        void (async () => {
            const resolved = await inChunks(ids, CHUNK, async (id): Promise<LibTitle | null> => {
                try {
                    if (type === "movie") {
                        const m = await tmdb.movies.details({ movie_id: id })
                        return {
                            id,
                            type: "movie",
                            title: m.title,
                            poster: m.poster_path,
                            year: m.release_date ? new Date(m.release_date).getFullYear() : 0,
                            rating: m.vote_average,
                            popularity: m.popularity,
                            genreIds: (m.genres ?? []).map((g) => g.id),
                            companyIds: (m.production_companies ?? []).map((c) => c.id),
                            networkIds: [],
                        }
                    }
                    const s = await tmdb.tv_series.details({ series_id: id })
                    return {
                        id,
                        type: "tv",
                        title: s.name,
                        poster: s.poster_path,
                        year: s.first_air_date ? new Date(s.first_air_date).getFullYear() : 0,
                        rating: s.vote_average,
                        popularity: s.popularity,
                        genreIds: (s.genres ?? []).map((g) => g.id),
                        companyIds: (s.production_companies ?? []).map((c) => c.id),
                        networkIds: (s.networks ?? []).map((n) => n.id),
                    }
                } catch {
                    return null
                }
            })
            if (!cancelled) setTitles(resolved.filter((t): t is LibTitle => t !== null))
        })()
        return () => {
            cancelled = true
        }
    }, [ids, type, tmdb])

    const filtered = useMemo(() => {
        if (!titles) return []
        let list = titles
        if (genreIds.length) list = list.filter((t) => t.genreIds.some((g) => genreIds.includes(g)))
        if (networkIds.length) list = list.filter((t) => t.networkIds.some((n) => networkIds.includes(n)))
        if (studioIds.length) list = list.filter((t) => t.companyIds.some((c) => studioIds.includes(c)))
        if (fromYear) list = list.filter((t) => t.year && t.year >= fromYear)
        if (toYear) list = list.filter((t) => t.year && t.year <= toYear)
        const cmp: Record<SortKey, (a: LibTitle, b: LibTitle) => number> = {
            popularity: (a, b) => b.popularity - a.popularity,
            rating: (a, b) => b.rating - a.rating,
            newest: (a, b) => b.year - a.year,
            oldest: (a, b) => a.year - b.year,
            az: (a, b) => a.title.localeCompare(b.title),
        }
        return [...list].sort(cmp[sortKey])
    }, [titles, genreIds, networkIds, studioIds, fromYear, toYear, sortKey])

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const pageCards = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const busy = titles === null || externalLoading

    const toggle = (setter: (fn: (p: number[]) => number[]) => void) => (id: number) => {
        setter((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
        setPage(1)
    }

    const anyFilter = genreIds.length > 0 || networkIds.length > 0 || studioIds.length > 0 || fromYear != null || toYear != null
    const noLibrary = !busy && (titles?.length ?? 0) === 0 && !anyFilter

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                {heading && <h2 className="mr-1 text-2xl font-semibold">{heading}</h2>}
                <MediaFilters
                    genres={genres}
                    genreIds={genreIds}
                    onToggleGenre={toggle(setGenreIds)}
                    networkIds={networkIds}
                    onToggleNetwork={toggle(setNetworkIds)}
                    showNetworks={type === "tv"}
                    studioIds={studioIds}
                    onToggleStudio={toggle(setStudioIds)}
                    sortKey={sortKey}
                    onSortChange={(k) => {
                        setSortKey(k)
                        setPage(1)
                    }}
                    fromYear={fromYear}
                    onFromYear={(y) => {
                        setFromYear(y)
                        setPage(1)
                    }}
                    toYear={toYear}
                    onToYear={(y) => {
                        setToYear(y)
                        setPage(1)
                    }}
                />
            </div>

            <MediaGrid
                cards={pageCards}
                loading={busy}
                skeletonCount={PAGE_SIZE}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                emptyTitle={noLibrary ? "Nothing in your library yet" : "Nothing matches"}
                emptyDescription={
                    noLibrary
                        ? `Your OMSS server reports no ${type === "movie" ? "movies" : "TV shows"}. Add some to Radarr/Sonarr, or turn off "only show my library" in Settings.`
                        : "Try changing or clearing the filters."
                }
            />
        </div>
    )
}
