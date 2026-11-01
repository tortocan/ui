import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import type { ScrobbleMediaType, ScrobbleState } from "@omss/sdk"
import { useOmss } from "@/hooks/use-omss"
import { useTmdb } from "@/hooks/use-tmdb"

export type ScrobbleHistoryItem = {
    key: string
    mediaType: ScrobbleMediaType
    tmdbId: number
    season: number
    episode: number
    progress: number
    watched: boolean
    updatedAt: number
    title: string
}

/**
 * Watch history / activity sourced from gatearr's scrobbler (the OMSS `/scrobble` extension), replacing
 * the old unwired localStorage history. Merges the resume list (in-progress) and the watched list into
 * one recency-ordered view, resolves each row's display title via TMDB, and exposes clear/remove that
 * mutate the backend. Gated on a reachable OMSS backend (`valid`).
 */
export function useScrobbleHistory() {
    const { client, valid } = useOmss()
    const tmdb = useTmdb()
    const [items, setItems] = useState<ScrobbleHistoryItem[]>([])
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async () => {
        if (!valid) {
            setItems([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            // History can be large (Trakt import seeds hundreds of watched rows); cap to the most recent
            // for a snappy settings panel. In-progress (playback) is small and shown in full.
            const [pb, hist] = await Promise.all([client.getScrobblePlayback(), client.getScrobbleHistory({ length: 100 })])
            const rows: ScrobbleState[] = [...(pb.data?.data ?? []), ...(hist.data?.data ?? [])]

            // playback (in-progress) and history (watched) are disjoint, but dedupe by key to be safe.
            const byKey = new Map<string, ScrobbleState>()
            for (const r of rows) byKey.set(r.mediaKey, r)
            const merged = [...byKey.values()].sort((a, b) => b.updatedAt - a.updatedAt)

            const withTitles = await Promise.all(
                merged.map(async (r): Promise<ScrobbleHistoryItem> => {
                    const base = {
                        key: r.mediaKey,
                        mediaType: r.mediaType,
                        tmdbId: r.tmdbId,
                        season: r.season,
                        episode: r.episode,
                        progress: r.progress,
                        watched: r.watched,
                        updatedAt: r.updatedAt,
                    }
                    // Prefer the denormalized title the backend stored (Trakt import / client POST) — only
                    // fall back to a TMDB lookup when it's missing, so a large history doesn't fan out
                    // into hundreds of TMDB calls.
                    if (r.title) {
                        return { ...base, title: r.mediaType === "movie" ? r.title : `${r.title} • S${r.season}E${r.episode}` }
                    }
                    try {
                        if (r.mediaType === "movie") {
                            const m = await tmdb.movies.details({ movie_id: r.tmdbId })
                            return { ...base, title: m.title }
                        }
                        const s = await tmdb.tv_series.details({ series_id: r.tmdbId })
                        return { ...base, title: `${s.name} • S${r.season}E${r.episode}` }
                    } catch {
                        return {
                            ...base,
                            title: r.mediaType === "movie" ? `Movie ${r.tmdbId}` : `Show ${r.tmdbId} • S${r.season}E${r.episode}`,
                        }
                    }
                })
            )
            setItems(withTitles)
        } catch {
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [client, tmdb, valid])

    useEffect(() => {
        void refresh()
    }, [refresh])

    // The OMSS SDK reports failures via { error }, not by throwing — only mutate on success, else the UI
    // would show a clear/remove that never reached the backend (this hook doesn't poll).
    const clear = useCallback(async () => {
        const { error } = await client.clearScrobbles()
        if (error) {
            toast.error("Couldn't clear history")
            return
        }
        setItems([])
    }, [client])

    const remove = useCallback(
        async (key: string) => {
            const { error } = await client.deleteScrobble(key)
            if (error) {
                toast.error("Couldn't remove from history")
                return
            }
            setItems((prev) => prev.filter((i) => i.key !== key))
        },
        [client]
    )

    return { items, loading, clear, remove, refresh }
}
