import { useEffect, useState } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { useAppSettings, tmdbLanguageFor } from "@/hooks/use-appsettings"
import { tmdbService } from "../services/tmdb.service"
import type { MediaType } from "../types/media.types"
import type { MovieDetails, TVSeriesDetails, TVEpisode } from "@lorenzopant/tmdb"

export function useMediaDetails(id: string, type: MediaType, season?: number, episode?: number) {
    const tmdb = useTmdb()
    const { locale } = useAppSettings()
    const language = tmdbLanguageFor(locale)
    const [details, setDetails] = useState<{
        movie?: MovieDetails
        show?: TVSeriesDetails
        episode?: TVEpisode
    }>({})
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string>()

    useEffect(() => {
        async function fetchDetails() {
            setIsLoading(true)
            try {
                if (type === "movie") {
                    const movie = await tmdbService.getMovieDetails(tmdb, id, language)
                    setDetails({ movie })
                } else {
                    // The show details and the episode details are independent TMDB reads — fetch them
                    // concurrently instead of serially so an episode open costs one round-trip, not two.
                    const [show, epDetails] = await Promise.all([
                        tmdbService.getTvDetails(tmdb, id, language),
                        season !== undefined && episode !== undefined
                            ? tmdbService.getEpisodeDetails(tmdb, id, season, episode, language)
                            : Promise.resolve<TVEpisode | undefined>(undefined),
                    ])
                    setDetails({ show, episode: epDetails })
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
            } finally {
                setIsLoading(false)
            }
        }

        fetchDetails()
    }, [id, type, season, episode, tmdb, language])

    return { details, isLoading, error }
}
