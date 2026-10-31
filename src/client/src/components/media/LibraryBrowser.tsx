import { useEffect, useMemo, useState } from "react"
import type { CountryISO3166_1 } from "@lorenzopant/tmdb"
import { useTmdb } from "@/hooks/use-tmdb"
import { useAppSettings } from "@/hooks/use-appsettings.ts"
import { MediaGrid, type GridCard } from "@/components/media/MediaGrid.tsx"
import { MediaFilters, type SortKey } from "@/components/media/filters/MediaFilters.tsx"
import { useFilterOptions } from "@/components/media/filters/useFilterOptions.ts"

const PAGE_SIZE = 35
const CHUNK = 20 // concurrent TMDB detail calls per batch

type LibTitle = GridCard & { popularity: number; genreIds: number[] }

async function inChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = []
    for (let i = 0; i < items.length; i += size) {
        out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
    }
    return out
}

/**
 * The "Your Movies / Your TV Shows" library view with the shared Discover-style filter bar. OMSS only
 * gives us owned ids, so we resolve TMDB details for ALL of them once (genre/year/rating/popularity —
 * the TMDB client caches, chunked to avoid a request storm) and then filter + sort + paginate client
 * side. Genre/year/sort are instant; the Providers filter lazily fetches per-title watch-provider
 * availability for the user's region only while that filter is active.
 */
export function LibraryBrowser({ ids, type, externalLoading = false, heading }: { ids: number[]; type: "movie" | "tv"; externalLoading?: boolean; heading?: string }) {
    const tmdb = useTmdb()
    const { region } = useAppSettings()
    const { genres, providers } = useFilterOptions(tmdb, type, region)

    const [titles, setTitles] = useState<LibTitle[] | null>(null)
    const [genreIds, setGenreIds] = useState<number[]>([])
    const [providerIds, setProviderIds] = useState<number[]>([])
    const [sortKey, setSortKey] = useState<SortKey>("popularity")
    const [fromYear, setFromYear] = useState<number | null>(null)
    const [toYear, setToYear] = useState<number | null>(null)
    const [page, setPage] = useState(1)
    const [providerSets, setProviderSets] = useState<Record<number, Set<number>>>({})
    const [providerLoading, setProviderLoading] = useState(false)

    // Reset everything when the library (ids/type) changes.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(1)
        setGenreIds([])
        setProviderIds([])
        setSortKey("popularity")
        setFromYear(null)
        setToYear(null)
        setProviderSets({})
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

    // Lazily fetch watch-provider availability for owned titles, only while a provider filter is set.
    useEffect(() => {
        if (!providerIds.length || !titles) return
        const missing = titles.filter((t) => providerSets[t.id] == null)
        if (!missing.length) return
        let cancelled = false
        const watchRegion = (region ?? "US") as CountryISO3166_1
        setProviderLoading(true)
        void (async () => {
            const entries = await inChunks(missing, CHUNK, async (t): Promise<[number, Set<number>]> => {
                try {
                    const res = type === "movie" ? await tmdb.movies.watch_providers({ movie_id: t.id }) : await tmdb.tv_series.watch_providers({ series_id: t.id })
                    const regionData = res.results?.[watchRegion]
                    const set = new Set<number>()
                    for (const key of ["flatrate", "rent", "buy"] as const) {
                        for (const pr of regionData?.[key] ?? []) set.add(pr.provider_id)
                    }
                    return [t.id, set]
                } catch {
                    return [t.id, new Set<number>()]
                }
            })
            if (cancelled) return
            setProviderSets((prev) => {
                const next = { ...prev }
                for (const [id, set] of entries) next[id] = set
                return next
            })
            setProviderLoading(false)
        })()
        return () => {
            cancelled = true
        }
    }, [providerIds, titles, type, tmdb, region, providerSets])

    const filtered = useMemo(() => {
        if (!titles) return []
        let list = titles
        if (genreIds.length) list = list.filter((t) => t.genreIds.some((g) => genreIds.includes(g)))
        if (fromYear) list = list.filter((t) => t.year && t.year >= fromYear)
        if (toYear) list = list.filter((t) => t.year && t.year <= toYear)
        if (providerIds.length) list = list.filter((t) => providerSets[t.id] && providerIds.some((p) => providerSets[t.id].has(p)))
        const cmp: Record<SortKey, (a: LibTitle, b: LibTitle) => number> = {
            popularity: (a, b) => b.popularity - a.popularity,
            rating: (a, b) => b.rating - a.rating,
            newest: (a, b) => b.year - a.year,
            oldest: (a, b) => a.year - b.year,
            az: (a, b) => a.title.localeCompare(b.title),
        }
        return [...list].sort(cmp[sortKey])
    }, [titles, genreIds, fromYear, toYear, providerIds, providerSets, sortKey])

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const pageCards = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const busy = titles === null || externalLoading || (providerIds.length > 0 && providerLoading)

    const toggleGenre = (id: number) => {
        setGenreIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
        setPage(1)
    }
    const toggleProvider = (id: number) => {
        setProviderIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
        setPage(1)
    }

    const anyFilter = genreIds.length > 0 || providerIds.length > 0 || fromYear != null || toYear != null
    const noLibrary = !busy && (titles?.length ?? 0) === 0 && !anyFilter

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                {heading && <h2 className="mr-1 text-2xl font-semibold">{heading}</h2>}
                <MediaFilters
                    genres={genres}
                    genreIds={genreIds}
                    onToggleGenre={toggleGenre}
                    providers={providers}
                    providerIds={providerIds}
                    onToggleProvider={toggleProvider}
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
