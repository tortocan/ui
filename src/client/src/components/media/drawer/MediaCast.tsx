import React from "react"
import { Rail } from "@/components/media/MediaRail/Rail.tsx"
import type { MediaCast as MediaCastType } from "./types/media.types"

interface MediaCastProps {
    cast: MediaCastType[]
}

export const MediaCast: React.FC<MediaCastProps> = ({ cast }) => {
    if (!cast.length) return null

    return (
        <section className="space-y-4">
            <h3 className="text-xl font-semibold">Top Cast</h3>

            <Rail
                items={cast}
                getKey={(person) => person.id}
                itemClassName="basis-1/4 pl-3 md:basis-1/6 lg:basis-1/8"
                contentClassName="-ml-3"
                renderItem={(person) => (
                    <div className="space-y-2">
                        <div className="overflow-hidden rounded-md bg-muted">
                            {person.profileUrl ? (
                                <img src={person.profileUrl} alt={person.name} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">No Image</div>
                            )}
                        </div>

                        <div className="space-y-1 text-center text-xs text-white">
                            <p className="truncate leading-tight font-medium">{person.name}</p>
                            <p className="truncate text-white/50">{person.character}</p>
                        </div>
                    </div>
                )}
            />
        </section>
    )
}
