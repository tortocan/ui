/**
 * Curated filter catalogs. The "Networks" filter uses `NETWORKS` (TMDB TV networks, discover
 * `with_networks`) for TV, and `STREAMING` (TMDB watch-provider ids, US; discover
 * `with_watch_providers`) for movies — movies have no TV networks, so there it means "streaming
 * availability". Studios are TMDB production companies (`with_companies`, movies & TV). Ids verified
 * against TMDB /network/{id}, /company/{id} and /watch/providers/movie. (company 174 Warner Bros. ==
 * network 174 AMC is fine — separate namespaces.)
 */
export type CatalogEntry = { id: number; name: string }

// Movie "Networks" = streaming availability via TMDB watch-provider ids (US region).
export const STREAMING: CatalogEntry[] = [
    { id: 8, name: "Netflix" },
    { id: 337, name: "Disney+" },
    { id: 9, name: "Prime Video" },
    { id: 350, name: "Apple TV+" },
    { id: 15, name: "Hulu" },
    { id: 1899, name: "HBO Max" },
    { id: 386, name: "Peacock" },
    { id: 2303, name: "Paramount+" },
    { id: 520, name: "discovery+" },
    { id: 43, name: "Starz" },
    { id: 526, name: "AMC+" },
]

export const NETWORKS: CatalogEntry[] = [
    { id: 213, name: "Netflix" },
    { id: 2739, name: "Disney+" },
    { id: 1024, name: "Prime Video" },
    { id: 2552, name: "Apple TV+" },
    { id: 453, name: "Hulu" },
    { id: 49, name: "HBO" },
    { id: 3186, name: "HBO Max" },
    { id: 4353, name: "discovery+" },
    { id: 3353, name: "Peacock" },
    { id: 4330, name: "Paramount+" },
    { id: 2, name: "ABC" },
    { id: 19, name: "FOX" },
    { id: 6, name: "NBC" },
    { id: 16, name: "CBS" },
    { id: 71, name: "The CW" },
    { id: 174, name: "AMC" },
    { id: 67, name: "Showtime" },
    { id: 318, name: "Starz" },
    { id: 359, name: "Cinemax" },
    { id: 4, name: "BBC One" },
    { id: 56, name: "Cartoon Network" },
    { id: 80, name: "Adult Swim" },
    { id: 13, name: "Nickelodeon" },
]

export const STUDIOS: CatalogEntry[] = [
    { id: 2, name: "Walt Disney Pictures" },
    { id: 420, name: "Marvel Studios" },
    { id: 3, name: "Pixar" },
    { id: 127928, name: "20th Century Studios" },
    { id: 174, name: "Warner Bros. Pictures" },
    { id: 429, name: "DC" },
    { id: 33, name: "Universal Pictures" },
    { id: 4, name: "Paramount Pictures" },
    { id: 5, name: "Sony Pictures" },
    { id: 7, name: "DreamWorks" },
    { id: 41077, name: "A24" },
]
