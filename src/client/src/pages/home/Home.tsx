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
    const fetchUpcomingMovies = useCallback(() => tmdb.movie_lists.upcoming(), [tmdb])
    const fetchTrendingTv = useCallback(() => tmdb.tv_lists.popular({}), [tmdb])
    // TMDB has no native "upcoming TV" list; on_the_air (airing in the next ~7 days) is the
    // closest, and matches what Overseerr surfaces as "Upcoming Series".
    const fetchUpcomingTv = useCallback(() => tmdb.tv_lists.on_the_air(), [tmdb])
    const fetchTopRatedMovies = useCallback(() => tmdb.movie_lists.top_rated(), [tmdb])

    return (
        <BrowseLayout tmdb={tmdb} heroFetcher={fetchHero}>
            <ContinueWatchingRail />

            <MovieRail title="Popular Movies" fetcher={fetchPopularMovies} seeMoreHref="/discover?type=movie&sort=popularity" />

            <MovieRail title="Upcoming Movies" fetcher={fetchUpcomingMovies} seeMoreHref="/discover?type=movie&sort=newest" />

            <TvRail title="Trending TV Shows" fetcher={fetchTrendingTv} seeMoreHref="/discover?type=tv&sort=popularity" />

            <TvRail title="Upcoming Series" fetcher={fetchUpcomingTv} seeMoreHref="/discover?type=tv&sort=newest" />

            <MovieRail title="Top Rated Movies" fetcher={fetchTopRatedMovies} seeMoreHref="/discover?type=movie&sort=rating" />
        </BrowseLayout>
    )
}

export default HomePage
