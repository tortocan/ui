import { useEffect, useState } from "react"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel.tsx"
import { MediaCard } from "./MediaCard.tsx"
import { useOmss } from "@/hooks/use-omss"
import { useTmdb } from "@/hooks/use-tmdb"

type ContinueItem = {
    key: string
    id: number
    type: "movie" | "tv"
    title: string
    poster: string | null
    year: number
    rating: number
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
                            return { key: r.mediaKey, id: r.tmdbId, type: "movie", title: m.title, poster: m.poster_path, year: m.release_date ? new Date(m.release_date).getFullYear() : 0, rating: m.vote_average, progress: r.progress }
                        }
                        const s = await tmdb.tv_series.details({ series_id: r.tmdbId })
                        return { key: r.mediaKey, id: r.tmdbId, type: "tv", title: s.name, poster: s.poster_path, year: s.first_air_date ? new Date(s.first_air_date).getFullYear() : 0, rating: s.vote_average, progress: r.progress }
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
            <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full">
                <CarouselContent className="-ml-2 md:-ml-4">
                    {items.map((it) => (
                        <CarouselItem key={it.key} className="basis-1/2 pl-2 sm:basis-1/3 md:basis-1/4 md:pl-4 lg:basis-1/5 xl:basis-1/7 last:mr-4 md:last:mr-6">
                            <div className="relative">
                                <MediaCard title={it.title} imagePath={it.poster} imageAlt={it.title} id={it.id} type={it.type} year={it.year} rating={it.rating} />
                                {/* Resume progress bar */}
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-md bg-white/25">
                                    <div className="h-full bg-primary" style={{ width: `${Math.max(2, Math.min(100, it.progress))}%` }} />
                                </div>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex" />
                <CarouselNext className="hidden md:flex" />
            </Carousel>
        </div>
    )
}
