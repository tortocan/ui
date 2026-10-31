import type { ReactNode } from "react"
import type { TMDB } from "@lorenzopant/tmdb"
import { HeroCarousel } from "@/components/media/HeroCarousel/HeroCarousel"
import type { HeroFetcherResult } from "@/components/media/HeroCarousel/types"

/**
 * Shared page shell for every browse-style page — Home, Movies, TV Shows, their library views, and
 * Discover. A HeroCarousel on top, then the page content floating ~10% up over the hero's bottom in a
 * transparent section (so the hero shows through the overlap). Children are the page's rails, grid, or
 * filters + grid. Keeps the hero + float layout in exactly one place.
 */
export function BrowseLayout({ tmdb, heroFetcher, children }: { tmdb: TMDB; heroFetcher: HeroFetcherResult; children: ReactNode }) {
    return (
        <div className="min-h-screen overflow-hidden">
            <HeroCarousel tmdb={tmdb} fetcher={heroFetcher} />

            {/* Content floats ~10% up over the hero's bottom; transparent bg so the hero shows through. */}
            <section className="relative z-10 -mt-[8vh] flex flex-col gap-8 p-8 md:-mt-[10vh]">{children}</section>
        </div>
    )
}
