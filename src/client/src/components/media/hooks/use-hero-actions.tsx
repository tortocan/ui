import { Languages, Play, RotateCcw } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import i18n from "@/app/i18n/i18n"
import { useOmss } from "@/hooks/use-omss"
import { useTmdbLanguages } from "@/hooks/use-tmdb-languages"
import { CHIP } from "@/components/media/TitleCardContent.tsx"
import { WatchProviders } from "@/components/media/WatchProviders.tsx"
import { TrailerDialog } from "@/components/media/drawer/TrailerDialog.tsx"
import { cn } from "@/lib/utils.ts"

// A representative streaming region for a language (TMDB watch-providers are region-keyed). Used so the
// original-language toggle also shows that language's availability. Uppercasing the iso-639-1 code
// already yields the right country for many European languages (es→ES, fr→FR …); the rest are explicit.
const LANG_REGION: Record<string, string> = { en: "US", es: "ES", pt: "BR", ja: "JP", ko: "KR", zh: "CN", hi: "IN", ar: "AE", uk: "UA", el: "GR", cs: "CZ", da: "DK", sv: "SE", nb: "NO", no: "NO" }
export function regionForLanguage(code: string): string {
    return LANG_REGION[code] ?? code.toUpperCase()
}

export interface HeroActionsMedia {
    type: "movie" | "tv"
    id: number
    title: string
    /** YouTube video key for the Trailer button; null/undefined hides it. */
    trailer?: string | null
    /** iso-639-1 original-language code; drives the toggle chip when it differs from the profile locale. */
    originalLanguage?: string | null
}

export interface UseHeroActionsOptions {
    media: HeroActionsMedia
    /** The profile (first) language. The toggle flips the displayed language between this and the original. */
    locale: string
    /** Controlled: the caller owns the toggle so it can also drive its own refetch (drawer → detail, carousel → slide). */
    showOriginal: boolean
    onToggleShowOriginal: (next: boolean) => void
    /** Disables the chip while a refetch is in flight. */
    isLoading?: boolean
    /** Run before navigating to the player (e.g. the drawer closes itself first). */
    onBeforePlay?: () => void
    /**
     * Gate the data-fetching actions (resume lookup + provider logos). The carousel passes the active
     * slide only, so inert slides don't each fire an OMSS resume + a TMDB watch-providers request.
     * Defaults to true (the drawer).
     */
    active?: boolean
}

export interface HeroActions {
    /** The original-language toggle chip for MediaHeroCard's `actionChips` slot (null when N/A). */
    actionChips: ReactNode
    /** Resume/Play label for MediaHeroCard's `playLabel` slot. */
    playLabel: ReactNode
    onPlay: () => void
    /** The Trailer dialog for MediaHeroCard's `secondary` slot (null when there's no trailer). */
    secondary: ReactNode
    /** The streaming-provider logos for MediaHeroCard's `afterActions` slot. */
    afterActions: ReactNode
    /** The language currently displayed (original when toggled on) — reuse for a collection rail etc. */
    displayLang: string
    /** The watch-provider region matching the displayed language (undefined → the profile/US default). */
    providerRegion: string | undefined
    /** The resume target, or null when the title isn't resumable. */
    resume: { season?: number; episode?: number } | null
}

/**
 * The shared hero action row — Resume (from the scrobbler), the original-language toggle chip, the
 * Trailer dialog, and the streaming-provider logos — assembled ONCE here and fed into {@link MediaHeroCard}'s
 * slots by BOTH the media-detail drawer and the home/discover hero carousel, so the two stay identical
 * by construction (DRY). The caller owns `showOriginal` so it can also refetch its own content in that
 * language; this hook derives the trailer language, the provider region, and the chip state from it.
 */
export function useHeroActions({ media, locale, showOriginal, onToggleShowOriginal, isLoading, onBeforePlay, active = true }: UseHeroActionsOptions): HeroActions {
    const { type, id, title, trailer, originalLanguage } = media
    const navigate = useNavigate()
    const { client, valid } = useOmss()
    const { labelOf } = useTmdbLanguages()

    // Turn Play into "Resume" from the scrobbler. Movie → "Resume" (stored position applied by the player);
    // show → "Resume · S{s}E{e}" and Play jumps straight to that episode. The backend owns the decision.
    const [resume, setResume] = useState<{ season?: number; episode?: number } | null>(null)
    useEffect(() => {
        let cancelled = false
        setResume(null)
        if (!valid || !active) return
        void client.getResume(type, id).then(({ data: rt }) => {
            if (cancelled || !rt || !rt.resumable) return
            setResume(rt.mediaType === "movie" ? {} : { season: rt.season, episode: rt.episode })
        })
        return () => {
            cancelled = true
        }
        // Keyed on the stable title identity so a language toggle (same title) never re-runs this and
        // flickers the Play button.
    }, [client, valid, active, type, id])

    // Action-row labels localize to the displayed language (Play/Resume/Trailer follow the toggle), the
    // same way the drawer scopes its chrome. Load that language's resources, then re-render.
    const uiLang = showOriginal && originalLanguage ? originalLanguage : locale
    const [, setLangTick] = useState(0)
    useEffect(() => {
        void i18n
            .loadLanguages(uiLang)
            .then(() => setLangTick((n) => n + 1))
            .catch(() => {})
    }, [uiLang])
    const t = i18n.getFixedT(uiLang, "common")

    // While showing the original language: the trailer plays in it and providers use the matching region.
    const displayLang = showOriginal && originalLanguage ? originalLanguage : locale
    const providerRegion = showOriginal && originalLanguage ? regionForLanguage(originalLanguage) : undefined

    // The toggle chip — only when the original language differs from the profile language. Green (profile
    // accent) while the original is showing; a plain chip otherwise.
    const canToggleLang = !!originalLanguage && originalLanguage !== locale
    const actionChips = canToggleLang ? (
        <button
            type="button"
            onClick={() => onToggleShowOriginal(!showOriginal)}
            disabled={isLoading}
            title={showOriginal ? "Showing the original language — click for your language" : "Show the original language"}
            className={cn(CHIP, "transition-colors", showOriginal ? "border-primary/60 bg-primary/25" : "hover:bg-white/20", isLoading && "opacity-60")}
        >
            <Languages className="size-4 opacity-80" />
            {labelOf(originalLanguage!)}
        </button>
    ) : null

    const onPlay = () => {
        const path = type === "movie" ? `/watch/movie/${id}` : resume?.episode != null ? `/watch/tv/${id}/?s=${resume.season}&e=${resume.episode}` : `/watch/tv/${id}`
        onBeforePlay?.()
        requestAnimationFrame(() => navigate(path))
    }

    const playLabel = resume ? (
        <>
            <RotateCcw className="size-5" />
            {t("detail.resume", "Resume")}
            {resume.episode != null ? ` · S${resume.season}E${resume.episode}` : ""}
        </>
    ) : (
        <>
            <Play className="size-5 fill-white" />
            {t("detail.play", "Play")}
        </>
    )

    const secondary = trailer ? <TrailerDialog trailerId={trailer} title={title} mediaType={type} tmdbId={id} language={displayLang} label={t("detail.trailer", "Trailer")} /> : null

    // Providers fetch per title; only render for the active hero so inert carousel slides don't each fetch.
    const afterActions = active ? <WatchProviders type={type} id={id} region={providerRegion} /> : null

    return { actionChips, playLabel, onPlay, secondary, afterActions, displayLang, providerRegion, resume }
}
