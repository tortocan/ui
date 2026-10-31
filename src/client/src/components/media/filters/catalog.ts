/**
 * Curated filter catalogs. Networks are TMDB TV networks (discover `with_networks`, TV only); Studios
 * are TMDB production companies (discover `with_companies`, movies & TV). Ids verified against the
 * TMDB /network/{id} and /company/{id} endpoints. Note company id 174 (Warner Bros. Pictures) and
 * network id 174 (AMC) collide across the two namespaces — that's expected, they're separate filters.
 */
export type CatalogEntry = { id: number; name: string }

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
