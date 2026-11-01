import { LucideBell, LucideCheckCheck } from "lucide-react"
import type { NotificationItem } from "@omss/sdk"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useOmss } from "@/hooks/use-omss"
import { useNotifications } from "@/hooks/use-notifications"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer"

const iconButtonClass = "text-white/70 hover:bg-white/10 hover:text-white"

/** Relative "x ago" from a unix-seconds timestamp, coarse buckets. */
function ago(unixSeconds: number): string {
    const s = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds)
    if (s < 60) return "just now"
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

/**
 * Header bell for the follow release-notifications feed (gatearr `/notifications`). Shows an unread
 * badge, lists recent notifications in a popover, opens the related title's drawer on click (marking it
 * read), and offers mark-all-read. Hidden entirely when the OMSS backend is unreachable.
 */
export function NotificationsBell() {
    const { valid } = useOmss()
    const { items, unread, markAllRead, remove } = useNotifications()
    const { open } = useMediaDrawer()

    if (!valid) return null

    const openItem = (n: NotificationItem) => {
        open({ type: n.mediaType === "show" ? "tv" : "movie", id: n.tmdbId })
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className={`relative ${iconButtonClass}`} aria-label="Notifications">
                    <LucideBell className="size-5" />
                    {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                            {unread > 9 ? "9+" : unread}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <span className="text-sm font-semibold">Notifications</span>
                    {unread > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => void markAllRead()}>
                            <LucideCheckCheck className="size-3.5" />
                            Mark all read
                        </Button>
                    )}
                </div>

                {items.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet. Follow a title to get notified of new releases.</div>
                ) : (
                    <ScrollArea className="max-h-96">
                        <ul className="divide-y">
                            {items.map((n) => (
                                <li key={n.id} className="flex items-stretch transition-colors hover:bg-accent">
                                    <button
                                        type="button"
                                        onClick={() => openItem(n)}
                                        className="flex min-w-0 flex-1 items-start gap-2 px-4 py-3 text-left"
                                    >
                                        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt == null ? "bg-primary" : "bg-transparent"}`} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm leading-snug">{n.message}</span>
                                            <span className="mt-0.5 block text-xs text-muted-foreground">
                                                {n.kind === "upcoming" ? "Upcoming" : "Available"} · {ago(n.createdAt)}
                                            </span>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Dismiss notification"
                                        onClick={() => void remove(n.id)}
                                        className="shrink-0 px-3 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        ✕
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                )}
            </PopoverContent>
        </Popover>
    )
}
