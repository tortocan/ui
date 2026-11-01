import * as React from "react"
import { Card, CardContent } from "@/components/ui/card.tsx"
import { cn } from "@/lib/utils.ts"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer"
import { StarRating } from "@/components/media/StarRating"
import { ProviderBadge } from "@/components/media/ProviderBadge.tsx"

export interface MediaCardProps {
    title: string
    imagePath?: string | null
    imageAlt?: string
    aspectRatio?: "portrait" | "landscape"
    className?: string
    type: "movie" | "tv"
    id: number
    rating: number
    year: number
    /** Emphasize this card as the current selection (e.g. the open title inside its own franchise rail). */
    active?: boolean
    /** Region override for the streaming-provider badge (e.g. follow a detail's language toggle). */
    providerRegion?: string
    /** Top-10-style rank number overlaid bottom-left (e.g. a title's position within its franchise). */
    rank?: number
}

// Performance reason: rails render 6-20+ of these per page; without memo, every rail
// re-render (e.g. a sibling rail loading) re-rendered every card in every other rail too.
export const MediaCard = React.memo(
    React.forwardRef<HTMLDivElement, MediaCardProps>(({ title, imagePath, imageAlt, aspectRatio = "portrait", className, rating, year, id, type, active = false, providerRegion, rank }, ref) => {
        const { open } = useMediaDrawer()

        return (
            <Card ref={ref} className={cn("group overflow-hidden border-none py-0 transition-all", className)} onClick={() => open({ type: type, id: id })}>
                <CardContent className="p-0">
                    <div className={cn("relative overflow-hidden rounded-md bg-muted transition-all", aspectRatio === "portrait" ? "aspect-2/3" : "aspect-video")}>
                        <img
                            src={imagePath ?? "/favicon.svg"}
                            alt={imageAlt || title}
                            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.08]"
                            loading="lazy"
                        />

                        {/* Current-selection emphasis: an inset ring overlay ON TOP of the poster, so it's
                            never clipped by the card's own overflow-hidden (an outset ring was). */}
                        {active && <div className="pointer-events-none absolute inset-0 z-30 rounded-md ring-4 ring-primary ring-inset" />}

                        {/* Streaming-provider logo, top-right. */}
                        <ProviderBadge type={type} id={id} region={providerRegion} />

                        {/* Top-10-style rank number (franchise order), upper-left, with a translucent
                            top→bottom gradient fill so the poster shows through, like Apple TV / Netflix. */}
                        {rank != null && (
                            <span
                                className="pointer-events-none absolute top-0 left-1 z-10 bg-gradient-to-b from-white/95 to-white/25 bg-clip-text text-7xl leading-none font-black text-transparent drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
                                aria-hidden
                            >
                                {rank}
                            </span>
                        )}

                        {/* Hover overlay */}
                        <div className="pointer-events-none absolute inset-0 flex items-end opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            {/* Gradient shadow */}
                            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />

                            {/* Text content */}
                            <div className="relative z-10 w-full p-3 text-white">
                                <div className="text-sm leading-tight font-semibold">{title}</div>

                                <div className={"mt-1 flex w-full justify-between text-xs font-medium"}>
                                    <StarRating rating={rating} />
                                    <span>{year}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    })
)

MediaCard.displayName = "MediaCard"
