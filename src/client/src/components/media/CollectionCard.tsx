import { Layers } from "lucide-react"
import { ProviderBadge } from "@/components/media/ProviderBadge.tsx"

export interface CollectionCardProps {
    name: string
    backdrop?: string | null
    count: number
    /** A representative movie id, used for the top-right streaming-provider logo. */
    providerId?: number
    onClick: () => void
}

/**
 * Big Apple TV-style landscape card for a movie collection (franchise). Shows the collection backdrop
 * under a gradient with its name + owned-movie count and a "Collection" tag. Clicking opens the
 * collection detail drawer (handled by the caller).
 */
export function CollectionCard({ name, backdrop, count, providerId, onClick }: CollectionCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted text-left shadow-md transition-all hover:shadow-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
            {backdrop ? (
                <img src={backdrop} alt={name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105" />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/40 to-black" />
            )}

            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.2)_45%,transparent_72%)]" />

            {/* Streaming-provider logo of a representative movie, top-right. */}
            {providerId ? <ProviderBadge type="movie" id={providerId} /> : null}

            <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-4 text-white">
                <div className="flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-wide text-white/75 uppercase">
                    <Layers className="size-3.5" />
                    Collection
                </div>
                <div className="truncate text-lg font-bold drop-shadow-md">{name}</div>
                <div className="text-xs font-medium text-white/85 drop-shadow">
                    {count} {count === 1 ? "movie" : "movies"}
                </div>
            </div>
        </button>
    )
}
