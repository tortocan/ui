import { MediaRail, type MediaRailProps } from "./MediaRail.tsx"
import { MediaCard } from "./MediaCard.tsx"
import { yearOf } from "@/lib/tmdb.utils"
import type { MovieResultItem, TVSeriesResultItem } from "@lorenzopant/tmdb"

type BaseMediaRailProps<T> = Omit<MediaRailProps<T>, "renderItem" | "getKey">

export type MovieRailProps = BaseMediaRailProps<MovieResultItem>

export function MovieRail({ seeMoreHref = "/movies", ...props }: MovieRailProps) {
    return (
        <MediaRail<MovieResultItem>
            {...props}
            seeMoreHref={seeMoreHref}
            getKey={(movie) => movie.id}
            renderItem={(movie) => (
                <MediaCard
                    title={movie.title}
                    imagePath={movie.poster_path}
                    imageAlt={movie.title}
                    id={movie.id}
                    type={"movie"}
                    year={yearOf(movie.release_date)}
                    rating={movie.vote_average}
                />
            )}
        />
    )
}

export type TvRailProps = BaseMediaRailProps<TVSeriesResultItem>

export function TvRail({ seeMoreHref = "/shows", ...props }: TvRailProps) {
    return (
        <MediaRail<TVSeriesResultItem>
            {...props}
            seeMoreHref={seeMoreHref}
            getKey={(tv) => tv.id}
            renderItem={(tv) => (
                <MediaCard title={tv.name} imagePath={tv.poster_path} imageAlt={tv.name} id={tv.id} type={"tv"} year={yearOf(tv.first_air_date)} rating={tv.vote_average} />
            )}
        />
    )
}
