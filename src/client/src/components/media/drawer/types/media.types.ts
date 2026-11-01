export interface MediaNormalized {
    id: number
    type: "movie" | "tv"
    title: string
    overview: string
    releaseDate: string
    rating: number
    voteCount: number
    runtime?: number
    genres: string[]
    backdropUrl: string | null
    posterUrl: string | null
    logoUrl: string | null
    /** First network logo (TV) and first production-company logo — shown by MediaHeroCard like the carousel. */
    networkLogo: string | null
    studioLogo: string | null
    trailer: string | null
    cast: MediaCast[]
    recommendations: MediaRecommendation[]
    seasons?: MediaSeason[]
    /** The TMDB franchise this movie belongs to, when any (drives the "Collection" tag + rail). */
    collection?: { id: number; name: string }
    /** The title's original-language iso-639-1 code (drives the original-language toggle tag). */
    originalLanguage?: string
}

export interface MediaCast {
    id: number
    name: string
    character: string
    profileUrl: string | null
}

export interface MediaRecommendation {
    id: number
    type: "movie" | "tv"
    title: string
    posterUrl: string | null
    backdropUrl: string | null
    rating: number
}

export interface MediaSeason {
    id: number
    seasonNumber: number
    name: string
    episodeCount: number
    posterUrl: string | null
    airDate: string
}

export interface MediaEpisode {
    id: number
    episodeNumber: number
    name: string
    overview: string
    stillUrl: string | null
    airDate: string
    runtime: number | null
}
