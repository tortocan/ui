import { useEffect, useState } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { useAppSettings } from "@/hooks/use-appsettings.ts"
import { useOmssHome, localProviderLogo } from "@/hooks/use-omss-home"
import { fetchWatchProviders, topProvider } from "@/lib/watch-providers"
import { tmdbImage } from "@/lib/tmdb.utils"
import { cn } from "@/lib/utils"

/**
 * The streaming-provider logo for a title, pinned top-right on a card. LOCAL providers win: if gatearr
 * has the title on disk it shows the Radarr/Sonarr logo; otherwise it falls back to the top TMDB
 * flatrate (else rent/buy) watch provider for the active region. Renders nothing when neither applies.
 */
export function ProviderBadge({ type, id, region: regionOverride, className }: { type: "movie" | "tv"; id: number; region?: string; className?: string }) {
    const tmdb = useTmdb()
    const { region: profileRegion } = useAppSettings()
    const region = regionOverride ?? profileRegion ?? "US"
    const home = useOmssHome()
    const localLogo = localProviderLogo(home, type, id)
    const [tmdbLogo, setTmdbLogo] = useState<string | null>(null)

    useEffect(() => {
        // Local wins — skip the TMDB lookup entirely when gatearr owns the title.
        if (localLogo) {
            setTmdbLogo(null)
            return
        }
        let cancelled = false
        setTmdbLogo(null) // clear first so a region/id change doesn't flash the previous region's logo
        void fetchWatchProviders(tmdb, type, id, region).then((set) => {
            if (!cancelled) setTmdbLogo(tmdbImage(topProvider(set)?.logo_path, "w92"))
        })
        return () => {
            cancelled = true
        }
    }, [tmdb, type, id, region, localLogo])

    const logo = localLogo ?? tmdbLogo
    if (!logo) return null
    return <img src={logo} alt="" loading="lazy" className={cn("pointer-events-none absolute top-2 right-2 z-20 size-6 rounded-md bg-white/95 object-contain shadow-md ring-1 ring-black/10", className)} />
}
