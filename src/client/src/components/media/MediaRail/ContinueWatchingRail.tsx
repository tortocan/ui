import { useEffect, useState } from "react"
import { Rail } from "./Rail.tsx"
import { ContinueWatchingCard } from "./ContinueWatchingCard.tsx"
import { useOmss } from "@/hooks/use-omss"
import { useTmdb } from "@/hooks/use-tmdb"

type ContinueItem = {
    key: string
    id: number
    type: "movie" | "tv"
    title: string
    backdrop: string | null
    season?: number
    episode?: number
    runtime?: number
    progress: number
}

/**
 * Home-page "Continue Watching" rail, sourced from gatearr's scrobbler resume list
 * (`GET /scrobble/playback` — titles with a mid-range stored position). Each row is resolved to TMDB
 * for its poster/title and rendered as a MediaCard (clicking opens the drawer, where Play becomes
 * "Resume"); an episode row opens its show. A thin bar shows how far in you are. Renders nothing until
 * there's at least one in-progress title, so the home page is unchanged when the list is empty.
 */
export function ContinueWatchingRail() {
    const { client, valid } = useOmss()
    const tmdb = useTmdb()
    const [items, setItems] = useState<ContinueItem[] | null>(null)

    useEffect(() => {
        if (!valid) {
            setItems([])
            return
        }
        let cancelled = false
        void (async () => {
            const { data } = await client.getScrobblePlayback()
            const rows = data?.data ?? []
            const resolved = await Promise.all(
                rows.map(async (r): Promise<ContinueItem | null> => {
                    try {
                        if (r.mediaType === "movie") {
                            const m = await tmdb.movies.details({ movie_id: r.tmdbId })
                            return { key: r.mediaKey, id: r.tmdbId, type: "movie", title: m.title, backdrop: m.backdrop_path ?? null, runtime: m.runtime ?? undefined, progress: r.progress }
                        }
                        const s = await tmdb.tv_series.details({ series_id: r.tmdbId })
                        return { key: r.mediaKey, id: r.tmdbId, type: "tv", title: s.name, backdrop: s.backdrop_path ?? null, season: r.season ?? undefined, episode: r.episode ?? undefined, runtime: s.episode_run_time?.[0], progress: r.progress }
                    } catch {
                        return null
                    }
                })
            )
            if (!cancelled) setItems(resolved.filter((i): i is ContinueItem => i !== null))
        })()
        return () => {
            cancelled = true
        }
    }, [client, valid, tmdb])

    if (!items || items.length === 0) return null

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Continue Watching</h2>
            <Rail
                items={items}
                getKey={(it) => it.key}
                itemClassName="basis-4/5 pl-2 sm:basis-1/2 md:basis-1/3 md:pl-4 lg:basis-1/4 xl:basis-1/5 last:mr-4 md:last:mr-6"
                contentClassName="-ml-2 md:-ml-4"
                renderItem={(it) => (
                    <ContinueWatchingCard id={it.id} type={it.type} title={it.title} backdrop={it.backdrop} season={it.season} episode={it.episode} runtime={it.runtime} progress={it.progress} />
                )}
            />
        </div>
    )
}
