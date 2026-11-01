import { useEffect, useState } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { useAppSettings } from "@/hooks/use-appsettings.ts"
import { cn } from "@/lib/utils"

type Provider = { provider_id: number; provider_name: string; logo_path?: string | null; display_priority?: number }

// Module-level cache (type:id:region) so the providers aren't re-fetched; served via gatearr's TMDB proxy.
const cache = new Map<string, Promise<Provider[]>>()

function logoUrl(path?: string | null): string | null {
    if (!path) return null
    return path.startsWith("http") ? path : `https://image.tmdb.org/t/p/w92${path}`
}

function fetchProviders(tmdb: ReturnType<typeof useTmdb>, type: "movie" | "tv", id: number, region: string): Promise<Provider[]> {
    const key = `${type}:${id}:${region}`
    const hit = cache.get(key)
    if (hit) return hit
    const p = (async () => {
        try {
            const res = type === "movie" ? await tmdb.movies.watch_providers({ movie_id: id }) : await tmdb.tv_series.watch_providers({ series_id: id })
            const rd = (res.results as Record<string, { flatrate?: Provider[] }> | undefined)?.[region]
            return [...(rd?.flatrate ?? [])].sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
        } catch {
            return []
        }
    })()
    cache.set(key, p)
    return p
}

/**
 * Inline row of streaming-platform logos a title is available on (flatrate / subscription) in the
 * active region (the per-profile TMDB Region). Shown next to Play/Trailer on the media detail. Renders
 * nothing when the title has no subscription provider in the region. Cached across uses.
 */
export function WatchProviders({ type, id, className }: { type: "movie" | "tv"; id: number; className?: string }) {
    const tmdb = useTmdb()
    const { region } = useAppSettings()
    const [list, setList] = useState<Provider[]>([])

    useEffect(() => {
        let cancelled = false
        setList([])
        void fetchProviders(tmdb, type, id, region ?? "US").then((l) => {
            if (!cancelled) setList(l)
        })
        return () => {
            cancelled = true
        }
    }, [tmdb, type, id, region])

    if (!list.length) return null

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {list.slice(0, 6).map((p) => {
                const src = logoUrl(p.logo_path)
                return src ? (
                    <img key={p.provider_id} src={src} alt={p.provider_name} title={p.provider_name} loading="lazy" className="size-9 rounded-md bg-white/95 object-contain shadow-md ring-1 ring-black/10" />
                ) : null
            })}
        </div>
    )
}
