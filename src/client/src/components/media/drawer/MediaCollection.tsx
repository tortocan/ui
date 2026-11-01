import { useEffect, useMemo, useState } from "react"
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
    /** The movie currently open — excluded from its own franchise rail. */
    excludeId: number
}

/**
 * The "belongs to a collection" rail on a movie's detail page: the other films of the franchise,
 * rendered as our standard {@link MediaCard}s (clicking opens that movie's drawer on top). Shown above
 * Top Cast. Self-hides while loading or if the franchise has no other members.
 */
export function MediaCollection({ collectionId, name, excludeId }: MediaCollectionProps) {
    const tmdb = useTmdb()
    const [cards, setCards] = useState<{ id: number; type: "movie"; title: string; poster: string | null; year: number; rating: number }[] | null>(null)

    useEffect(() => {
        let cancelled = false
        setCards(null)
        void (async () => {
            try {
                const col = await tmdb.collections.details({ collection_id: collectionId })
                const members = [...(col.parts ?? [])]
                    .filter((p) => p.id !== excludeId)
                    .sort((a, b) => (a.release_date || "9999").localeCompare(b.release_date || "9999"))
                    .map((p) => ({
                        id: p.id,
                        type: "movie" as const,
                        title: p.title,
                        poster: img(p.poster_path),
                        year: p.release_date ? Number(p.release_date.slice(0, 4)) : 0,
                        rating: p.vote_average ?? 0,
                    }))
                if (!cancelled) setCards(members)
            } catch {
                if (!cancelled) setCards([])
            }
        })()
        return () => {
            cancelled = true
        }
    }, [tmdb, collectionId, excludeId])

    const heading = useMemo(() => name || "Collection", [name])

    if (!cards || cards.length === 0) return null

    return (
        <section className="space-y-4">
            <h3 className="text-xl font-semibold">{heading}</h3>
            <Rail
                items={cards}
                getKey={(c) => c.id}
                itemClassName={RAIL_ITEM_CLASS}
                contentClassName="-ml-2 md:-ml-4"
                renderItem={(c) => <MediaCard id={c.id} type={c.type} title={c.title} imagePath={c.poster} imageAlt={c.title} year={c.year} rating={c.rating} />}
            />
        </section>
    )
}
