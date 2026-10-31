import { useEffect, useState } from "react"
import { Check, Plus, Star, Trash2 } from "lucide-react"
import { useProfiles } from "@/app/providers/profile-provider"
import { ProfileAvatar } from "@/components/profile/ProfileAvatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Item, ItemContent } from "@/components/ui/item"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { P } from "@/components/ui/typography"
import ConfirmDialog from "@/components/layout/ConfirmDialog"
import { Users } from "lucide-react"

/**
 * The Profile settings tab: view the active profile, rename it + set an avatar (emoji), mark it the
 * default, delete it (refused when it's the last one), switch to another profile, or add a new one.
 * All CRUD hits gatearr's /profiles backend via the ProfileProvider.
 */
export function ProfileSettings() {
    const { status, profiles, activeProfile, selectProfile, createProfile, updateProfile, setDefaultProfile, deleteProfile } = useProfiles()

    const [name, setName] = useState("")
    const [avatar, setAvatar] = useState("")
    const [busy, setBusy] = useState(false)
    const [adding, setAdding] = useState(false)
    const [newName, setNewName] = useState("")

    // Seed the edit fields from the active profile (id in deps: reselect swaps them, though a switch
    // actually reloads the page).
    useEffect(() => {
        setName(activeProfile?.name ?? "")
        setAvatar(activeProfile?.avatar ?? "")
    }, [activeProfile?.id, activeProfile?.name, activeProfile?.avatar])

    if (status === "unavailable" || !activeProfile) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>Who&apos;s watching — manage your profiles.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Empty className="rounded-lg border py-10">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Users className="size-5" />
                            </EmptyMedia>
                            <EmptyTitle>Profiles unavailable</EmptyTitle>
                            <EmptyDescription>Connect an OMSS server (Settings → OMSS) to manage profiles.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </CardContent>
            </Card>
        )
    }

    const dirty = name.trim() !== activeProfile.name || (avatar.trim() || null) !== (activeProfile.avatar ?? null)

    async function save() {
        if (!dirty || !name.trim() || busy) return
        setBusy(true)
        await updateProfile(activeProfile!.id, { name: name.trim(), avatar: avatar.trim() || null })
        setBusy(false)
    }

    async function addProfile() {
        const trimmed = newName.trim()
        if (!trimmed || busy) return
        setBusy(true)
        await createProfile(trimmed)
        setBusy(false)
        setNewName("")
        setAdding(false)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Who&apos;s watching — view and manage your profiles.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
                {/* Active profile editor */}
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <ProfileAvatar profile={{ id: activeProfile.id, name: name || activeProfile.name, avatar }} className="size-20 rounded-2xl text-2xl" />

                    <div className="flex-1 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="profile-name">Name</Label>
                            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Profile name" className="max-w-xs" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="profile-avatar">Avatar</Label>
                            <Input id="profile-avatar" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="An emoji, e.g. 🦊 (optional)" maxLength={4} className="max-w-xs" />
                            <span className="block text-sm text-muted-foreground">Leave blank to use the first letter of the name.</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button onClick={() => void save()} disabled={!dirty || !name.trim() || busy}>
                                Save changes
                            </Button>
                            {activeProfile.isDefault ? (
                                <Badge variant="secondary">
                                    <Star className="mr-1 size-3 fill-current" />
                                    Default
                                </Badge>
                            ) : (
                                <Button variant="outline" onClick={() => void setDefaultProfile(activeProfile.id)} disabled={busy}>
                                    <Star className="size-4" />
                                    Set as default
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* All profiles */}
                <div className="space-y-2">
                    <Label>Your profiles</Label>
                    {profiles.map((p) => (
                        <Item key={p.id} className="flex items-center justify-between border-dashed border-border">
                            <ItemContent>
                                <div className="flex items-center gap-3">
                                    <ProfileAvatar profile={p} className="size-8 rounded-lg text-sm" />
                                    <span className="font-medium">{p.name}</span>
                                    {p.id === activeProfile.id && <Badge>You</Badge>}
                                    {p.isDefault && <Badge variant="secondary">Default</Badge>}
                                </div>
                            </ItemContent>
                            <div className="flex items-center gap-2">
                                {p.id !== activeProfile.id && (
                                    <Button variant="secondary" size="sm" onClick={() => selectProfile(p.id)}>
                                        Switch
                                    </Button>
                                )}
                                <ConfirmDialog
                                    title="Delete profile"
                                    description={`Remove "${p.name}"? This deletes the profile and its watch state. This cannot be undone.`}
                                    onConfirm={() => void deleteProfile(p.id)}
                                    trigger={
                                        <Button variant="destructive" size="sm" disabled={profiles.length <= 1} title={profiles.length <= 1 ? "Can't delete the last profile" : undefined}>
                                            <Trash2 className="size-4" />
                                        </Button>
                                    }
                                />
                            </div>
                        </Item>
                    ))}

                    {/* Add profile */}
                    {adding ? (
                        <div className="flex items-center gap-2">
                            <Input
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") void addProfile()
                                    if (e.key === "Escape") setAdding(false)
                                }}
                                placeholder="New profile name"
                                className="max-w-xs"
                            />
                            <Button size="sm" onClick={() => void addProfile()} disabled={!newName.trim() || busy}>
                                Create
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <Button variant="outline" onClick={() => setAdding(true)}>
                            <Plus className="size-4" />
                            Add profile
                        </Button>
                    )}
                </div>

                <P className="text-sm text-muted-foreground">
                    <Check className="mr-1 inline size-3 text-primary" />
                    Appearance, General and Playback settings are saved per profile. Switching profiles reloads the app.
                </P>
            </CardContent>
        </Card>
    )
}
