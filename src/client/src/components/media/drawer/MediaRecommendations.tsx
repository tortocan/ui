import React from "react"
import { Rail } from "@/components/media/MediaRail/Rail.tsx"
import { useMediaDrawer } from "./hooks/useMediaDrawer"
import type { MediaRecommendation } from "./types/media.types"
import { StarRating } from "@/components/media/StarRating"

interface MediaRecommendationsProps {
    recommendations: MediaRecommendation[]
}

export const MediaRecommendations: React.FC<MediaRecommendationsProps> = ({ recommendations }) => {
    const { open } = useMediaDrawer()

    if (!recommendations.length) return null

    return (
        <section className="space-y-4">
            <h3 className="text-xl font-semibold">Recommendations</h3>

            <Rail
                items={recommendations}
                getKey={(item) => item.id}
                itemClassName="basis-1/3 pl-4 md:basis-1/5 lg:basis-1/8"
                contentClassName="-ml-4"
                renderItem={(item) => (
                    <div className="group cursor-pointer space-y-2" onClick={() => open({ type: item.type, id: item.id })}>
                        <div className="relative aspect-auto overflow-hidden rounded-lg bg-muted">
                            {item.posterUrl || item.backdropUrl ? (
                                <img src={item.posterUrl || item.backdropUrl!} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">No Image</div>
                            )}
                            <div className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white backdrop-blur-sm">
                                <StarRating rating={item.rating} />
                            </div>
                        </div>
                        <p className="line-clamp-1 text-sm font-medium text-white transition-colors group-hover:text-primary">{item.title}</p>
                    </div>
                )}
            />
        </section>
    )
}
