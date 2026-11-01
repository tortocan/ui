import { Play } from "lucide-react"
import { formatRuntime } from "@/components/media/drawer/mappers/media.mapper.ts"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer"

export interface ContinueWatchingCardProps {
    id: number
    type: "movie" | "tv"
    title: string
    backdrop?: string | null
    season?: number
    episode?: number
    /** Runtime in minutes (movie length, or a show's average episode length). */
    runtime?: number
    /** 0–100 resume progress. */
    progress: number
}

/**
 * Apple TV-style landscape card for the Continue Watching rail: a 16:9 backdrop under a bottom gradient
 * with the title, an "S{s}, E{e} · {runtime}" (or runtime for a movie) meta line, a hover Play glyph,
 * and a resume progress bar pinned to the bottom edge. Clicking opens the media drawer (resume-aware).
 */
export function ContinueWatchingCard({ id, type, title, backdrop, season, episode, runtime, progress }: ContinueWatchingCardProps) {
    const { open } = useMediaDrawer()

    const rt = formatRuntime(runtime ?? undefined)
    const meta = type === "tv" && season && episode ? `S${season}, E${episode}${rt ? ` · ${rt}` : ""}` : rt

    return (
        <button
            type="button"
            onClick={() => open({ type, id })}
            className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-muted text-left shadow-md transition-all hover:shadow-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
            <img src={backdrop ?? "/favicon.svg"} alt={title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105" />

            {/* Bottom gradient for legibility */}
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.15)_45%,transparent_70%)]" />

            {/* Hover Play glyph */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="flex size-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                    <Play className="size-6 fill-current" />
                </span>
            </div>

            {/* Title + meta */}
            <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-3 pb-4 text-white">
                <div className="truncate text-sm font-semibold drop-shadow-md">{title}</div>
                {meta && <div className="truncate text-xs font-medium text-white/85 drop-shadow">{meta}</div>}
            </div>

            {/* Resume progress bar */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
                <div className="h-full bg-primary" style={{ width: `${Math.max(2, Math.min(100, progress))}%` }} />
            </div>
        </button>
    )
}
