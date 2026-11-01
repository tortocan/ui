import type { ReactNode } from "react"
import { Calendar, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StarRating } from "@/components/media/StarRating"
import { cn } from "@/lib/utils"

export const CHIP = "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur-md"
// An unreleased title's date chip takes the primary accent (same color as the Play button) so an
// upcoming release reads at a glance.
const CHIP_UNRELEASED = "border-primary bg-primary text-primary-foreground"

/** True when the release date is in the future (title not yet released). */
function isUnreleased(date?: string | null): boolean {
    if (!date) return false
    const full = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
    const d = full ? new Date(Number(full[1]), Number(full[2]) - 1, Number(full[3])) : new Date(date)
    return !Number.isNaN(d.getTime()) && d.getTime() > Date.now()
}

/**
 * Release-date chip label. A full TMDB date ("YYYY-MM-DD") renders as "Jul 17, 2026" — parsed from its
 * parts so the local timezone can't shift it a day; a bare year (or anything without a day) falls back
 * to just the year. Returns null when there's no usable date.
 */
function formatReleaseDate(date?: string | null): string | null {
    if (!date) return null
    const full = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
    if (full) {
        const [, y, m, d] = full
        return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    }
    const year = new Date(date).getFullYear()
    return Number.isNaN(year) ? null : String(year)
}

export interface TitleCardContentProps {
    logoUrl?: string | null
    title: string
    /** Omit to hide the rating chip entirely (e.g. a collection has no single rating). */
    rating?: string | number
    /** Optional leading pill rendered before the chips (e.g. a collection availability badge). */
    badge?: ReactNode
    /** Extra accent chips rendered after the genres (e.g. "Collection"); each gets a Layers icon. */
    tags?: string[]
    /** Interactive chip(s) rendered at the end of the chip row (e.g. the original-language toggle). */
    actionChips?: ReactNode
    /** Release/first-air date string; the year is shown. */
    date?: string | null
    /** Runtime (movies) or status like "Returning Series"/"Ended" (TV). */
    meta?: string | null
    genres: string[]
    description?: string
    /** When set, the description is truncated to ~this many chars (hero); omit for the full text (drawer). */
    descriptionClampChars?: number
    /** Omit both to render no Play button (e.g. a collection detail). */
    playLabel?: ReactNode
    onPlay?: () => void
    /** Secondary action node (e.g. a "Learn more" button or the Trailer dialog). */
    secondary?: ReactNode
    /** Rendered at the end of the actions row, after the secondary action (e.g. streaming providers). */
    afterActions?: ReactNode
    /** Hero shows the buttons BELOW the description; the drawer shows them above it. */
    actionsBelowDescription?: boolean
    logoClassName?: string
}

/**
 * Shared title header used by the hero carousel slide and the media drawer: logo/title, a row of meta
 * chips (rating, year, runtime/status, genres), the Play + a secondary action, and the description.
 * Callers pass the Play label/handler (so the drawer can show "Resume …") and the secondary node
 * (Learn more vs Trailer), plus whether the actions sit above or below the description.
 */
export function TitleCardContent({
    logoUrl,
    title,
    rating,
    badge,
    tags,
    actionChips,
    date,
    meta,
    genres,
    description,
    descriptionClampChars,
    playLabel,
    onPlay,
    secondary,
    afterActions,
    actionsBelowDescription,
    logoClassName,
}: TitleCardContentProps) {
    const releaseLabel = formatReleaseDate(date)
    const unreleased = isUnreleased(date)

    const clamped =
        description && descriptionClampChars && description.length > descriptionClampChars ? `${description.slice(0, descriptionClampChars).split(" ").slice(0, -1).join(" ")}...` : description

    const chips = (
        <div className="flex flex-wrap items-center gap-2">
            {badge}
            {rating != null && rating !== "" && (
                <span className={CHIP}>
                    <StarRating rating={rating} className="font-semibold" />
                </span>
            )}
            {releaseLabel && (
                <span className={cn(CHIP, unreleased && CHIP_UNRELEASED)}>
                    <Calendar className="size-4 opacity-80" />
                    {releaseLabel}
                </span>
            )}
            {meta && <span className={CHIP}>{meta}</span>}
            {genres.slice(0, 3).map((g) => (
                <span key={g} className={CHIP}>
                    {g}
                </span>
            ))}
            {actionChips}
            {tags?.map((t) => (
                <span key={t} className={cn(CHIP, "border-primary/50 bg-primary/20")}>
                    <Layers className="size-4 opacity-80" />
                    {t}
                </span>
            ))}
        </div>
    )

    const actions =
        playLabel != null || secondary != null || afterActions != null ? (
            <div className="flex flex-wrap items-center gap-3">
                {playLabel != null && (
                    // Styled as a tag/chip (profile accent), matching the Collection / language tags.
                    <Button className={cn(CHIP, "h-auto border-primary/50 bg-primary/20 font-semibold shadow-lg transition-colors hover:bg-primary/30")} onClick={onPlay}>
                        {playLabel}
                    </Button>
                )}
                {secondary}
                {afterActions}
            </div>
        ) : null

    const desc = clamped ? <p className="max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">{clamped}</p> : null

    return (
        <div className="space-y-5">
            {logoUrl ? (
                <img src={logoUrl} alt={title} draggable={false} className={logoClassName ?? "max-h-34 max-w-[50vw] object-contain drop-shadow-2xl sm:max-w-140"} />
            ) : (
                <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-2xl md:text-4xl lg:text-6xl">{title}</h1>
            )}

            {chips}

            {actionsBelowDescription ? (
                <>
                    {desc}
                    {actions}
                </>
            ) : (
                <>
                    {actions}
                    {desc}
                </>
            )}
        </div>
    )
}
