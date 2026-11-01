import { Layers } from "lucide-react"
import { LandscapeCard } from "@/components/media/LandscapeCard.tsx"

export interface CollectionCardProps {
    name: string
    backdrop?: string | null
    count: number
    /** A representative movie id, used for the top-right streaming-provider logo. */
    providerId?: number
    onClick: () => void
}

/**
 * Big Apple TV-style landscape card for a movie collection (franchise): the collection backdrop under a
 * gradient with its name + owned-movie count and a "Collection" tag. Clicking opens the collection
 * detail drawer (handled by the caller). Built on the shared {@link LandscapeCard} shell.
 */
export function CollectionCard({ name, backdrop, count, providerId, onClick }: CollectionCardProps) {
    return (
        <LandscapeCard aspect="4/3" image={backdrop} alt={name} onClick={onClick} provider={providerId ? { type: "movie", id: providerId } : undefined}>
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
        </LandscapeCard>
    )
}
