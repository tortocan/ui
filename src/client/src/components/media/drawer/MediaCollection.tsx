import { useEffect, useMemo, useState } from "react"
import type { Language } from "@lorenzopant/tmdb"
import { Rail } from "@/components/media/MediaRail/Rail.tsx"
import { MediaCard } from "@/components/media/MediaRail/MediaCard.tsx"
import { useTmdb } from "@/hooks/use-tmdb"

// Mirrors the library rail's slide sizing so the member cards read exactly like every other rail.
const RAIL_ITEM_CLASS = "basis-1/2 pl-2 sm:basis-1/3 md:basis-1/4 md:pl-4 lg:basis-1/5 xl:basis-1/7 last:mr-4 md:last:mr-6"

function img(path: string | null | undefined): string | null {
    if (!path) return null
    return path.startsWith("http") ? path : `https://image.tmdb.org/t/p/w342${path}`
}

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
    const [cards, setCards] = useState<{ id: number; type: "movie"; title: string; poster: string | null; year: number; rating: number; rank: number }[] | null>(null)

    useEffect(() => {
        let cancelled = false
        setCards(null)
        void (async () => {
            try {
                const col = await tmdb.collections.details({ collection_id: collectionId, ...(language ? { language: language as Language } : {}) })
                const members = [...(col.parts ?? [])]
                    // Chronological (release) order → the rank number reflects the franchise sequence.
                    .sort((a, b) => (a.release_date || "9999").localeCompare(b.release_date || "9999"))
                    .map((p, i) => ({
                        id: p.id,
                        type: "movie" as const,
                        title: p.title,
                        poster: img(p.poster_path),
                        year: p.release_date ? Number(p.release_date.slice(0, 4)) : 0,
                        rating: p.vote_average ?? 0,
                        rank: i + 1,
                    }))
                if (!cancelled) setCards(members)
            } catch {
                if (!cancelled) setCards([])
            }
        })()
        return () => {
            cancelled = true
        }
    }, [tmdb, collectionId, language])

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
                contentClassName="-ml-2 md:-ml-4"
                opts={{ align: "start", loop: false, dragFree: true, startIndex: activeIndex }}
                renderItem={(c) => <MediaCard id={c.id} type={c.type} title={c.title} imagePath={c.poster} imageAlt={c.title} year={c.year} rating={c.rating} active={c.id === currentId} providerRegion={providerRegion} rank={c.rank} />}
            />
        </section>
    )
}
