import { Loader2, FileVideo } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TranscodingNoticeProps {
    title?: string
    container?: string
    onBack: () => void
}

/**
 * Shown instead of the player when the source container isn't browser-playable (e.g. MKV). gatearr has
 * already queued it for transcode on source build, and the bell will notify when the playable version
 * is ready — so this just explains the wait rather than letting the `<video>` fail silently.
 */
export function TranscodingNotice({ title, container, onBack }: TranscodingNoticeProps) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-5 bg-background px-6 text-center">
            <div className="relative">
                <FileVideo className="size-14 text-white/40" />
                <Loader2 className="absolute -right-2 -bottom-2 size-6 animate-spin text-primary" />
            </div>
            <div className="max-w-md space-y-2">
                <h2 className="text-xl font-semibold text-white">Preparing this title…</h2>
                <p className="text-sm text-white/60">
                    {title ? <span className="font-medium text-white/80">{title}</span> : "This title"} is in a format your browser can't play
                    {container ? ` (${container.toUpperCase()})` : ""}. We've queued it for transcoding — you'll get a notification when it's ready to watch.
                </p>
            </div>
            <Button variant="outline" onClick={onBack} className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                Go back
            </Button>
        </div>
    )
}
