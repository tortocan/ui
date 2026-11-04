import { TMDB, type Language } from "@lorenzopant/tmdb"

// `language` is passed explicitly on every call so the TMDB SDK response cache (cache:true) is keyed by
// language; a language-less request collides with whatever language was cached first for that id, which
// surfaced titles in the wrong language (see MediaDrawer).
export const tmdbService = {
    getMovieDetails: async (tmdb: TMDB, id: string, language?: string) => {
        return await tmdb.movies.details({ movie_id: parseInt(id), ...(language ? { language: language as Language } : {}) })
    },

    getTvDetails: async (tmdb: TMDB, id: string, language?: string) => {
        return await tmdb.tv_series.details({ series_id: parseInt(id), ...(language ? { language: language as Language } : {}) })
    },

    getEpisodeDetails: async (tmdb: TMDB, showId: string, season: number, episode: number, language?: string) => {
        return await tmdb.tv_episodes.details({
            series_id: parseInt(showId),
            season_number: season,
            episode_number: episode,
            ...(language ? { language: language as Language } : {}),
        })
    },

    getSeasonDetails: async (tmdb: TMDB, showId: string, season: number) => {
        return await tmdb.tv_seasons.details({
            series_id: parseInt(showId),
            season_number: season,
        })
    },
}
