import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { NotificationItem } from "@omss/sdk"
import { useOmss } from "@/hooks/use-omss"

const POLL_MS = 60_000

/**
 * The follow release-notifications feed (gatearr `/notifications`), for the header bell. Polls the
 * unread count + the recent list on an interval and on window focus, toasts (via sonner) when a new
 * unread arrives while the app is open, and exposes mark-read / remove / clear. Gated on `valid`.
 */
export function useNotifications() {
    const { client, valid } = useOmss()
    const [items, setItems] = useState<NotificationItem[]>([])
    const [unread, setUnread] = useState(0)
    const [loading, setLoading] = useState(true)
    const lastUnreadRef = useRef<number | null>(null)

    const refresh = useCallback(async () => {
        if (!valid) {
            setItems([])
            setUnread(0)
            setLoading(false)
            return
        }
        try {
            const [list, count] = await Promise.all([client.getNotifications({ length: 50 }), client.getNotificationCount()])
            const data = list.data?.data ?? []
            const u = count.data?.unread ?? 0
            // Toast only when the unread count RISES after the first load (a genuinely new notification).
            if (lastUnreadRef.current != null && u > lastUnreadRef.current) {
                const latest = data.find((n) => n.readAt == null)
                if (latest) toast(latest.message)
            }
            lastUnreadRef.current = u
            setItems(data)
            setUnread(u)
        } catch {
            /* keep the previous view on a transient failure */
        } finally {
            setLoading(false)
        }
    }, [client, valid])

    useEffect(() => {
        void refresh()
        if (!valid) return
        const id = window.setInterval(() => void refresh(), POLL_MS)
        const onFocus = () => void refresh()
        window.addEventListener("focus", onFocus)
        return () => {
            window.clearInterval(id)
            window.removeEventListener("focus", onFocus)
        }
    }, [refresh, valid])

    const markAllRead = useCallback(async () => {
        try {
            await client.markNotificationsRead()
        } finally {
            const now = Math.floor(Date.now() / 1000)
            setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })))
            setUnread(0)
            lastUnreadRef.current = 0
        }
    }, [client])

    const remove = useCallback(
        async (id: number) => {
            try {
                await client.deleteNotification(id)
            } finally {
                setItems((prev) => prev.filter((n) => n.id !== id))
            }
        },
        [client]
    )

    const clear = useCallback(async () => {
        try {
            await client.clearNotifications()
        } finally {
            setItems([])
            setUnread(0)
            lastUnreadRef.current = 0
        }
    }, [client])

    return { items, unread, loading, refresh, markAllRead, remove, clear }
}
