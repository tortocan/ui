import { useCallback } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { BrowseLayout } from "@/components/media/BrowseLayout.tsx"
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
        <BrowseLayout tmdb={tmdb} heroFetcher={fetchHero}>
            <ContinueWatchingRail />

            <MovieRail title="Popular Movies" fetcher={fetchPopularMovies} seeMoreHref="/discover?type=movie&sort=popularity" />

            <TvRail title="Trending TV Shows" fetcher={fetchTrendingTv} seeMoreHref="/discover?type=tv&sort=popularity" />

            <MovieRail title="Top Rated Movies" fetcher={fetchTopRatedMovies} seeMoreHref="/discover?type=movie&sort=rating" />
        </BrowseLayout>
    )
}

export default HomePage
