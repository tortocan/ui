import { useParams, useSearchParams, useNavigate } from "react-router-dom"
import { MediaWatchProvider } from "./providers/MediaWatchProvider"
import { useMediaWatch } from "./hooks/useMediaWatch"
import { MediaPlayer } from "./MediaPlayer"
import { ErrorState } from "./ErrorState"
import type { MediaType } from "./types/media.types"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { useOmss } from "@/hooks/use-omss.ts"

function MediaWatchPageContent({ type }: { type: MediaType }) {
    const { id } = useParams<{ id: string }>()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const { valid } = useOmss()

    const season = searchParams.get("s") ? parseInt(searchParams.get("s")!) : type === "tv" ? 1 : undefined

    const episode = searchParams.get("e") ? parseInt(searchParams.get("e")!) : type === "tv" ? 1 : undefined

    const media = useMediaWatch(valid ? id! : "", type, valid ? season : undefined, valid ? episode : undefined)

    const { error } = media

    if (!valid) {
        return (
            <div className="relative min-h-screen bg-black text-foreground">
                <div className="flex min-h-screen w-full items-center justify-center gap-4">
                    <div className="space-y-4 text-center">
                        <p>Your OMSS server is unreachable. Please set it up correctly.</p>
                        <Button onClick={() => navigate("/settings?tab=omss")}>Go to Settings</Button>
                    </div>
                </div>

                <div className="absolute top-4 left-4 z-50">
                    <Button variant="ghost" className="border border-border" onClick={() => navigate(-1)}>
                        <ChevronLeft className="h-6 w-6" /> Back
                    </Button>
                </div>
            </div>
        )
    }

    if (error) {
        return <ErrorState error={error} />
    }

    return (
        <div className="relative min-h-screen bg-black text-foreground">
            {/* No back button — swipe down on the player closes it (navigate back), like the trailer modal. */}
            <div className="h-full w-full bg-black">
                <MediaPlayer />
            </div>
        </div>
    )
}

export default function MediaWatchPage({ type }: { type: MediaType }) {
    return (
        <MediaWatchProvider>
            <MediaWatchPageContent type={type} />
        </MediaWatchProvider>
    )
}
