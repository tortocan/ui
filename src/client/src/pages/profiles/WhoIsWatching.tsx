import { useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { useProfiles } from "@/app/providers/profile-provider"
import { ProfileAvatar } from "@/components/profile/ProfileAvatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/**
 * The Netflix / SkyShowtime style "Who's watching?" gate shown on initial load until a profile is
 * chosen. Picking a tile sets the active profile and unblocks the app; "Add profile" creates one and
 * selects it immediately.
 */
export default function WhoIsWatching() {
    const { profiles, selectProfile, createProfile } = useProfiles()
    const [adding, setAdding] = useState(false)
    const [name, setName] = useState("")
    const [busy, setBusy] = useState(false)

    async function submitNew() {
        const trimmed = name.trim()
        if (!trimmed || busy) return
        setBusy(true)
        const created = await createProfile(trimmed)
        setBusy(false)
        if (created) {
            selectProfile(created.id)
        } else {
            // Keep the form open with the typed name so the input isn't silently discarded on failure.
            toast.error("Couldn't create profile. Please try again.")
        }
    }

    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-10 bg-background px-6 text-foreground">
            <h1 className="text-3xl font-semibold md:text-5xl">Who&apos;s watching?</h1>

            <div className="flex flex-wrap items-start justify-center gap-6 md:gap-8">
                {profiles.map((p) => (
                    <button key={p.id} type="button" onClick={() => selectProfile(p.id)} className="group flex flex-col items-center gap-3" title={p.name}>
                        <ProfileAvatar profile={p} className="size-24 rounded-2xl text-3xl ring-offset-4 ring-offset-background transition-all group-hover:scale-105 group-hover:ring-2 group-hover:ring-foreground md:size-28" />
                        <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">{p.name}</span>
                    </button>
                ))}

                {/* Add profile */}
                {adding ? (
                    <div className="flex w-28 flex-col items-center gap-3 md:w-32">
                        <div className="flex size-24 items-center justify-center rounded-2xl border-2 border-dashed border-border md:size-28">
                            <Plus className="size-8 text-muted-foreground" />
                        </div>
                        <Input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void submitNew()
                                if (e.key === "Escape") setAdding(false)
                            }}
                            placeholder="Name"
                            aria-label="Profile name"
                            className="h-8 text-center"
                        />
                        <Button size="sm" onClick={() => void submitNew()} disabled={!name.trim() || busy}>
                            Create
                        </Button>
                    </div>
                ) : (
                    <button type="button" onClick={() => setAdding(true)} className="group flex flex-col items-center gap-3">
                        <span className="flex size-24 items-center justify-center rounded-2xl border-2 border-dashed border-border transition-all group-hover:scale-105 group-hover:border-foreground md:size-28">
                            <Plus className="size-8 text-muted-foreground transition-colors group-hover:text-foreground" />
                        </span>
                        <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">Add profile</span>
                    </button>
                )}
            </div>
        </div>
    )
}
