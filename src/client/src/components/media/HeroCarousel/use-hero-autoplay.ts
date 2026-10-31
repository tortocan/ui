import { useCallback, useEffect, useRef } from "react"
import type { CarouselApi } from "@/components/ui/carousel"

const AUTOPLAY_DELAY = 6500

type Params = {
    heroApi?: CarouselApi
    enabled: boolean
    slideCount: number
    onSelect: (index: number) => void
}

export function useHeroAutoplay({ heroApi, enabled, slideCount, onSelect }: Params) {
    const autoplayRef = useRef<number | null>(null)
    // While the pointer is over the hero (viewing/swiping), autoplay is paused so it doesn't advance
    // the slide underneath the user. A ref (not state) so it's readable inside the timer/select handler
    // without re-running effects or re-binding listeners.
    const hoveredRef = useRef(false)

    const clearTimer = useCallback(() => {
        if (autoplayRef.current) {
            window.clearTimeout(autoplayRef.current)
            autoplayRef.current = null
        }
    }, [])

    const restartAutoplay = useCallback(() => {
        if (!heroApi || !enabled) return

        clearTimer()

        // Don't schedule the next advance while the user is hovering/interacting with the hero.
        if (hoveredRef.current) return

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

        // Pause on hover, resume on leave. pointerenter/leave don't fire on touch, so autoplay keeps
        // running on mobile (where there's no hover to signal "in scope") — the intended feel.
        const node = typeof heroApi.rootNode === "function" ? heroApi.rootNode() : null
        const onEnter = () => {
            hoveredRef.current = true
            clearTimer()
        }
        const onLeave = () => {
            hoveredRef.current = false
            restartAutoplay()
        }
        node?.addEventListener("pointerenter", onEnter)
        node?.addEventListener("pointerleave", onLeave)

        return () => {
            heroApi.off("select", handleSelect)
            heroApi.off("reInit", handleSelect)
            node?.removeEventListener("pointerenter", onEnter)
            node?.removeEventListener("pointerleave", onLeave)
            clearTimer()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [heroApi, slideCount, restartAutoplay, clearTimer])

    // cleanup on unmount
    useEffect(() => {
        return () => {
            if (autoplayRef.current) {
                window.clearTimeout(autoplayRef.current)
            }
        }
    }, [])
}
