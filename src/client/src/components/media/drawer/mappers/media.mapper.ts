import type { MovieDetailsWithAppends, TVDetailsWithAppends, TVSeason } from "@lorenzopant/tmdb"
import { MOVIE_APPENDS, TV_APPENDS } from "../constants/tmdb"
import type { MediaCast, MediaEpisode, MediaNormalized, MediaRecommendation } from "../types/media.types"

type WithLogo = { logo_path?: string | null }

// Company/network logo_path may come through raw (the TMDB client only auto-resolves known image
// fields) — pass a full URL through, otherwise prepend the image base. Same helper as the hero carousel.
function logoUrl(path?: string | null): string | null {
    if (!path) return null
    return path.startsWith("http") ? path : `https://image.tmdb.org/t/p/w500${path}`
}

export const mapMedia = (data: MovieDetailsWithAppends<typeof MOVIE_APPENDS> | TVDetailsWithAppends<typeof TV_APPENDS>, type: "movie" | "tv"): MediaNormalized => {
    const isMovie = type === "movie"
    const movieData = isMovie ? (data as MovieDetailsWithAppends<typeof MOVIE_APPENDS>) : null
    const tvData = !isMovie ? (data as TVDetailsWithAppends<typeof TV_APPENDS>) : null

    // Provider logos: network (TV only) top-right, studio (production company) bottom-right — like the carousel.
    const companies = ((data as { production_companies?: WithLogo[] }).production_companies ?? []) as WithLogo[]
    const networks = (tvData?.networks ?? []) as WithLogo[]

    // Prefer an official YouTube Trailer, then any Trailer/Teaser/Clip, then any YouTube video —
    // long-running shows frequently expose only teasers/clips (or nothing) under "Trailer".
    const yt = (data.videos?.results ?? []).filter((v) => v.site === "YouTube")
    const trailer =
        yt.find((v) => v.type === "Trailer" && v.official)?.key ??
        yt.find((v) => v.type === "Trailer")?.key ??
        yt.find((v) => v.type === "Teaser")?.key ??
        yt.find((v) => v.type === "Clip")?.key ??
        yt[0]?.key ??
        null

    const cast: MediaCast[] =
        data.credits?.cast.slice(0, 10).map((c) => ({
            id: c.id,
            name: c.name,
            character: c.character,
            profileUrl: c.profile_path ?? `/favicon.svg`,
        })) || []

    const recommendations: MediaRecommendation[] =
        data.recommendations?.results.slice(0, 12).map((r) => ({
            id: r.id,
            type: ("media_type" in r ? r.media_type : isMovie ? "movie" : "tv") as "movie" | "tv",
            title: ("title" in r ? r.title : r.name) as string,
            posterUrl: r.poster_path ?? `/favicon.svg`,
            backdropUrl: r.backdrop_path ?? `/favicon.svg`,
            rating: r.vote_average,
        })) || []

    return {
        id: data.id,
        type,
        title: isMovie ? movieData!.title : tvData!.name,
        overview: data.overview ?? "",
        releaseDate: isMovie ? movieData!.release_date : tvData!.first_air_date,
        rating: data.vote_average,
        voteCount: data.vote_count,
        runtime: isMovie ? movieData!.runtime : tvData!.episode_run_time?.[0],
        genres: data.genres.map((g) => g.name),
        backdropUrl: data.backdrop_path ?? "/favicon.svg",
        posterUrl: data.poster_path ?? "/favicon.svg",
        logoUrl: data.images?.logos[0]?.file_path,
        networkLogo: logoUrl(networks.find((n) => n.logo_path)?.logo_path),
        studioLogo: logoUrl(companies.find((c) => c.logo_path)?.logo_path),
        trailer,
        cast,
        recommendations,
        seasons: tvData?.seasons?.map((s) => ({
            id: s.id,
            seasonNumber: s.season_number,
            name: s.name,
            episodeCount: s.episode_count,
            posterUrl: s.poster_path ?? `/favicon.svg`,
            airDate: s.air_date ?? "N/A",
        })),
        collection: movieData?.belongs_to_collection ? { id: movieData.belongs_to_collection.id, name: movieData.belongs_to_collection.name } : undefined,
    }
}

export const mapEpisodes = (season: TVSeason): MediaEpisode[] => {
    return season.episodes.map((e) => ({
        id: e.id,
        episodeNumber: e.episode_number,
        name: e.name,
        overview: e.overview,
        stillUrl: e.still_path?.replace("w300", "original") ?? `/favicon.svg`,
        airDate: e.air_date ?? "N/A",
        runtime: e.runtime ?? 0,
    }))
}

export function formatRuntime(runtime?: number) {
    if (!runtime) return null

    const hours = Math.floor(runtime / 60)
    const minutes = runtime % 60

    // "2h 53m", but drop a zero part: 120 → "2h", 45 → "45m".
    if (hours && minutes) return `${hours}h ${minutes}m`
    if (hours) return `${hours}h`
    return `${minutes}m`
}
