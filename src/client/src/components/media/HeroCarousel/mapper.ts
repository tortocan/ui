import type { DetailedMedia, HeroSlide } from "./types"
import { formatRuntime } from "@/components/media/drawer/mappers/media.mapper.ts"
import { pickYouTubeTrailerKey, tmdbImage } from "@/lib/tmdb.utils"

type WithLogo = { logo_path?: string | null }

// Company/network logo_path comes through raw (the SDK only auto-resolves known image fields); w500.
const logoUrl = (path?: string | null) => tmdbImage(path, "w500")

export function toHeroSlides(mediaItems: DetailedMedia[]): HeroSlide[] {
    return mediaItems
        .filter((media) => media.images?.backdrops?.length || media.images?.posters?.length)
        .slice(0, 10)
        .map((media, index) => {
            const isMovie = "title" in media

            const title = isMovie ? media.title : media.name

            const year = isMovie ? media.release_date : media.first_air_date

            const companies = (media.production_companies ?? []) as WithLogo[]
            const networks = isMovie ? [] : ((media.networks ?? []) as WithLogo[])

            return {
                networkLogo: logoUrl(networks.find((n) => n.logo_path)?.logo_path),
                studioLogo: logoUrl(companies.find((c) => c.logo_path)?.logo_path),
                id: media.id,
                type: isMovie ? "movie" : "tv",
                title,
                year,
                rating: media.vote_average ? media.vote_average.toFixed(1) : "N/A",
                description: media.overview || "No description available.",
                image: media.backdrop_path ?? media.images.backdrops[0].file_path,
                badge: index >= 6 ? "Popular" : index >= 3 ? "Trending" : "New",
                // Movies → runtime chip as "Xh Ym"; TV → the status (Returning Series / Ended).
                runtime: isMovie ? (formatRuntime(media.runtime) ?? "") : (media.status ?? ""),
                genres: (media.genres ?? []).slice(0, 3).map((g) => g.name),
                logo: media.images.logos[0].file_path,
                trailer: pickYouTubeTrailerKey(media.videos?.results),
                originalLanguage: (media as { original_language?: string }).original_language ?? "",
            }
        })
}
