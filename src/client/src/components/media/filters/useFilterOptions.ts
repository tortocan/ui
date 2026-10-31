import { useEffect, useState } from "react"
import type { Genre, TMDB } from "@lorenzopant/tmdb"

/**
 * Loads the genre list for a media type, shared by the Discover and library filter bars. Networks and
 * studios are curated constants (see catalog.ts), so only genres are fetched here.
 */
export function useFilterOptions(tmdb: TMDB, type: "movie" | "tv") {
    const [genres, setGenres] = useState<Genre[]>([])

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

    return { genres }
}
