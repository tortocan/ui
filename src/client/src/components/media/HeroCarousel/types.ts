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
    genres: string[]
    logo: string
    /** First network logo (TV only) and first production-company logo, if available. */
    networkLogo: string | null
    studioLogo: string | null
    /** YouTube trailer key (drives the hero's Trailer button); null when none. */
    trailer: string | null
    /** The title's original-language iso-639-1 code (drives the original-language toggle chip). */
    originalLanguage: string
}

export type DetailedMedia = MovieDetailsWithAppends<("images" | "videos")[]> | TVDetailsWithAppends<("images" | "videos")[]>

export type MixedMediaItem = { type: "movie"; id: number } | { type: "tv"; id: number }

export type HeroFetcherResult = () => Promise<(PaginatedResponse<MovieResultItem> | PaginatedResponse<TVSeriesResultItem>)[]>
