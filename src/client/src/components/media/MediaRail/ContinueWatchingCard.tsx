import { Play } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { formatRuntime } from "@/components/media/drawer/mappers/media.mapper.ts"
import { LandscapeCard } from "@/components/media/LandscapeCard.tsx"

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
 * Apple TV-style landscape card for the Continue Watching rail: a 16:9 backdrop (shared
 * {@link LandscapeCard} shell) with the title, an "S{s}, E{e} · {runtime}" (or runtime for a movie)
 * meta line, a hover Play glyph, and a resume progress bar pinned to the bottom edge. Clicking jumps
 * straight into the player, which seeks to the stored resume position on load (no detail drawer).
 */
export function ContinueWatchingCard({ id, type, title, backdrop, season, episode, runtime, progress }: ContinueWatchingCardProps) {
    const navigate = useNavigate()

    const rt = formatRuntime(runtime ?? undefined)
    const meta = type === "tv" && season && episode ? `S${season}, E${episode}${rt ? ` · ${rt}` : ""}` : rt

    // Resume directly. The player's useScrobble hook seeks to the saved position on load. For a show we
    // carry the in-progress season/episode straight through; a movie goes to its watch route.
    const watchPath = type === "movie" ? `/watch/movie/${id}` : season != null && episode != null ? `/watch/tv/${id}/?s=${season}&e=${episode}` : `/watch/tv/${id}`

    return (
        <LandscapeCard aspect="video" image={backdrop} alt={title} onClick={() => navigate(watchPath)} provider={{ type, id }}>
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
        </LandscapeCard>
    )
}
