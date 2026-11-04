import { useCallback, useEffect, useState } from "react"
import type { TMDB } from "@lorenzopant/tmdb"

import { toHeroSlides } from "./mapper"
import { fetchDetailedMedia, resolveHeroFetcher } from "./utils"
import type { HeroFetcherResult, HeroSlide } from "./types"
import { toast } from "sonner"
import { useAppSettings, tmdbLanguageFor } from "@/hooks/use-appsettings"

export function useHeroSlides(tmdb: TMDB, fetcher: HeroFetcherResult) {
    const { locale } = useAppSettings()
    const [slides, setSlides] = useState<HeroSlide[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [reloadNonce, setReloadNonce] = useState(0)

    useEffect(() => {
        let mounted = true

        async function load() {
            setLoading(true)
            setError(false)

            try {
                const mixed = await resolveHeroFetcher(fetcher)
                const detailed = await fetchDetailedMedia(mixed, tmdb, tmdbLanguageFor(locale))

                const filtered = detailed.filter((m) => m.images.logos.length > 0 && (m.images.backdrops.length > 0 || m.backdrop_path !== undefined))

                if (!mounted) return
                setSlides(toHeroSlides(filtered))
            } catch (e) {
                console.error(e)
                if (!mounted) return
                setError(true)

                toast.error("TMDB movies could not be loaded.", {
                    description: "Please reload the page or try again later.",
                })
            } finally {
                if (mounted) setLoading(false)
            }
        }

        load()

        return () => {
            mounted = false
        }
    }, [tmdb, fetcher, reloadNonce, locale])

    const reload = useCallback(() => setReloadNonce((n) => n + 1), [])

    return { slides, loading, error, reload }
}
