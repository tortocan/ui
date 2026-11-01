import { useEffect, useState } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { useAppSettings } from "@/hooks/use-appsettings.ts"
import { fetchWatchProviders, type WatchProvider } from "@/lib/watch-providers"
import { tmdbImage } from "@/lib/tmdb.utils"
import { cn } from "@/lib/utils"

/**
 * Inline row of streaming-platform logos a title is available on (flatrate / subscription) in the
 * active region (the per-profile TMDB Region; region prop overrides it). Shown next to Play/Trailer on
 * the media detail. Renders nothing when the title has no subscription provider in the region. Shares
 * the watch-providers cache with {@link ProviderBadge} (one TMDB fetch per title+region).
 */
export function WatchProviders({ type, id, region: regionOverride, className }: { type: "movie" | "tv"; id: number; region?: string; className?: string }) {
    const tmdb = useTmdb()
    const { region: profileRegion } = useAppSettings()
    const region = regionOverride ?? profileRegion ?? "US"
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

    if (!list.length) return null

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {list.slice(0, 6).map((p) => {
                const src = tmdbImage(p.logo_path, "w92")
                return src ? (
                    <img key={p.provider_id} src={src} alt={p.provider_name} title={p.provider_name} loading="lazy" className="size-9 rounded-md bg-white/95 object-contain shadow-md ring-1 ring-black/10" />
                ) : null
            })}
        </div>
    )
}
