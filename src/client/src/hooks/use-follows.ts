import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { followMediaKey, type FollowState } from "@omss/sdk"
import { useOmss } from "@/hooks/use-omss"

/**
 * The titles followed on gatearr (the OMSS `/follow` extension). Mirrors use-scrobble-history: lists the
 * follows, exposes follow/unfollow, and an `isFollowed` check against the loaded set. Gated on a
 * reachable OMSS backend (`valid`).
 */
export function useFollows() {
    const { client, valid } = useOmss()
    const [follows, setFollows] = useState<FollowState[]>([])
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async () => {
        if (!valid) {
            setFollows([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const { data } = await client.getFollows()
            setFollows(data?.data ?? [])
        } catch {
            setFollows([])
        } finally {
            setLoading(false)
        }
    }, [client, valid])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const follow = useCallback(
        async (mediaType: "movie" | "tv", tmdbId: number, title?: string) => {
            const { data } = await client.follow({ mediaType, tmdbId, title })
            await refresh()
            return data
        },
        [client, refresh]
    )

    // The OMSS SDK reports failures via { error }, not by throwing — only drop the row on success, else
    // the UI would show an unfollow/clear that never reached the backend (these hooks don't poll).
    const unfollow = useCallback(
        async (mediaKey: string) => {
            const { error } = await client.unfollow(mediaKey)
            if (error) {
                toast.error("Couldn't unfollow")
                return
            }
            setFollows((prev) => prev.filter((f) => f.mediaKey !== mediaKey))
        },
        [client]
    )

    const clear = useCallback(async () => {
        const { error } = await client.clearFollows()
        if (error) {
            toast.error("Couldn't clear follows")
            return
        }
        setFollows([])
    }, [client])

    const isFollowed = useCallback(
        (mediaType: "movie" | "tv" | "show", tmdbId: number) => follows.some((f) => f.mediaKey === followMediaKey({ mediaType, tmdbId })),
        [follows]
    )

    return { follows, loading, follow, unfollow, clear, isFollowed, refresh }
}
