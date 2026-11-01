import { ArrowLeft, CheckCircle2, Clock3, Play } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Collection, CollectionItem } from "@lorenzopant/tmdb"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { useTmdb } from "@/hooks/use-tmdb"
import { useOmss } from "@/hooks/use-omss"
import { useOmssLibrary } from "@/hooks/use-omss-library.ts"
import { useFilterOptions } from "@/components/media/filters/useFilterOptions.ts"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer.ts"
import { cn } from "@/lib/utils.ts"

// Collection images may arrive as raw TMDB paths (the collections endpoint isn't always path-resolved
// by the client) — pass http(s) through, otherwise prepend the TMDB CDN base at a sensible size.
function img(path: string | null | undefined, size: "w780" | "w342" | "original"): string | null {
    if (!path) return null
    return path.startsWith("http") ? path : `https://image.tmdb.org/t/p/${size}${path}`
}

interface CollectionDrawerProps {
    id: number
    canGoBack: boolean
    isOpen: boolean
}

/**
 * Collection (movie-franchise) detail — the sibling of {@link MediaDrawer} for a `type: "collection"`
 * payload. Keeps the app's hero-drawer style (full-bleed backdrop + diagonal gradient, content anchored
 * bottom-left, detail sections floating up over it) but adapts the content to a franchise: a poster +
 * availability pill + "{N} Movies · genres" + Overview, and a grid of member movies tagged owned
 * (available) or not-yet (clock). Clicking a member opens its movie drawer on top (back returns here);
 * Play continues the franchise — the first in-progress owned movie, else the earliest unwatched/first.
 */
export function CollectionDrawer({ id, canGoBack, isOpen }: CollectionDrawerProps) {
    const tmdb = useTmdb()
    const { client, valid } = useOmss()
    const { open, close, closeAll } = useMediaDrawer()
    const { genres } = useFilterOptions(tmdb, "movie")
    const { library } = useOmssLibrary(true)
    const owned = useMemo(() => new Set(library.movies), [library.movies])

    const [col, setCol] = useState<Collection | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setCol(null)
        void (async () => {
            try {
                const data = await tmdb.collections.details({ collection_id: id })
                if (!cancelled) setCol(data)
            } catch {
                if (!cancelled) setCol(null)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [tmdb, id])

    // Pull-up / pull-down overscroll dismiss (mirrors MediaDrawer).
    const swipeRef = useRef<{ y: number; atTop: boolean } | null>(null)
    const onBodyWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.currentTarget.scrollTop <= 0 && e.deltaY < -24) closeAll()
    }
    const onBodyTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        swipeRef.current = { y: e.touches[0]?.clientY ?? 0, atTop: e.currentTarget.scrollTop <= 0 }
    }
    const onBodyTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        const start = swipeRef.current
        swipeRef.current = null
        if (!start || !start.atTop) return
        const end = e.changedTouches[0]?.clientY
        if (end != null && end - start.y > 60) closeAll()
    }

    // Member movies in chronological (release) order.
    const parts = useMemo(() => {
        const list = [...(col?.parts ?? [])]
        return list.sort((a, b) => (a.release_date || "9999").localeCompare(b.release_date || "9999"))
    }, [col])

    const ownedCount = useMemo(() => parts.filter((p) => owned.has(p.id)).length, [parts, owned])
    const availability = parts.length === 0 ? null : ownedCount === 0 ? "Unavailable" : ownedCount === parts.length ? "Available" : "Partially Available"

    // Up to three genre names, most frequent across the franchise first.
    const genreNames = useMemo(() => {
        if (!parts.length || !genres.length) return [] as string[]
        const counts = new Map<number, number>()
        for (const p of parts) for (const g of p.genre_ids ?? []) counts.set(g, (counts.get(g) ?? 0) + 1)
        const nameOf = new Map(genres.map((g) => [g.id, g.name]))
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([gid]) => nameOf.get(gid))
            .filter((n): n is string => !!n)
            .slice(0, 3)
    }, [parts, genres])

    // Continue the franchise from the scrobbler: first in-progress owned movie, else earliest unwatched
    // owned, else the first owned (fallback: the first part). Opens the resume-aware movie drawer.
    async function handlePlay() {
        const playable = parts.filter((p) => owned.has(p.id))
        const pool = playable.length ? playable : parts
        if (!pool.length) return
        if (valid && playable.length) {
            try {
                const states = await Promise.all(playable.map((m) => client.getScrobbleFor({ mediaType: "movie", tmdbId: m.id }).catch(() => null)))
                const inProgress = playable.find((_, i) => {
                    const s = states[i]
                    return s && s.progress > 2 && s.progress < 95
                })
                if (inProgress) return open({ type: "movie", id: inProgress.id })
                const unwatched = playable.find((_, i) => !states[i]?.watched)
                if (unwatched) return open({ type: "movie", id: unwatched.id })
            } catch {
                // fall through
            }
        }
        open({ type: "movie", id: pool[0].id })
    }

    const backdrop = img(col?.backdrop_path, "original")
    const poster = img(col?.poster_path, "w342")

    return (
        <Drawer open={isOpen} onOpenChange={(o) => !o && closeAll()}>
            <DrawerContent
                className="lenis-stopped lenis-disabled inset-0 mt-0 h-full max-h-none! max-w-none rounded-none! border-0! bg-black pt-0 outline-none"
                data-lenis-prevent="true"
                onInteractOutside={(e) => e.preventDefault()}
                headerActions={
                    canGoBack && (
                        <Button variant="outline" size="icon" onClick={close}>
                            <span className="sr-only">Back</span>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )
                }
            >
                <DrawerHeader className="sr-only">
                    <DrawerTitle>Collection</DrawerTitle>
                    <DrawerDescription>Collection details</DrawerDescription>
                </DrawerHeader>

                {loading ? (
                    <CollectionDrawerSkeleton />
                ) : !col ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Failed to load collection.</div>
                ) : (
                    <div className="relative h-full overflow-y-auto" onWheel={onBodyWheel} onTouchStart={onBodyTouchStart} onTouchEnd={onBodyTouchEnd}>
                        {/* HERO — full-bleed backdrop + diagonal gradient, content bottom-left (our style). */}
                        <section className="animate-in relative h-screen w-full overflow-hidden duration-700 fade-in">
                            <div className="absolute inset-0">
                                {backdrop ? (
                                    <img src={backdrop} alt={col.name} draggable={false} className="h-full w-full object-cover object-center" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">No backdrop available</div>
                                )}
                            </div>
                            <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(0,0,0,0.92)_10%,rgba(0,0,0,0.45)_45%,rgba(0,0,0,0.82)_100%)]" />

                            <div className="relative z-10 flex h-full items-end pb-[8vh] md:pb-[10vh]">
                                <div className="w-full px-6 sm:px-8 lg:px-12">
                                    <div className="flex max-w-3xl items-end gap-5">
                                        {poster && (
                                            <img
                                                src={poster}
                                                alt={col.name}
                                                draggable={false}
                                                className="hidden w-32 shrink-0 rounded-lg shadow-2xl ring-1 ring-white/10 sm:block md:w-40"
                                            />
                                        )}
                                        <div className="space-y-4">
                                            {availability && (
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                                                        availability === "Unavailable" ? "bg-white/15 text-white/80 backdrop-blur-md" : "bg-emerald-500 text-white"
                                                    )}
                                                >
                                                    {availability}
                                                </span>
                                            )}
                                            <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-2xl md:text-4xl lg:text-6xl">{col.name}</h1>
                                            <p className="text-sm font-medium text-white/80 sm:text-base">
                                                {parts.length} {parts.length === 1 ? "Movie" : "Movies"}
                                                {genreNames.length > 0 && <span className="text-white/50"> · {genreNames.join(", ")}</span>}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <Button className="rounded-full px-8 font-semibold shadow-lg transition-all hover:scale-105 hover:shadow-xl" onClick={() => void handlePlay()}>
                                                    <Play className="size-5 fill-white" />
                                                    {ownedCount > 0 ? "Play" : "View"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* DETAIL — float up over the hero's bottom (same overlap as MediaDrawer). */}
                        <div className="relative z-20 -mt-[8vh] px-4 pt-8 pb-10 text-white md:-mt-[10vh] md:px-8">
                            {col.overview && (
                                <section className="mb-8 max-w-3xl">
                                    <h2 className="mb-2 text-xl font-semibold">Overview</h2>
                                    <p className="leading-relaxed text-white/80">{col.overview}</p>
                                </section>
                            )}

                            <section>
                                <h2 className="mb-4 text-xl font-semibold">Movies</h2>
                                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
                                    {parts.map((p) => (
                                        <CollectionMemberCard key={p.id} part={p} available={owned.has(p.id)} onClick={() => open({ type: "movie", id: p.id })} />
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}

function CollectionMemberCard({ part, available, onClick }: { part: CollectionItem; available: boolean; onClick: () => void }) {
    const poster = img(part.poster_path, "w342")
    const year = part.release_date ? part.release_date.slice(0, 4) : ""
    return (
        <button type="button" onClick={onClick} className="group relative overflow-hidden rounded-xl bg-muted text-left ring-1 ring-white/10 transition-transform hover:scale-[1.03]">
            <div className="aspect-2/3 w-full">
                {poster ? (
                    <img src={poster} alt={part.title} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted-foreground">{part.title}</div>
                )}
            </div>

            {/* MOVIE tag top-left. */}
            <span className="absolute top-2 left-2 rounded-md bg-sky-600/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">Movie</span>

            {/* Availability: green check when owned, amber clock when not yet available. */}
            <span className="absolute top-2 right-2">
                {available ? <CheckCircle2 className="size-5 fill-emerald-500 text-white" /> : <Clock3 className="size-5 rounded-full bg-amber-500/90 p-0.5 text-white" />}
            </span>

            {/* Title + year on hover. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="truncate text-xs font-semibold text-white">{part.title}</div>
                {year && <div className="text-[10px] text-white/70">{year}</div>}
            </div>
        </button>
    )
}

function CollectionDrawerSkeleton() {
    return (
        <div className="relative h-full overflow-y-auto bg-black">
            <div className="sticky top-0 h-screen w-full">
                <div className="absolute inset-0 animate-pulse bg-muted" />
                <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />
            </div>
            <div className="relative z-20 -mt-[45vh] px-4 pb-10 md:px-8">
                <div className="mb-5 h-12 w-[40%] animate-pulse rounded-md bg-muted" />
                <div className="mb-6 h-4 w-48 animate-pulse rounded bg-muted" />
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="aspect-2/3 animate-pulse rounded-xl bg-muted" />
                    ))}
                </div>
            </div>
        </div>
    )
}
