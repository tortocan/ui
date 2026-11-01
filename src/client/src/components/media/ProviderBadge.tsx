import { useEffect, useState } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { useAppSettings } from "@/hooks/use-appsettings.ts"
import { fetchWatchProviders, topProvider } from "@/lib/watch-providers"
import { tmdbImage } from "@/lib/tmdb.utils"
import { cn } from "@/lib/utils"

/**
 * The streaming-provider logo for a title, pinned top-right on a card. Resolves the top flatrate (else
 * rent/buy) watch provider for the active region (region prop overrides the profile region) via the
 * shared watch-providers cache. Renders nothing when the title has no provider in the region.
 */
export function ProviderBadge({ type, id, region: regionOverride, className }: { type: "movie" | "tv"; id: number; region?: string; className?: string }) {
    const tmdb = useTmdb()
    const { region: profileRegion } = useAppSettings()
    const region = regionOverride ?? profileRegion ?? "US"
    const [logo, setLogo] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setLogo(null) // clear first so a region/id change doesn't flash the previous region's logo
        void fetchWatchProviders(tmdb, type, id, region).then((set) => {
            if (!cancelled) setLogo(tmdbImage(topProvider(set)?.logo_path, "w92"))
        })
        return () => {
            cancelled = true
        }
    }, [tmdb, type, id, region])

    if (!logo) return null
    return <img src={logo} alt="" loading="lazy" className={cn("pointer-events-none absolute top-2 right-2 z-20 size-6 rounded-md bg-white/95 object-contain shadow-md ring-1 ring-black/10", className)} />
}
