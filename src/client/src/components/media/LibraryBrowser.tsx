import { useEffect, useMemo, useState } from "react"
import type { CountryISO3166_1 } from "@lorenzopant/tmdb"
import { useTmdb } from "@/hooks/use-tmdb"
import { useAppSettings } from "@/hooks/use-appsettings.ts"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer"
import { MediaGrid, type GridCard } from "@/components/media/MediaGrid.tsx"
import { MediaFilters, type SortKey } from "@/components/media/filters/MediaFilters.tsx"
import { NETWORKS, STREAMING } from "@/components/media/filters/catalog.ts"
import { useFilterOptions } from "@/components/media/filters/useFilterOptions.ts"
import { Rail } from "@/components/media/MediaRail/Rail.tsx"
import { CollectionCard } from "@/components/media/CollectionCard.tsx"
import { tmdbImage, yearOf } from "@/lib/tmdb.utils"

const PAGE_SIZE = 35
const CHUNK = 20 // concurrent TMDB detail calls per batch

type LibCollection = { id: number; name: string; backdrop: string | null }
type LibTitle = GridCard & { popularity: number; genreIds: number[]; companyIds: number[]; networkIds: number[]; collection?: LibCollection }

// belongs_to_collection.backdrop_path may arrive raw (not resolved to a URL by the client).
const collectionImage = (path?: string | null) => tmdbImage(path, "w780")

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
    const { region } = useAppSettings()
    const { open } = useMediaDrawer()
    const { genres } = useFilterOptions(tmdb, type)

    const [titles, setTitles] = useState<LibTitle[] | null>(null)
    const [genreIds, setGenreIds] = useState<number[]>([])
    const [networkIds, setNetworkIds] = useState<number[]>([])
    const [studioIds, setStudioIds] = useState<number[]>([])
    const [sortKey, setSortKey] = useState<SortKey>("popularity")
    const [fromYear, setFromYear] = useState<number | null>(null)
    const [toYear, setToYear] = useState<number | null>(null)
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
    // Movie "Networks" = streaming availability: per-title watch-provider ids, fetched lazily (region)
    // only while that filter is active (TV filters by networks from details — no extra calls).
    const [providerSets, setProviderSets] = useState<Record<number, Set<number>>>({})
    const [providerLoading, setProviderLoading] = useState(false)

    // Reset everything when the library (ids/type) changes.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisibleCount(PAGE_SIZE)
        setGenreIds([])
        setNetworkIds([])
        setStudioIds([])
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
                        const c = m.belongs_to_collection
                        return {
                            id,
                            type: "movie",
                            title: m.title,
                            poster: m.poster_path,
                            year: yearOf(m.release_date),
                            rating: m.vote_average,
                            popularity: m.popularity,
                            genreIds: (m.genres ?? []).map((g) => g.id),
                            companyIds: (m.production_companies ?? []).map((c) => c.id),
                            networkIds: [],
                            collection: c ? { id: c.id, name: c.name, backdrop: collectionImage(c.backdrop_path ?? c.poster_path) } : undefined,
                        }
                    }
                    const s = await tmdb.tv_series.details({ series_id: id })
                    return {
                        id,
                        type: "tv",
                        title: s.name,
                        poster: s.poster_path,
                        year: yearOf(s.first_air_date),
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

    // Lazily resolve per-title watch-provider ids for the MOVIE "Networks" (streaming) filter.
    useEffect(() => {
        if (type !== "movie" || !networkIds.length || !titles) return
        const missing = titles.filter((t) => providerSets[t.id] == null)
        if (!missing.length) return
        let cancelled = false
        const watchRegion = (region ?? "US") as CountryISO3166_1
        setProviderLoading(true)
        void (async () => {
            const entries = await inChunks(missing, CHUNK, async (t): Promise<[number, Set<number>]> => {
                try {
                    const res = await tmdb.movies.watch_providers({ movie_id: t.id })
                    const rd = res.results?.[watchRegion]
                    const set = new Set<number>()
                    for (const k of ["flatrate", "rent", "buy"] as const) {
                        for (const pr of rd?.[k] ?? []) set.add(pr.provider_id)
                    }
                    return [t.id, set]
                } catch {
                    return [t.id, new Set<number>()]
                }
            })
            if (cancelled) return
            setProviderSets((prev) => {
                const next = { ...prev }
                for (const [id, s] of entries) next[id] = s
                return next
            })
            setProviderLoading(false)
        })()
        return () => {
            cancelled = true
        }
    }, [type, networkIds, titles, tmdb, region, providerSets])

    const filtered = useMemo(() => {
        if (!titles) return []
        let list = titles
        if (genreIds.length) list = list.filter((t) => t.genreIds.some((g) => genreIds.includes(g)))
        if (networkIds.length) {
            // TV → filter by the title's networks; movies → by fetched watch-provider availability.
            if (type === "tv") list = list.filter((t) => t.networkIds.some((n) => networkIds.includes(n)))
            else list = list.filter((t) => providerSets[t.id] && networkIds.some((p) => providerSets[t.id].has(p)))
        }
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
    }, [titles, genreIds, networkIds, studioIds, fromYear, toYear, sortKey, type, providerSets])

    const pageCards = filtered.slice(0, visibleCount)
    const busy = titles === null || externalLoading || (type === "movie" && networkIds.length > 0 && providerLoading)

    // Collections (movies only): group the FILTERED titles by their TMDB franchise, keeping franchises
    // with 2+ owned movies — so applying a filter also narrows/hides collection cards. Most owned first.
    const collections = useMemo(() => {
        if (type !== "movie") return []
        const map = new Map<number, { col: LibCollection; movies: LibTitle[] }>()
        for (const t of filtered) {
            if (!t.collection) continue
            const g = map.get(t.collection.id) ?? { col: t.collection, movies: [] }
            g.movies.push(t)
            map.set(t.collection.id, g)
        }
        return [...map.values()].filter((g) => g.movies.length >= 2).sort((a, b) => b.movies.length - a.movies.length)
    }, [filtered, type])

    const toggle = (setter: (fn: (p: number[]) => number[]) => void) => (id: number) => {
        setter((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
        setVisibleCount(PAGE_SIZE)
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
                    networkItems={type === "movie" ? STREAMING : NETWORKS}
                    networkIds={networkIds}
                    onToggleNetwork={toggle(setNetworkIds)}
                    studioIds={studioIds}
                    onToggleStudio={toggle(setStudioIds)}
                    sortKey={sortKey}
                    onSortChange={(k) => {
                        setSortKey(k)
                        setVisibleCount(PAGE_SIZE)
                    }}
                    fromYear={fromYear}
                    onFromYear={(y) => {
                        setFromYear(y)
                        setVisibleCount(PAGE_SIZE)
                    }}
                    toYear={toYear}
                    onToYear={(y) => {
                        setToYear(y)
                        setVisibleCount(PAGE_SIZE)
                    }}
                />
            </div>

            {/* Collection big-cards first (movies only); respond to the same filters as the grid. */}
            {collections.length > 0 && (
                <Rail
                    items={collections}
                    getKey={(c) => c.col.id}
                    itemClassName="basis-4/5 pl-2 sm:basis-1/2 md:basis-1/3 md:pl-4 lg:basis-1/4 last:mr-4 md:last:mr-6"
                    contentClassName="-ml-2 md:-ml-4"
                    renderItem={(c) => <CollectionCard name={c.col.name} backdrop={c.col.backdrop} count={c.movies.length} providerId={[...c.movies].sort((a, b) => b.year - a.year)[0]?.id} onClick={() => open({ type: "collection", id: c.col.id })} />}
                />
            )}

            <MediaGrid
                cards={pageCards}
                loading={busy}
                skeletonCount={PAGE_SIZE}
                hasMore={visibleCount < filtered.length}
                onLoadMore={() => setVisibleCount((c) => c + PAGE_SIZE)}
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
