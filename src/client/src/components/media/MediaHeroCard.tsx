import type { ReactNode } from "react"
import { TitleCardContent } from "@/components/media/TitleCardContent.tsx"
import { cn } from "@/lib/utils"

export interface MediaHeroCardProps {
    /** Full-bleed backdrop image. */
    image?: string | null
    logoUrl?: string | null
    title: string
    rating: string | number
    /** Release/first-air date (the year is shown). */
    date?: string | null
    /** Runtime (movies) or status (TV). */
    meta?: string | null
    genres: string[]
    description?: string
    /** Truncate the description to ~this many chars (hero slide); omit for the full text (drawer). */
    descriptionClampChars?: number
    /** Optional provider logos: network top-right, studio bottom-right. */
    networkLogo?: string | null
    studioLogo?: string | null
    playLabel: ReactNode
    onPlay: () => void
    /** Secondary action (Learn more in the carousel, Trailer in the drawer). */
    secondary?: ReactNode
    logoClassName?: string
    /** Section height. Carousel: h-[80vh] md:h-screen (default); drawer: h-screen. */
    heightClassName?: string
    className?: string
}

/**
 * The full-bleed title hero card: a backdrop image under a diagonal gradient with the shared
 * {@link TitleCardContent} (logo, meta chips, Play + a secondary action, description) anchored
 * bottom-left, plus optional network/studio provider logos. This is the single card the home hero
 * carousel renders per slide AND the media-details modal uses as its header, so the two stay visually
 * identical by construction.
 */
export function MediaHeroCard({
    image,
    logoUrl,
    title,
    rating,
    date,
    meta,
    genres,
    description,
    descriptionClampChars,
    networkLogo,
    studioLogo,
    playLabel,
    onPlay,
    secondary,
    logoClassName,
    heightClassName,
    className,
}: MediaHeroCardProps) {
    return (
        <section className={cn("relative w-full overflow-hidden", heightClassName ?? "h-[80vh] md:h-screen", className)}>
            <div className="absolute inset-0">
                {image ? (
                    <img src={image} alt={title} draggable={false} className="h-full w-full object-cover object-center" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">No backdrop available</div>
                )}
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(0,0,0,0.92)_10%,rgba(0,0,0,0.45)_45%,rgba(0,0,0,0.82)_100%)]" />

            {/* Network logo top-right, studio logo bottom-right. */}
            {networkLogo && (
                <img
                    src={networkLogo}
                    alt=""
                    className="pointer-events-none absolute top-20 right-6 z-10 max-h-20 w-auto max-w-[220px] object-contain opacity-90 [filter:invert(1)_hue-rotate(180deg)] sm:right-8 lg:right-12"
                />
            )}
            {studioLogo && (
                <img
                    src={studioLogo}
                    alt=""
                    // Lift above the bottom-10% float band (mirrors the hero text) so it isn't covered.
                    className="pointer-events-none absolute right-6 bottom-[calc(2rem+8vh)] z-10 max-h-20 w-auto max-w-[240px] object-contain opacity-90 [filter:invert(1)_hue-rotate(180deg)] sm:right-8 md:bottom-[calc(2rem+10vh)] lg:right-12"
                />
            )}

            {/* pb-[…vh] lifts the text/buttons up ~10% so they clear content floating over the bottom. */}
            <div className="relative z-10 flex h-full items-end pb-[8vh] md:pb-[10vh]">
                {/* Flush-left (no mx-auto/max-w centering) so the text hugs the left edge. */}
                <div className="w-full px-6 sm:px-8 lg:px-12">
                    <div className="max-w-2xl">
                        <TitleCardContent
                            logoUrl={logoUrl}
                            title={title}
                            rating={rating}
                            date={date}
                            meta={meta}
                            genres={genres}
                            description={description}
                            descriptionClampChars={descriptionClampChars}
                            actionsBelowDescription
                            logoClassName={logoClassName ?? "max-h-34 max-w-[50vw] object-contain sm:max-w-140"}
                            onPlay={onPlay}
                            playLabel={playLabel}
                            secondary={secondary}
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}
