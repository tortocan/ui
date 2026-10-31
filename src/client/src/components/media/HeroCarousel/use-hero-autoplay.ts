import { useCallback, useEffect, useRef } from "react"
import type { CarouselApi } from "@/components/ui/carousel"

const AUTOPLAY_DELAY = 6500

type Params = {
    heroApi?: CarouselApi
    enabled: boolean
    slideCount: number
    // When true (pointer over the hero), autoplay is paused so it doesn't advance under the user.
    paused: boolean
    onSelect: (index: number) => void
}

export function useHeroAutoplay({ heroApi, enabled, slideCount, paused, onSelect }: Params) {
    const autoplayRef = useRef<number | null>(null)
    // Read inside the timer/select handler without re-running the binding effect on every toggle.
    const pausedRef = useRef(paused)
    pausedRef.current = paused

    const clearTimer = useCallback(() => {
        if (autoplayRef.current) {
            window.clearTimeout(autoplayRef.current)
            autoplayRef.current = null
        }
    }, [])

    const restartAutoplay = useCallback(() => {
        if (!heroApi || !enabled) return

        clearTimer()

        // Don't schedule the next advance while paused (hovering/interacting).
        if (pausedRef.current) return

        autoplayRef.current = window.setTimeout(() => {
            if (!heroApi) return

            if (heroApi.canScrollNext()) {
                heroApi.scrollNext()
            } else {
                heroApi.scrollTo(0)
            }
        }, AUTOPLAY_DELAY)
    }, [heroApi, enabled, clearTimer])

    // carousel binding
    useEffect(() => {
        if (!heroApi || slideCount === 0) return

        const handleSelect = () => {
            const index = heroApi.selectedScrollSnap()

            onSelect(index)
            restartAutoplay()
        }

        handleSelect()

        heroApi.on("select", handleSelect)
        heroApi.on("reInit", handleSelect)

        restartAutoplay()

        return () => {
            heroApi.off("select", handleSelect)
            heroApi.off("reInit", handleSelect)
            clearTimer()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [heroApi, slideCount, restartAutoplay, clearTimer])

    // React to the pause toggle: clear the timer when paused, re-arm a fresh delay when resumed.
    useEffect(() => {
        if (paused) clearTimer()
        else restartAutoplay()
    }, [paused, clearTimer, restartAutoplay])

    // cleanup on unmount
    useEffect(() => {
        return () => {
            if (autoplayRef.current) {
                window.clearTimeout(autoplayRef.current)
            }
        }
    }, [])
}
