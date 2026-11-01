import type { ReactNode } from "react"
import { ProviderBadge } from "@/components/media/ProviderBadge.tsx"
import { cn } from "@/lib/utils"

export interface LandscapeCardProps {
    /** 16:9 (Continue Watching) or 4:3 (Collections). */
    aspect?: "video" | "4/3"
    image?: string | null
    alt: string
    onClick: () => void
    /** Streaming-provider badge, top-right (region optional override). */
    provider?: { type: "movie" | "tv"; id: number; region?: string }
    className?: string
    /** Overlays painted over the image (bottom text block, hover Play, progress bar, …). */
    children?: ReactNode
}

/**
 * Shared Apple-TV-style landscape card shell for CollectionCard + ContinueWatchingCard (and any future
 * landscape tile): the focusable button, the lazy cover image (with a gradient fallback), the one
 * canonical bottom scrim, and the optional top-right ProviderBadge. Each card supplies only its own
 * overlay content as children, so the shell + scrim + badge placement live in exactly one place (they
 * had already drifted as copies). Root is a `group`, so children can use `group-hover:*`.
 */
export function LandscapeCard({ aspect = "video", image, alt, onClick, provider, className, children }: LandscapeCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "group relative block w-full overflow-hidden rounded-xl bg-muted text-left shadow-md transition-all hover:shadow-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                aspect === "video" ? "aspect-video" : "aspect-[4/3]",
                className
            )}
        >
            {image ? (
                <img src={image} alt={alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105" />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/40 to-black" />
            )}

            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.2)_45%,transparent_72%)]" />

            {provider ? <ProviderBadge type={provider.type} id={provider.id} region={provider.region} /> : null}

            {children}
        </button>
    )
}
