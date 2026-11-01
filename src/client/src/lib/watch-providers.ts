import type { TMDB } from "@lorenzopant/tmdb"

export type WatchProvider = { provider_id: number; provider_name: string; logo_path?: string | null; display_priority?: number }
export type WatchProviderSet = { flatrate: WatchProvider[]; rent: WatchProvider[]; buy: WatchProvider[] }

// ONE module-level cache (type:id:region) shared by every consumer — the single-logo ProviderBadge AND
// the inline WatchProviders row — so a title shown with both fetches TMDB once. Values are the
// in-flight/resolved promise, so concurrent callers dedupe too. Served via gatearr's TMDB proxy.
const cache = new Map<string, Promise<WatchProviderSet>>()
const EMPTY: WatchProviderSet = { flatrate: [], rent: [], buy: [] }

/** The region's streaming providers for a title, each category sorted by display_priority. Empty on error. */
export function fetchWatchProviders(tmdb: TMDB, type: "movie" | "tv", id: number, region: string): Promise<WatchProviderSet> {
    const key = `${type}:${id}:${region}`
    const hit = cache.get(key)
    if (hit) return hit
    const p = (async () => {
        try {
            const res = type === "movie" ? await tmdb.movies.watch_providers({ movie_id: id }) : await tmdb.tv_series.watch_providers({ series_id: id })
            const rd = (res.results as Record<string, Partial<WatchProviderSet>> | undefined)?.[region]
            const sort = (xs?: WatchProvider[]) => [...(xs ?? [])].sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
            return { flatrate: sort(rd?.flatrate), rent: sort(rd?.rent), buy: sort(rd?.buy) }
        } catch {
            // Don't cache a transient failure (proxy blip / rate-limit) — otherwise this title shows no
            // provider for the rest of the session. Evict so the next mount retries (mirrors use-omss-home).
            cache.delete(key)
            return EMPTY
        }
    })()
    cache.set(key, p)
    return p
}

/** The single most-prominent provider for a badge (flatrate → rent → buy), or null. */
export function topProvider(set: WatchProviderSet): WatchProvider | null {
    return set.flatrate[0] ?? set.rent[0] ?? set.buy[0] ?? null
}
