import { useEffect, useState } from "react"
import { useOmss } from "@/hooks/use-omss"

export type OmssLibrary = {
    movies: number[]
    tv: number[]
}

/**
 * The set of TMDB ids the OMSS server actually has, read from its home/discovery document
 * (`GET /v1` → `media`). The @omss/sdk HealthResponse type doesn't declare `media`, but OMSS
 * backends (e.g. gatearr) return it, so we read it off the raw object. Movies is a flat id list;
 * tv is a list of `{ id, seasons }` objects — we take the series ids. Empty when the server is
 * unreachable or exposes no media.
 */
export function useOmssLibrary(enabled: boolean) {
    const { client, valid } = useOmss()
    const [library, setLibrary] = useState<OmssLibrary>({ movies: [], tv: [] })
    const [loading, setLoading] = useState(enabled)

    useEffect(() => {
        if (!enabled || !valid) {
            setLoading(false)
            return
        }
        let cancelled = false
        setLoading(true)

        void (async () => {
            try {
                const result = await client.getHealthStatus()
                const media = (result.data as unknown as { media?: { movies?: unknown; tv?: unknown } } | null)?.media
                const movies = Array.isArray(media?.movies)
                    ? (media!.movies as unknown[]).filter((x): x is number => typeof x === "number")
                    : []
                const tv = Array.isArray(media?.tv)
                    ? (media!.tv as unknown[])
                          .map((t) => (t as { id?: unknown })?.id)
                          .filter((x): x is number => typeof x === "number")
                    : []
                if (!cancelled) setLibrary({ movies, tv })
            } catch {
                if (!cancelled) setLibrary({ movies: [], tv: [] })
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [client, valid, enabled])

    return { library, loading }
}
