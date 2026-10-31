import { cn } from "@/lib/utils"
import type { Profile } from "@/app/providers/profile-provider"

// Deterministic accent per profile so each reads as a distinct tile (Netflix-style).
const COLORS = ["bg-red-500", "bg-rose-500", "bg-violet-500", "bg-blue-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500"]

/** A circular profile avatar: the profile's emoji/short avatar token if it has one, else its initial. */
export function ProfileAvatar({ profile, className }: { profile: Pick<Profile, "id" | "name" | "avatar">; className?: string }) {
    const token = (profile.avatar ?? "").trim()
    // A short non-alphanumeric token (an emoji) renders as-is; anything else falls back to the initial.
    const isEmoji = token.length > 0 && token.length <= 4 && !/^[A-Za-z0-9]+$/.test(token)
    const color = COLORS[Math.abs(profile.id) % COLORS.length]
    return (
        <span className={cn("inline-flex items-center justify-center rounded-xl font-semibold text-white select-none", color, className ?? "size-10 text-base")}>
            {isEmoji ? token : (profile.name.trim()[0] ?? "?").toUpperCase()}
        </span>
    )
}
