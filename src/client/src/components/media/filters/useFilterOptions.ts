import { useEffect, useState } from "react"
import type { CountryISO3166_1, Genre, TMDB, WatchProviderListItem } from "@lorenzopant/tmdb"

/**
 * Loads the genre list and the watch-provider list for a media type, shared by Discover and the
 * library filter bars. Providers are filtered to those available in the user's region and sorted by
 * that region's display priority (the raw list is ~700 global providers), so the prominent streaming
 * services surface first. See [[cinepro-ui-deploy]] for why.
 */
export function useFilterOptions(tmdb: TMDB, type: "movie" | "tv", region: string | undefined) {
    const [genres, setGenres] = useState<Genre[]>([])
    const [providers, setProviders] = useState<WatchProviderListItem[]>([])

    useEffect(() => {
        let mounted = true
        ;(type === "movie" ? tmdb.genres.movie_list() : tmdb.genres.tv_list())
            .then((d) => {
                if (mounted) setGenres(d.genres)
            })
            .catch((e) => console.error(e))
        return () => {
            mounted = false
        }
    }, [tmdb, type])

    useEffect(() => {
        let mounted = true
        const watchRegion = (region ?? "US") as CountryISO3166_1
        ;(type === "movie" ? tmdb.watch_providers.movie_providers() : tmdb.watch_providers.tv_providers())
            .then((data) => {
                if (!mounted) return
                const inRegion = data.results.filter((pr) => pr.display_priorities?.[watchRegion] != null)
                const list = (inRegion.length ? inRegion : data.results).sort(
                    (a, b) => (a.display_priorities?.[watchRegion] ?? a.display_priority) - (b.display_priorities?.[watchRegion] ?? b.display_priority)
                )
                setProviders(list)
            })
            .catch((e) => console.error(e))
        return () => {
            mounted = false
        }
    }, [tmdb, type, region])

    return { genres, providers }
}
