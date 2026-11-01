import { useEffect, useState } from "react"
import type { OmssClient } from "@omss/sdk"
import { useOmss } from "@/hooks/use-omss"

export type OmssHomeData = {
    /** TMDB ids gatearr has locally (served by Radarr). */
    movies: Set<number>
    /** TMDB ids gatearr has locally (served by Sonarr). */
    tv: Set<number>
    /** provider id → logo URL (e.g. radarr/sonarr), from the home `providers` list. */
    providerLogos: Record<string, string>
}

const EMPTY: OmssHomeData = { movies: new Set(), tv: new Set(), providerLogos: {} }

// ONE module cache (keyed by baseUrl) so the home/discovery doc is fetched once and shared by every
// card badge + the detail provider row — not re-fetched per component. The @omss/sdk HealthResponse
// type declares neither `media` nor `providers`, but gatearr returns both, so we read them off the raw
// object (same approach as useOmssLibrary).
const cache = new Map<string, Promise<OmssHomeData>>()

function fetchOmssHome(client: OmssClient, baseUrl: string): Promise<OmssHomeData> {
    const hit = cache.get(baseUrl)
    if (hit) return hit
    const p = (async () => {
        try {
            const { data } = await client.getHealthStatus()
            // The SDK returns {data:null} on any failure (network/5xx) — do NOT cache that, or a blip
            // during a gatearr pod restart would permanently disable local priority for the session.
            if (data == null) {
                cache.delete(baseUrl)
                return EMPTY
            }
            const raw = data as unknown as { media?: { movies?: unknown; tv?: unknown }; providers?: { id?: unknown; logo?: unknown }[] }
            const movies = new Set<number>(Array.isArray(raw.media?.movies) ? (raw.media!.movies as unknown[]).filter((x): x is number => typeof x === "number") : [])
            const tv = new Set<number>(
                Array.isArray(raw.media?.tv) ? (raw.media!.tv as unknown[]).map((t) => (t as { id?: unknown })?.id).filter((x): x is number => typeof x === "number") : []
            )
            const providerLogos: Record<string, string> = {}
            for (const prov of raw.providers ?? []) {
                if (typeof prov?.id === "string" && typeof prov?.logo === "string") providerLogos[prov.id] = prov.logo
            }
            return { movies, tv, providerLogos }
        } catch {
            cache.delete(baseUrl)
            return EMPTY
        }
    })()
    cache.set(baseUrl, p)
    return p
}

/**
 * The gatearr home/discovery doc (owned-title id sets + provider logo URLs), module-cached and shared.
 * Powers "local stream providers win": a title gatearr has on disk shows its Radarr/Sonarr logo ahead
 * of (or instead of) the TMDB streaming provider. Returns empties until loaded / when OMSS is down.
 */
export function useOmssHome(): OmssHomeData & { ready: boolean } {
    const { client, valid, baseUrl } = useOmss()
    const [data, setData] = useState<OmssHomeData>(EMPTY)
    // `ready` = ownership is known (home loaded, or OMSS is down). Consumers that fall back to TMDB wait
    // for it so they don't fire a TMDB lookup — or flash a TMDB logo — before learning the title is local.
    const [ready, setReady] = useState(false)

    useEffect(() => {
        if (!valid) {
            setData(EMPTY)
            setReady(true) // OMSS down → nothing local; let the TMDB fallback proceed immediately
            return
        }
        let cancelled = false
        setReady(false)
        void fetchOmssHome(client, baseUrl).then((d) => {
            if (!cancelled) {
                setData(d)
                setReady(true)
            }
        })
        return () => {
            cancelled = true
        }
    }, [client, valid, baseUrl])

    return { ...data, ready }
}

/** The local gatearr provider id for a media type (movie → Radarr, tv → Sonarr). */
export function localProviderId(type: "movie" | "tv"): "radarr" | "sonarr" {
    return type === "movie" ? "radarr" : "sonarr"
}

/** The local provider's logo URL if gatearr owns this title, else null. */
export function localProviderLogo(home: OmssHomeData, type: "movie" | "tv", id: number): string | null {
    const owned = type === "movie" ? home.movies.has(id) : home.tv.has(id)
    return owned ? (home.providerLogos[localProviderId(type)] ?? null) : null
}
