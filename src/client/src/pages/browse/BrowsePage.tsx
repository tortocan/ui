import { useCallback, useEffect, useState } from "react"
import type { Genre, TMDB, TrendingParams } from "@lorenzopant/tmdb"
import { useTmdb } from "@/hooks/use-tmdb"
import { HeroCarousel } from "@/components/media/HeroCarousel/HeroCarousel"
import { HeroFade } from "@/components/media/HeroCarousel/HeroFade"
import { MovieRail, TvRail } from "@/components/media/MediaRail/TypedRails.tsx"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx"
import { useAppSettings } from "@/hooks/use-appsettings.ts"
import { useOmssLibrary } from "@/hooks/use-omss-library.ts"
import { LibraryGrid } from "@/components/media/LibraryGrid.tsx"

export type BrowseKind = "movie" | "tv"

type OmssLibrary = { movies: number[]; tv: number[] }
type RailComponent = typeof MovieRail | typeof TvRail

// Per-kind wiring so the Movies and TV Shows pages are ONE component. Each entry resolves the right
// TMDB endpoints, label, rail renderer and library slice; the hero + trending-toggle + genre-picker +
// popular + top-rated layout and the Discover "See more" deep links are identical and live once below.
const KIND: Record<
    BrowseKind,
    {
        noun: string
        genreSuffix: string
        genreList: (t: TMDB) => Promise<{ genres: Genre[] }>
        hero: (t: TMDB) => Promise<unknown>
        trending: (t: TMDB, range: TrendingParams) => Promise<unknown>
        byGenre: (t: TMDB, id?: number) => Promise<unknown>
        popular: (t: TMDB) => Promise<unknown>
        topRated: (t: TMDB) => Promise<unknown>
        Rail: RailComponent
        libraryIds: (lib: OmssLibrary) => number[]
    }
> = {
    movie: {
        noun: "Movies",
        genreSuffix: "Movies",
        genreList: (t) => t.genres.movie_list(),
        hero: (t) => Promise.all([t.movie_lists.now_playing()]),
        trending: (t, range) => t.trending.movies(range),
        byGenre: (t, id) => t.discover.movie({ with_genres: id }),
        popular: (t) => t.movie_lists.popular({}),
        topRated: (t) => t.movie_lists.top_rated(),
        Rail: MovieRail,
        libraryIds: (lib) => lib.movies,
    },
    tv: {
        noun: "TV Shows",
        genreSuffix: "Shows",
        genreList: (t) => t.genres.tv_list(),
        hero: (t) => Promise.all([t.tv_lists.popular()]),
        trending: (t, range) => t.trending.tv(range),
        byGenre: (t, id) => t.discover.tv({ with_genres: id }),
        popular: (t) => t.tv_lists.popular({}),
        topRated: (t) => t.tv_lists.top_rated(),
        Rail: TvRail,
        libraryIds: (lib) => lib.tv,
    },
}

/**
 * Shared browse page for both Movies (`kind="movie"`) and TV Shows (`kind="tv"`). Renders the hero plus
 * Trending (day/week toggle), by-genre (picker), Popular and Top Rated rails. Each rail's trailing
 * "See more" card deep-links into Discover pre-filtered by both media type and that rail's category
 * (genre or sort), so the browse experience is consistent and DRY across the two pages.
 */
export default function BrowsePage({ kind }: { kind: BrowseKind }) {
    const cfg = KIND[kind]
    const tmdb = useTmdb()
    const { libraryOnly } = useAppSettings()
    const { library, loading: libraryLoading } = useOmssLibrary(libraryOnly)
    const [trendingRange, setTrendingRange] = useState<TrendingParams>({ time_window: "day" })
    const [genres, setGenres] = useState<Genre[]>([])
    const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null)

    useEffect(() => {
        let mounted = true
        cfg.genreList(tmdb)
            .then((data) => {
                if (mounted) {
                    setGenres(data.genres)
                    setSelectedGenre(data.genres[0])
                }
            })
            .catch((e) => console.error(e))
        return () => {
            mounted = false
        }
    }, [tmdb, cfg])

    // Performance reason: stable fetcher identities so switching the trending range or genre doesn't
    // re-trigger network fetches for the unrelated rails below.
    const fetchHero = useCallback(() => cfg.hero(tmdb), [tmdb, cfg])
    const fetchTrending = useCallback(() => cfg.trending(tmdb, trendingRange), [tmdb, cfg, trendingRange])
    const fetchByGenre = useCallback(() => cfg.byGenre(tmdb, selectedGenre?.id), [tmdb, cfg, selectedGenre])
    const fetchPopular = useCallback(() => cfg.popular(tmdb), [tmdb, cfg])
    const fetchTopRated = useCallback(() => cfg.topRated(tmdb), [tmdb, cfg])

    // Discover deep links: always carry the media type, plus the rail's own category (genre or sort).
    const discover = (q: string) => `/discover?type=${kind}&${q}`
    const Rail = cfg.Rail

    // Library mode: show only the titles the OMSS server has (gatearr's /v1 media), not all of TMDB.
    if (libraryOnly) {
        return (
            <div className="min-h-screen">
                <section className="flex flex-col gap-6 bg-background p-8 pt-24">
                    <h2 className="text-2xl font-semibold">Your {cfg.noun}</h2>
                    <LibraryGrid ids={cfg.libraryIds(library)} type={kind} externalLoading={libraryLoading} />
                </section>
            </div>
        )
    }

    return (
        <div className="min-h-screen overflow-hidden">
            <HeroCarousel tmdb={tmdb} fetcher={fetchHero} />

            <HeroFade />

            <section className="flex flex-col gap-8 bg-background p-8">
                <Rail
                    title={
                        <div className={"flex items-center justify-between"}>
                            <h2 className="text-2xl font-semibold">Trending {cfg.noun}</h2>
                            <div className="ml-4 flex items-center gap-2">
                                <Button onClick={() => setTrendingRange({ time_window: "day" })} variant={trendingRange.time_window === "day" ? "default" : "secondary"}>
                                    Today
                                </Button>
                                <Button onClick={() => setTrendingRange({ time_window: "week" })} variant={trendingRange.time_window === "week" ? "default" : "secondary"}>
                                    This Week
                                </Button>
                            </div>
                        </div>
                    }
                    fetcher={fetchTrending}
                    seeMoreHref={discover("sort=popularity")}
                />

                <Rail
                    title={
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-semibold">{selectedGenre ? `${selectedGenre.name} ${cfg.genreSuffix}` : "Select Genre"}</h2>

                            <Select
                                value={selectedGenre?.id?.toString()}
                                onValueChange={(value) => {
                                    const genre = genres.find((g) => g.id.toString() === value)
                                    if (genre) setSelectedGenre(genre)
                                }}
                            >
                                <SelectTrigger className="w-55">
                                    <SelectValue placeholder="Select Genre" />
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectGroup>
                                        {genres.map((genre) => (
                                            <SelectItem key={genre.id} value={genre.id.toString()}>
                                                {genre.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    }
                    fetcher={fetchByGenre}
                    seeMoreHref={discover(selectedGenre ? `genre=${selectedGenre.id}` : "sort=popularity")}
                />

                <Rail title={`Popular ${cfg.noun}`} fetcher={fetchPopular} seeMoreHref={discover("sort=popularity")} />

                <Rail title={`Top Rated ${cfg.noun}`} fetcher={fetchTopRated} seeMoreHref={discover("sort=rating")} />
            </section>
        </div>
    )
}
