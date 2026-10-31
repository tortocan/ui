import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ShuffleIcon } from "lucide-react"
import type { CountryISO3166_1, DiscoverMovieParams, DiscoverMovieSortBy, DiscoverTVParams, DiscoverTVSortBy, MovieResultItem, DiscoverTVResultItem } from "@lorenzopant/tmdb"
import { useTmdb } from "@/hooks/use-tmdb"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer"
import { BrowseLayout } from "@/components/media/BrowseLayout.tsx"
import { MediaGrid } from "@/components/media/MediaGrid.tsx"
import { MediaFilters, SORT_OPTIONS, type SortKey } from "@/components/media/filters/MediaFilters.tsx"
import { useFilterOptions } from "@/components/media/filters/useFilterOptions.ts"
import { Button } from "@/components/ui/button"
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"

type MediaKind = "movie" | "tv" | "anime"
type ResultItem = (MovieResultItem | DiscoverTVResultItem) & { media_kind: "movie" | "tv" }

const MEDIA_KIND_OPTIONS: { value: MediaKind; label: string }[] = [
    { value: "movie", label: "Movies" },
    { value: "tv", label: "TV Shows" },
    { value: "anime", label: "Anime" },
]

const MOVIE_SORT_MAP: Record<SortKey, DiscoverMovieSortBy> = {
    popularity: "popularity.desc",
    rating: "vote_average.desc",
    newest: "primary_release_date.desc",
    oldest: "primary_release_date.asc",
    az: "title.asc",
}

const TV_SORT_MAP: Record<SortKey, DiscoverTVSortBy> = {
    popularity: "popularity.desc",
    rating: "vote_average.desc",
    newest: "first_air_date.desc",
    oldest: "first_air_date.asc",
    az: "name.asc",
}

// TMDB has no native "anime" media type — Animation genre + Japan origin is the standard
// approximation used across most TMDB-backed apps.
const ANIME_GENRE_ID = 16
const ANIME_ORIGIN_COUNTRY = "JP" as CountryISO3166_1

export default function Discover() {
    const tmdb = useTmdb()
    const { open } = useMediaDrawer()

    // Deep-link params (e.g. a rail's "See more" → /discover?type=tv&genre=18 or ?type=movie&sort=rating).
    // Read once for initial state; validated against the known option sets so a bad param just defaults.
    const [searchParams] = useSearchParams()
    const [mediaKind, setMediaKind] = useState<MediaKind>(() => {
        const t = searchParams.get("type")
        return MEDIA_KIND_OPTIONS.some((o) => o.value === t) ? (t as MediaKind) : "movie"
    })
    const [genreIds, setGenreIds] = useState<number[]>(() => {
        const id = Number(searchParams.get("genre"))
        return searchParams.get("genre") && Number.isFinite(id) ? [id] : []
    })
    const [networkIds, setNetworkIds] = useState<number[]>([])
    const [studioIds, setStudioIds] = useState<number[]>([])
    const [sortKey, setSortKey] = useState<SortKey>(() => {
        const s = searchParams.get("sort")
        return SORT_OPTIONS.some((o) => o.value === s) ? (s as SortKey) : "popularity"
    })
    const [fromYear, setFromYear] = useState<number | null>(null)
    const [toYear, setToYear] = useState<number | null>(null)
    const [page, setPage] = useState(1)

    const effectiveType: "movie" | "tv" = mediaKind === "movie" ? "movie" : "tv"

    // Shared genre list for the filter bar (networks + studios are curated constants).
    const { genres } = useFilterOptions(tmdb, effectiveType)

    // Genre/network id spaces differ between movie and TV, so selections reset whenever the effective
    // TMDB type changes (Anime still maps to "tv"). Skip the first run so a genre arriving via ?genre=
    // survives mount; only reset when the user later switches media type.
    const didResetMountRef = useRef(false)
    useEffect(() => {
        if (!didResetMountRef.current) {
            didResetMountRef.current = true
            return
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGenreIds([])
        setNetworkIds([])
        setStudioIds([])
        setPage(1)
    }, [effectiveType])

    // Multiple genres/studios/networks broaden results ("any of these") via TMDB's OR (`|`) syntax.
    function buildMovieParams(pageOverride?: number): DiscoverMovieParams {
        const genrePart = genreIds

        return {
            page: pageOverride ?? page,
            sort_by: MOVIE_SORT_MAP[sortKey],
            ...(genrePart.length ? { with_genres: genrePart.join("|") } : {}),
            ...(studioIds.length ? { with_companies: studioIds.join("|") } : {}),
            ...(sortKey === "rating" ? { "vote_count.gte": 50 } : {}),
            ...(fromYear ? { "primary_release_date.gte": `${fromYear}-01-01` } : {}),
            ...(toYear ? { "primary_release_date.lte": `${toYear}-12-31` } : {}),
        }
    }

    function buildTvParams(pageOverride?: number): DiscoverTVParams {
        const genrePart = mediaKind === "anime" ? [...genreIds, ANIME_GENRE_ID] : genreIds

        return {
            page: pageOverride ?? page,
            sort_by: TV_SORT_MAP[sortKey],
            with_genres: genrePart.join("|"),
            ...(networkIds.length ? { with_networks: networkIds.join("|") } : {}),
            ...(studioIds.length ? { with_companies: studioIds.join("|") } : {}),
            ...(sortKey === "rating" ? { "vote_count.gte": 50 } : {}),
            ...(mediaKind === "anime" ? { with_origin_country: ANIME_ORIGIN_COUNTRY } : {}),
            ...(fromYear ? { "first_air_date.gte": `${fromYear}-01-01` } : {}),
            ...(toYear ? { "first_air_date.lte": `${toYear}-12-31` } : {}),
        }
    }

    function fetchPage(pageOverride?: number) {
        return effectiveType === "movie" ? tmdb.discover.movie(buildMovieParams(pageOverride)) : tmdb.discover.tv(buildTvParams(pageOverride))
    }

    const [results, setResults] = useState<ResultItem[]>([])
    const [totalPages, setTotalPages] = useState(1)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let mounted = true

        // Page 1 = a filter change (full reload → skeletons + replace). page>1 = infinite-scroll
        // load-more (append to the existing results).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (page === 1) setIsLoading(true)
        fetchPage()
            .then((data) => {
                if (!mounted) return
                const items = data.results.map((item) => ({ ...item, media_kind: effectiveType }) as ResultItem)
                setResults((prev) => (page === 1 ? items : [...prev, ...items]))
                setTotalPages(Math.max(1, Math.min(data.total_pages, 500)))
            })
            .catch((e) => {
                console.error(e)
                if (mounted && page === 1) {
                    setResults([])
                    setTotalPages(1)
                }
            })
            .finally(() => {
                if (mounted) setIsLoading(false)
            })

        return () => {
            mounted = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tmdb, effectiveType, mediaKind, sortKey, fromYear, toYear, page, genreIds.join(","), networkIds.join(","), studioIds.join(",")])

    const [isSurprising, setIsSurprising] = useState(false)

    async function surpriseMe() {
        setIsSurprising(true)
        try {
            const first = await fetchPage(1)
            const cappedPages = Math.max(1, Math.min(first.total_pages, 500))
            const randomPage = cappedPages > 1 ? Math.floor(Math.random() * cappedPages) + 1 : 1
            const pageResult = randomPage === 1 ? first : await fetchPage(randomPage)

            if (!pageResult.results.length) {
                toast.error("No matches for these filters.")
                return
            }

            const pick = pageResult.results[Math.floor(Math.random() * pageResult.results.length)]
            open({ type: effectiveType, id: pick.id })
        } catch (e) {
            console.error(e)
            toast.error("Couldn't find a surprise right now.")
        } finally {
            setIsSurprising(false)
        }
    }

    function toggleGenre(id: number) {
        setGenreIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))
        setPage(1)
    }

    function toggleNetwork(id: number) {
        setNetworkIds((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]))
        setPage(1)
    }

    function toggleStudio(id: number) {
        setStudioIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
        setPage(1)
    }

    const selectedMediaKindOption = MEDIA_KIND_OPTIONS.find((o) => o.value === mediaKind) ?? MEDIA_KIND_OPTIONS[0]
    // Hero reflects the CURRENT filters: it runs the same Discover query (page 1), so changing any
    // filter (media kind, genre, network, studio, sort, year) updates the carousel content too.
    const heroFetcher = useCallback(
        () => Promise.all([fetchPage(1)]),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tmdb, effectiveType, mediaKind, sortKey, fromYear, toYear, genreIds.join(","), networkIds.join(","), studioIds.join(",")]
    )

    return (
        <BrowseLayout tmdb={tmdb} heroFetcher={heroFetcher}>
            {/* Heading sits INLINE with the filters (like the Movies rail header); tight gap to the grid. */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="mr-1 text-2xl font-semibold">Discover</h1>
                        <MediaFilters
                            genres={genres}
                            genreIds={genreIds}
                            onToggleGenre={toggleGenre}
                            networkIds={networkIds}
                            onToggleNetwork={toggleNetwork}
                            showNetworks={effectiveType === "tv"}
                            studioIds={studioIds}
                            onToggleStudio={toggleStudio}
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

                    <div className="flex items-center gap-2">
                        <Combobox
                            items={MEDIA_KIND_OPTIONS}
                            value={selectedMediaKindOption}
                            onValueChange={(value) => {
                                if (!value) return
                                setMediaKind(value.value)
                                setPage(1)
                            }}
                        >
                            <ComboboxInput placeholder="Movies" className="w-40" />
                            <ComboboxContent>
                                <ComboboxEmpty>No matches</ComboboxEmpty>
                                <ComboboxList>
                                    {(item: (typeof MEDIA_KIND_OPTIONS)[number]) => (
                                        <ComboboxItem key={item.value} value={item}>
                                            {item.label}
                                        </ComboboxItem>
                                    )}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>

                        <Button onClick={surpriseMe} disabled={isSurprising}>
                            <ShuffleIcon className="size-4" />
                            Surprise me
                        </Button>
                    </div>
                </div>

                {/* Results use the same MediaGrid component as the "Your Movies/TV" library view. */}
                <MediaGrid
                    cards={results.map((item) => {
                        const isMovie = item.media_kind === "movie"
                        const date = isMovie ? (item as MovieResultItem).release_date : (item as DiscoverTVResultItem).first_air_date
                        return {
                            id: item.id,
                            type: item.media_kind,
                            title: isMovie ? (item as MovieResultItem).title : (item as DiscoverTVResultItem).name,
                            poster: item.poster_path,
                            year: date ? new Date(date).getFullYear() : 0,
                            rating: item.vote_average,
                        }
                    })}
                    loading={isLoading}
                    hasMore={page < totalPages}
                    onLoadMore={() => setPage((p) => p + 1)}
                    emptyDescription="Try widening your filters."
                />
            </div>
        </BrowseLayout>
    )
}
