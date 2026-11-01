import type { Language, MovieAppendToResponseNamespace, MovieDetailsWithAppends, TMDB, TVAppendToResponseNamespace, TVDetailsWithAppends } from "@lorenzopant/tmdb"
import { MOVIE_APPENDS, TV_APPENDS } from "../constants/tmdb"

// `language` overrides the client default (the profile language) — used to show a title in its
// original language. Omit for the profile language.
export const getMovieDetails = async (tmdb: TMDB, id: number, language?: string): Promise<MovieDetailsWithAppends<typeof MOVIE_APPENDS>> => {
    return (await tmdb.movies.details({
        movie_id: id,
        append_to_response: MOVIE_APPENDS.join(",") as unknown as MovieAppendToResponseNamespace[],
        ...(language ? { language: language as Language } : {}),
    })) as unknown as MovieDetailsWithAppends<typeof MOVIE_APPENDS>
}

export const getTVDetails = async (tmdb: TMDB, id: number, language?: string): Promise<TVDetailsWithAppends<typeof TV_APPENDS>> => {
    return (await tmdb.tv_series.details({
        series_id: id,
        append_to_response: TV_APPENDS.join(",") as unknown as TVAppendToResponseNamespace[],
        ...(language ? { language: language as Language } : {}),
    })) as unknown as TVDetailsWithAppends<typeof TV_APPENDS>
}

export const getSeasonDetails = async (tmdb: TMDB, tvId: number, seasonNumber: number) => {
    return await tmdb.tv_seasons.details({
        series_id: tvId,
        season_number: seasonNumber,
    })
}
