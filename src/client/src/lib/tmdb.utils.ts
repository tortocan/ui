import type { CountryISO3166_1 } from "@lorenzopant/tmdb"

/** The TMDB image CDN base. Change this (or a size) in ONE place. */
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/"

export type TmdbImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "w1280" | "original"

/** Placeholder shown when a title/person has no image. Swap once here (also fed to the SDK fallback_url). */
export const FALLBACK_IMAGE = "/favicon.svg"

/**
 * Resolve a TMDB image path to a CDN URL at the given size. The http(s) passthrough is load-bearing:
 * the TMDB SDK (secure_images_url + autocomplete_paths) pre-resolves KNOWN fields (poster/backdrop/…)
 * to full URLs but leaves NESTED fields raw (company/network logo_path, collection backdrop,
 * watch-provider logo_path), so both forms reach here — a full URL is returned unchanged. Returns null
 * for empty input; callers apply their own `?? FALLBACK_IMAGE` where a src is required. The single
 * source for the ~7 hand-rolled `img()`/`logoUrl()` helpers that used to live across the card layer.
 */
export function tmdbImage(path: string | null | undefined, size: TmdbImageSize = "original"): string | null {
    if (!path) return null
    return path.startsWith("http") ? path : `${TMDB_IMAGE_BASE}${size}${path}`
}

/** The 4-digit year of a TMDB date string ("YYYY-MM-DD"), or 0. One impl (projections used to drift). */
export function yearOf(date: string | null | undefined): number {
    if (!date) return 0
    const y = Number(date.slice(0, 4))
    return Number.isFinite(y) ? y : 0
}

export function getCountry(): CountryISO3166_1 | undefined {
    try {
        const locale = new Intl.Locale(navigator.language)
        if (locale.region) return locale.region as unknown as CountryISO3166_1
    } catch {
        // continue
    }

    const fallback = navigator.language.split("-")[1]
    if (fallback) return fallback.toUpperCase() as unknown as CountryISO3166_1

    return undefined
}
