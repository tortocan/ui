import { useEffect, useState } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { useAppSettings } from "@/hooks/use-appsettings.ts"
import { cn } from "@/lib/utils"

// Module-level cache (keyed by type:id:region) so the same title's provider isn't re-fetched across the
// many cards that show it. Values are the in-flight/resolved promise, so concurrent cards dedupe too.
const cache = new Map<string, Promise<string | null>>()

function logoUrl(path?: string | null): string | null {
    if (!path) return null
    return path.startsWith("http") ? path : `https://image.tmdb.org/t/p/w92${path}`
}

type ProviderRow = { logo_path?: string | null; display_priority?: number }

function fetchProviderLogo(tmdb: ReturnType<typeof useTmdb>, type: "movie" | "tv", id: number, region: string): Promise<string | null> {
    const key = `${type}:${id}:${region}`
    const hit = cache.get(key)
    if (hit) return hit
    const p = (async () => {
        try {
            const res = type === "movie" ? await tmdb.movies.watch_providers({ movie_id: id }) : await tmdb.tv_series.watch_providers({ series_id: id })
            const rd = (res.results as Record<string, { flatrate?: ProviderRow[]; rent?: ProviderRow[]; buy?: ProviderRow[] }> | undefined)?.[region]
            const list = rd?.flatrate ?? rd?.rent ?? rd?.buy ?? []
            const top = [...list].sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))[0]
            return logoUrl(top?.logo_path)
        } catch {
            return null
        }
    })()
    cache.set(key, p)
    return p
}

/**
 * The streaming-provider logo for a title, pinned top-right on a card. Resolves the top flatrate (else
 * rent/buy) watch provider for the active region via TMDB (cached across cards + served through
 * gatearr's TMDB proxy). Renders nothing when the title has no provider in the region.
 */
export function ProviderBadge({ type, id, region: regionOverride, className }: { type: "movie" | "tv"; id: number; region?: string; className?: string }) {
    const tmdb = useTmdb()
    const { region: profileRegion } = useAppSettings()
    const region = regionOverride ?? profileRegion ?? "US"
    const [logo, setLogo] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setLogo(null) // clear first so a region/id change doesn't flash the previous region's logo
        void fetchProviderLogo(tmdb, type, id, region).then((l) => {
            if (!cancelled) setLogo(l)
        })
        return () => {
            cancelled = true
        }
    }, [tmdb, type, id, region])

    if (!logo) return null
    return <img src={logo} alt="" loading="lazy" className={cn("pointer-events-none absolute top-2 right-2 z-20 size-6 rounded-md bg-white/95 object-contain shadow-md ring-1 ring-black/10", className)} />
}
