import { useEffect, useState, useMemo } from "react"
import DOMPurify from "dompurify"
import { parseVTT } from "./utils/subtitle"
import { useAppSettings, type SubtitleFontSize } from "@/hooks/use-appsettings.ts"

interface CustomSubtitlesProps {
    url: string
    currentTime: number
}

// Responsive font sizes (scale with the viewport, clamped) per preset.
const FONT_SIZE: Record<SubtitleFontSize, string> = {
    sm: "clamp(0.9rem, 2.2vw, 1.25rem)",
    md: "clamp(1.05rem, 2.8vw, 1.6rem)",
    lg: "clamp(1.25rem, 3.4vw, 2rem)",
    xl: "clamp(1.5rem, 4.2vw, 2.6rem)",
}

export function CustomSubtitles({ url, currentTime }: CustomSubtitlesProps) {
    const { subtitleFontSize, subtitleColor, subtitleBackground, subtitlePosition } = useAppSettings()
    const [cues, setCues] = useState<{ start: number; end: number; text: string }[]>([])

    useEffect(() => {
        if (!url) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCues([])
            return
        }

        fetch(url)
            .then((res) => res.text())
            .then((text) => {
                const parsed = parseVTT(text)
                setCues(parsed)
            })
            .catch((err) => {
                console.error("Failed to load subtitles:", err)
                setCues([])
            })
    }, [url])

    const activeCue = useMemo(() => {
        return cues.find((cue) => currentTime >= cue.start && currentTime <= cue.end)
    }, [cues, currentTime])

    if (!activeCue) return null

    const safeHtml = DOMPurify.sanitize(activeCue.text, {
        ALLOWED_TAGS: ["b", "i", "u", "c", "font", "ruby", "rt", "v", "lang"],
        ALLOWED_ATTR: ["style"],
    })

    const bgColor = subtitleBackground === "none" ? "transparent" : subtitleBackground === "solid" ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.35)"

    return (
        <div className="pointer-events-none absolute right-0 left-0 flex justify-center px-4" style={{ bottom: `${subtitlePosition}%` }}>
            <div
                className="max-w-[90%] rounded px-3 py-1 text-center font-medium whitespace-pre-wrap"
                style={{
                    fontSize: FONT_SIZE[subtitleFontSize],
                    color: subtitleColor,
                    backgroundColor: bgColor,
                    backdropFilter: subtitleBackground === "subtle" ? "blur(2px)" : undefined,
                    // Outline so text stays readable even with a transparent background.
                    textShadow: "0 1px 2px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.95)",
                }}
                dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
        </div>
    )
}
