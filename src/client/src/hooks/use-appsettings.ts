import React, { createContext, useContext } from "react"
import type { CountryISO3166_1, TMDBOptions } from "@lorenzopant/tmdb"

export const supportedLocales = [
    {
        iso639: "en",
        label: "English",
        primaryTranslationTmdb: "en-US",
    },
    {
        iso639: "zh",
        label: "中文",
        primaryTranslationTmdb: "zh-CN",
    },
    {
        iso639: "hi",
        label: "हिन्दी",
        primaryTranslationTmdb: "hi",
    },
    {
        iso639: "ko",
        label: "한국어",
        primaryTranslationTmdb: "ko",
    },
    {
        iso639: "de",
        label: "Deutsch",
        primaryTranslationTmdb: "de",
    },
    {
        iso639: "fr",
        label: "Français",
        primaryTranslationTmdb: "fr",
    },
    {
        iso639: "es",
        label: "Español",
        primaryTranslationTmdb: "es",
    },
    {
        iso639: "it",
        label: "Italiano",
        primaryTranslationTmdb: "it",
    },
] as const

/** A supported UI/metadata language — the iso639 code of one of {@link supportedLocales}. */
export type SupportedLocales = (typeof supportedLocales)[number]["iso639"]

/** The TMDB `language` (primary translation) for a language code, e.g. "en" → "en-US". A code that
 * isn't one of the UI locales (any TMDB iso-639-1, used for search-only languages) passes through. */
export function tmdbLanguageFor(locale: string): string {
    return supportedLocales.find((l) => l.iso639 === locale)?.primaryTranslationTmdb ?? locale
}

export type SubtitleFontSize = "sm" | "md" | "lg" | "xl"
export type SubtitleBackground = "none" | "subtle" | "solid"

export type AppSettings = {
    locale: SupportedLocales
    region?: CountryISO3166_1

    // Extra languages to search across (beyond the profile's own locale, which is always included).
    // Ordered (priority); any TMDB iso-639-1 code, not just the UI-translation locales. Empty = search
    // only the profile's language. Lets e.g. an English profile also find Spanish/Japanese/... titles.
    searchLocales: string[]

    autoplayNext: boolean
    showSearch: boolean
    standalone: boolean
    // When true, Movies/TV pages show only titles available on the OMSS server (gatearr's /v1
    // `media` list) instead of browsing all of TMDB.
    libraryOnly: boolean
    showHeaderIcons: boolean
    showHeaderLogo: boolean
    showCarouselDots: boolean
    showFooter: boolean

    // Subtitle appearance (applied by the player's CustomSubtitles overlay).
    subtitleFontSize: SubtitleFontSize
    subtitleColor: string // hex, e.g. "#ffffff"
    subtitleBackground: SubtitleBackground
    subtitlePosition: number // percent from the bottom of the video

    tmdbApiKey: string
    tmdbOptions: TMDBOptions

    setLocale: (locale: SupportedLocales) => void
    setRegion: (region: CountryISO3166_1) => void
    setSearchLocales: (value: string[]) => void
    setAutoplayNext: (value: boolean) => void
    setShowSearch: (value: boolean) => void
    setLibraryOnly: (value: boolean) => void
    setShowHeaderIcons: (value: boolean) => void
    setShowHeaderLogo: (value: boolean) => void
    setShowCarouselDots: (value: boolean) => void
    setShowFooter: (value: boolean) => void

    setSubtitleFontSize: (value: SubtitleFontSize) => void
    setSubtitleColor: (value: string) => void
    setSubtitleBackground: (value: SubtitleBackground) => void
    setSubtitlePosition: (value: number) => void

    setTmdbApiKey: (apiKey: string) => void
    setTmdbOptions: React.Dispatch<React.SetStateAction<TMDBOptions>>
}

export const AppSettingsContext = createContext<AppSettings | null>(null)

export function useAppSettings() {
    const ctx = useContext(AppSettingsContext)
    if (!ctx) {
        throw new Error("useAppSettings must be used within AppSettingsProvider")
    }
    return ctx
}
