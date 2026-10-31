import type { MovieDetailsWithAppends, MovieResultItem, PaginatedResponse, TVDetailsWithAppends, TVSeriesResultItem } from "@lorenzopant/tmdb"

export type HeroSlide = {
    id: number
    type: "movie" | "tv"
    title: string
    year: string
    rating: string
    description: string
    image: string
    badge: string
    runtime: string
    logo: string
    /** First network logo (TV only) and first production-company logo, if available. */
    networkLogo: string | null
    studioLogo: string | null
}

export type DetailedMedia = MovieDetailsWithAppends<"images"[]> | TVDetailsWithAppends<"images"[]>

export type MixedMediaItem = { type: "movie"; id: number } | { type: "tv"; id: number }

export type HeroFetcherResult = () => Promise<(PaginatedResponse<MovieResultItem> | PaginatedResponse<TVSeriesResultItem>)[]>
