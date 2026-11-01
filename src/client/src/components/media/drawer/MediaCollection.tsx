import { useEffect, useMemo, useState } from "react"
import type { Language } from "@lorenzopant/tmdb"
import { Rail } from "@/components/media/MediaRail/Rail.tsx"
import { MediaCard } from "@/components/media/MediaRail/MediaCard.tsx"
import { useTmdb } from "@/hooks/use-tmdb"
import { useOmss } from "@/hooks/use-omss"
import { tmdbImage } from "@/lib/tmdb.utils"
import { RAIL_ITEM_CLASS, RAIL_CONTENT_CLASS } from "@/components/media/MediaRail/rail.constants"

const img = (path: string | null | undefined) => tmdbImage(path, "w342")

interface MediaCollectionProps {
    collectionId: number
    name: string
    /** The movie currently open — kept in the rail and emphasized as the current selection. */
    currentId: number
    /** Display language override (follows the detail's original-language toggle), e.g. "es"/"en-US". */
    language?: string
    /** Region override for the member cards' streaming-provider badges (follows the language toggle). */
    providerRegion?: string
}

/**
 * The "belongs to a collection" rail on a movie's detail page: the whole franchise in release order,
 * rendered as our standard {@link MediaCard}s (clicking opens that movie's drawer on top). The film
 * currently open is kept in the rail and emphasized (highlighted). Shown above Top Cast; self-hides
 * while loading or if the franchise has no members.
 */
export function MediaCollection({ collectionId, name, currentId, language, providerRegion }: MediaCollectionProps) {
    const tmdb = useTmdb()
    const { baseUrl, valid } = useOmss()
    const [cards, setCards] = useState<{ id: number; type: "movie"; title: string; poster: string | null; year: number; rating: number; rank: number }[] | null>(null)

    useEffect(() => {
        let cancelled = false
        setCards(null)
        void (async () => {
            try {
                const col = await tmdb.collections.details({ collection_id: collectionId, ...(language ? { language: language as Language } : {}) })
                const parts = col.parts ?? []

                // Chronological (saga) order from gatearr's Wikidata metadata provider: tmdbId → ordinal
                // under the shared series (e.g. Star Wars Episode numbers). Best-effort — any failure or
                // missing title falls back to release-date order.
                let chrono: Record<string, number> = {}
                if (valid && parts.length) {
                    try {
                        const ids = parts.map((p) => p.id).join(",")
                        const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/metadata/chronology?ids=${ids}`, { headers: { Accept: "application/json" } })
                        if (res.ok) chrono = ((await res.json()) as { data?: Record<string, number> })?.data ?? {}
                    } catch {
                        /* fall back to release-date order */
                    }
                }

                const members = [...parts]
                    .sort((a, b) => {
                        const oa = chrono[a.id]
                        const ob = chrono[b.id]
                        // Titles with a saga ordinal come first (ordered by it); the rest by release date.
                        if (oa != null && ob != null) return oa - ob
                        if (oa != null) return -1
                        if (ob != null) return 1
                        return (a.release_date || "9999").localeCompare(b.release_date || "9999")
                    })
                    .map((p, i) => ({
                        id: p.id,
                        type: "movie" as const,
                        title: p.title,
                        poster: img(p.poster_path),
                        year: p.release_date ? Number(p.release_date.slice(0, 4)) : 0,
                        rating: p.vote_average ?? 0,
                        rank: i + 1, // position in chronological order (contiguous, no gaps/dupes on partial data)
                    }))
                if (!cancelled) setCards(members)
            } catch {
                if (!cancelled) setCards([])
            }
        })()
        return () => {
            cancelled = true
        }
    }, [tmdb, collectionId, language, baseUrl, valid])

    const heading = useMemo(() => name || "Collection", [name])

    // Start the rail scrolled so the current film is visible (it may be the last entry). Embla's
    // startIndex applies at init; the Rail only mounts once `cards` is loaded (we return null before
    // that), so the index is correct on first paint.
    const activeIndex = useMemo(() => Math.max(0, (cards ?? []).findIndex((c) => c.id === currentId)), [cards, currentId])

    if (!cards || cards.length === 0) return null

    return (
        <section className="space-y-4">
            <h3 className="text-xl font-semibold">{heading}</h3>
            <Rail
                items={cards}
                getKey={(c) => c.id}
                itemClassName={RAIL_ITEM_CLASS}
                contentClassName={RAIL_CONTENT_CLASS}
                opts={{ align: "start", loop: false, dragFree: true, startIndex: activeIndex }}
                renderItem={(c) => <MediaCard id={c.id} type={c.type} title={c.title} imagePath={c.poster} imageAlt={c.title} year={c.year} rating={c.rating} active={c.id === currentId} providerRegion={providerRegion} rank={c.rank} />}
            />
        </section>
    )
}
