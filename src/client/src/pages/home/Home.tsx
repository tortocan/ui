import { useCallback } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { HeroCarousel } from "@/components/media/HeroCarousel/HeroCarousel"
import { MovieRail, TvRail } from "@/components/media/MediaRail/TypedRails.tsx"
import { ContinueWatchingRail } from "@/components/media/MediaRail/ContinueWatchingRail.tsx"

export function HomePage() {
    const tmdb = useTmdb()

    // Performance reason: stable fetcher identities stop MediaRail/HeroCarousel from
    // re-fetching from TMDB whenever HomePage re-renders for unrelated reasons (theme,
    // drawer, search dialog state, etc).
    const fetchHero = useCallback(() => Promise.all([tmdb.movie_lists.now_playing(), tmdb.tv_lists.popular()]), [tmdb])
    const fetchPopularMovies = useCallback(() => tmdb.movie_lists.popular({}), [tmdb])
    const fetchTrendingTv = useCallback(() => tmdb.tv_lists.popular({}), [tmdb])
    const fetchTopRatedMovies = useCallback(() => tmdb.movie_lists.top_rated(), [tmdb])

    return (
        <div className="min-h-screen overflow-hidden">
            <HeroCarousel tmdb={tmdb} fetcher={fetchHero} />

            {/* Content floats ~10% up over the hero's bottom; transparent bg so the hero shows through. */}
            <section className="relative z-10 -mt-[8vh] flex flex-col gap-8 p-8 md:-mt-[10vh]">
                <ContinueWatchingRail />

                <MovieRail title="Popular Movies" fetcher={fetchPopularMovies} />

                <TvRail title="Trending TV Shows" fetcher={fetchTrendingTv} />

                <MovieRail title="Top Rated Movies" fetcher={fetchTopRatedMovies} />
            </section>
        </div>
    )
}

export default HomePage
