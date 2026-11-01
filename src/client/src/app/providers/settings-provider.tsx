import React, { useMemo } from "react"
import { usePersistentState, useProfileState } from "@/hooks/use-localstorage"
import { AppSettingsContext, type SupportedLocales, type SubtitleFontSize, type SubtitleBackground } from "@/hooks/use-appsettings"
import type { CountryISO3166_1, Timezone, TMDBOptions } from "@lorenzopant/tmdb"
import { getCountry } from "@/lib/tmdb.utils"

const DEFAULT_TMDB_OPTIONS: TMDBOptions = {
    language: "en-US",
    region: undefined,
    images: {
        secure_images_url: true,
        autocomplete_paths: true,
        default_image_sizes: {
            posters: "original",
            backdrops: "original",
            logos: "original",
        },
        fallback_url: "/favicon.svg",
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone as Timezone,
    cache: true,
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
    const standalone = import.meta.env.VITE_STANDALONE === "true"

    // Per-profile (General / Playback / Appearance): scoped to the active profile, seeded from the
    // legacy global value so an existing user keeps their settings on first run.
    const [locale, setLocale] = useProfileState<SupportedLocales>("app.locale", "en")
    const [region, setRegion] = useProfileState<CountryISO3166_1 | undefined>("app.region", getCountry())
    const [autoplayNext, setAutoplayNext] = useProfileState<boolean>("app.autoplayNext", true)
    const [showHeaderIcons, setShowHeaderIcons] = useProfileState<boolean>("app.showHeaderIcons", true)
    const [showHeaderLogo, setShowHeaderLogo] = useProfileState<boolean>("app.showHeaderLogo", true)
    const [showCarouselDots, setShowCarouselDots] = useProfileState<boolean>("app.showCarouselDots", true)
    const [showFooter, setShowFooter] = useProfileState<boolean>("app.showFooter", true)
    const [subtitleFontSize, setSubtitleFontSize] = useProfileState<SubtitleFontSize>("app.subtitleFontSize", "lg")
    const [subtitleColor, setSubtitleColor] = useProfileState<string>("app.subtitleColor", "#ffffff")
    const [subtitleBackground, setSubtitleBackground] = useProfileState<SubtitleBackground>("app.subtitleBackground", "subtle")
    const [subtitlePosition, setSubtitlePosition] = useProfileState<number>("app.subtitlePosition", 15)

    // Global (not per-profile): transient UI state and the OMSS-library scope.
    const [showSearch, setShowSearch] = usePersistentState<boolean>("app.showSearch", false)
    const [libraryOnly, setLibraryOnly] = usePersistentState<boolean>("app.libraryOnly", false)

    const [tmdbApiKey, setTmdbApiKey] = usePersistentState<string>("app.tmdbApiKey", import.meta.env.VITE_TMDB_API_KEY)

    const tmdbOptions = useMemo<TMDBOptions>(
        () => ({
            ...DEFAULT_TMDB_OPTIONS,
            language: locale,
            region,
        }),
        [locale, region]
    )

    const setTmdbOptions = React.useCallback(
        (updater: React.SetStateAction<TMDBOptions>) => {
            const next = typeof updater === "function" ? updater(tmdbOptions) : updater
            if (next.language && next.language !== locale) setLocale(next.language as SupportedLocales)
            if (next.region !== region) setRegion(next.region as CountryISO3166_1)
        },
        [tmdbOptions, locale, region, setLocale, setRegion]
    )

    const value = useMemo(
        () => ({
            locale,
            region,
            autoplayNext,
            standalone,
            showSearch,
            libraryOnly,
            showHeaderIcons,
            showHeaderLogo,
            showCarouselDots,
            showFooter,
            subtitleFontSize,
            subtitleColor,
            subtitleBackground,
            subtitlePosition,
            tmdbApiKey,
            tmdbOptions,

            setLocale,
            setRegion,
            setAutoplayNext,
            setShowSearch,
            setLibraryOnly,
            setShowHeaderIcons,
            setShowHeaderLogo,
            setShowCarouselDots,
            setShowFooter,
            setSubtitleFontSize,
            setSubtitleColor,
            setSubtitleBackground,
            setSubtitlePosition,
            setTmdbApiKey,
            setTmdbOptions,
        }),
        [locale, region, autoplayNext, standalone, showSearch, libraryOnly, showHeaderIcons, showHeaderLogo, showCarouselDots, showFooter, subtitleFontSize, subtitleColor, subtitleBackground, subtitlePosition, tmdbApiKey, tmdbOptions, setLocale, setRegion, setAutoplayNext, setShowSearch, setLibraryOnly, setShowHeaderIcons, setShowHeaderLogo, setShowCarouselDots, setShowFooter, setSubtitleFontSize, setSubtitleColor, setSubtitleBackground, setSubtitlePosition, setTmdbApiKey, setTmdbOptions]
    )

    return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}
