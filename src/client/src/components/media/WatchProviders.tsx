import { useEffect, useState } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { useAppSettings } from "@/hooks/use-appsettings.ts"
import { useOmssHome, localProviderId, localProviderLogo } from "@/hooks/use-omss-home"
import { fetchWatchProviders, type WatchProvider } from "@/lib/watch-providers"
import { tmdbImage } from "@/lib/tmdb.utils"
import { cn } from "@/lib/utils"

/**
 * Inline row of streaming-platform logos a title is available on, next to Play/Trailer on the media
 * detail. LOCAL providers win: when gatearr has the title on disk its Radarr/Sonarr logo is shown
 * FIRST, ahead of the TMDB flatrate (subscription) providers for the active region. Renders nothing
 * when neither a local nor a subscription provider applies. Shares caches with {@link ProviderBadge}.
 */
export function WatchProviders({ type, id, region: regionOverride, className }: { type: "movie" | "tv"; id: number; region?: string; className?: string }) {
    const tmdb = useTmdb()
    const { region: profileRegion } = useAppSettings()
    const region = regionOverride ?? profileRegion ?? "US"
    const home = useOmssHome()
    const localLogo = localProviderLogo(home, type, id)
    const [list, setList] = useState<WatchProvider[]>([])

    useEffect(() => {
        let cancelled = false
        setList([])
        void fetchWatchProviders(tmdb, type, id, region).then((set) => {
            if (!cancelled) setList(set.flatrate)
        })
        return () => {
            cancelled = true
        }
    }, [tmdb, type, id, region])

    if (!localLogo && !list.length) return null

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {/* Local gatearr provider (Radarr/Sonarr) first — it wins over the streaming platforms. */}
            {localLogo && (
                <img
                    src={localLogo}
                    alt={localProviderId(type)}
                    title={localProviderId(type) === "radarr" ? "Radarr" : "Sonarr"}
                    loading="lazy"
                    className="size-9 rounded-md bg-white/95 object-contain shadow-md ring-1 ring-black/10"
                />
            )}
            {list.slice(0, 6).map((p) => {
                const src = tmdbImage(p.logo_path, "w92")
                return src ? (
                    <img key={p.provider_id} src={src} alt={p.provider_name} title={p.provider_name} loading="lazy" className="size-9 rounded-md bg-white/95 object-contain shadow-md ring-1 ring-black/10" />
                ) : null
            })}
        </div>
    )
}
