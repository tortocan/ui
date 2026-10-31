import { Check, Plus, Users } from "lucide-react"
import { useProfiles } from "@/app/providers/profile-provider"
import { ProfileAvatar } from "@/components/profile/ProfileAvatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

/**
 * The active-profile avatar in the header's top-right (Overseerr-style). Clicking it opens a switcher:
 * pick another profile, or "Switch profile" to return to the Who's-watching gate. Renders nothing until
 * profiles are loaded and one is active, so a stateless/offline setup shows no avatar.
 */
export function ProfileMenu() {
    const { status, profiles, activeProfile, selectProfile, clearSelection } = useProfiles()

    if (status !== "ready" || !activeProfile) return null

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="ml-1 rounded-full outline-none ring-offset-2 ring-offset-black/20 focus-visible:ring-2 focus-visible:ring-white/60" aria-label={`Profile: ${activeProfile.name}`}>
                <ProfileAvatar profile={activeProfile} className="size-9 rounded-full text-sm" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Profiles</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profiles.map((p) => (
                    <DropdownMenuItem key={p.id} onClick={() => selectProfile(p.id)} className="gap-2">
                        <ProfileAvatar profile={p} className="size-6 rounded-md text-xs" />
                        <span className="flex-1 truncate">{p.name}</span>
                        {p.id === activeProfile.id && <Check className="size-4 text-primary" />}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearSelection} className="gap-2">
                    <Users className="size-4" />
                    Switch profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={clearSelection} className="gap-2">
                    <Plus className="size-4" />
                    Add profile
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
