import { useEffect, useMemo, useState } from "react"
import { useTmdb } from "@/hooks/use-tmdb"
import { supportedLocales } from "@/hooks/use-appsettings"

export type TmdbLanguage = { code: string; label: string; native?: string }

/**
 * The full list of TMDB languages (iso-639-1), fetched once via the cached /tmdb proxy, plus a
 * `labelOf(code)` resolver. `label` is the ENGLISH name — native names can be empty or render as
 * "?????", so they're kept only for search matching. UI-locale native labels (中文, हिन्दी …) are
 * preferred by labelOf so the configured profile language reads naturally. Shared by the search
 * funnel and the Settings preferred-languages manager so both show the same names.
 */
export function useTmdbLanguages() {
    const tmdb = useTmdb()
    const [languages, setLanguages] = useState<TmdbLanguage[]>([])

    useEffect(() => {
        let cancelled = false
        void tmdb.configuration
            .languages()
            .then((list) => {
                if (cancelled) return
                setLanguages(list.filter((l) => l.iso_639_1 && l.english_name).map((l) => ({ code: l.iso_639_1, label: l.english_name, native: l.name?.trim() || undefined })))
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [tmdb])

    const labelOf = useMemo(() => {
        const m = new Map<string, string>(supportedLocales.map((l) => [l.iso639, l.label]))
        for (const l of languages) if (!m.has(l.code)) m.set(l.code, l.label)
        return (code: string) => m.get(code) ?? code
    }, [languages])

    return { languages, labelOf }
}
