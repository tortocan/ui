import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useOmss } from "@/hooks/use-omss"
import { usePersistentState } from "@/hooks/use-localstorage.ts"

export type Profile = {
    id: number
    name: string
    avatar?: string | null
    isDefault: boolean
    sortOrder: number
}

/** loading = first fetch in flight; ready = profiles loaded; unavailable = no OMSS backend / fetch failed. */
type ProfileStatus = "loading" | "ready" | "unavailable"

type ProfileContextType = {
    status: ProfileStatus
    profiles: Profile[]
    activeProfile: Profile | null
    /** True once profiles are loaded but none is chosen — the "Who's watching?" gate. */
    needsSelection: boolean
    selectProfile: (id: number) => void
    clearSelection: () => void
    createProfile: (name: string, avatar?: string) => Promise<Profile | null>
    updateProfile: (id: number, patch: { name?: string; avatar?: string | null }) => Promise<Profile | null>
    setDefaultProfile: (id: number) => Promise<void>
    deleteProfile: (id: number) => Promise<void>
    refresh: () => void
}

const ProfileContext = createContext<ProfileContextType | null>(null)

function profilesUrl(base: string) {
    return `${base.replace(/\/+$/, "")}/profiles`
}

/**
 * Profiles are gatearr's "who's watching" accounts (the OMSS `/profiles` extension). This provider
 * fetches the list from the OMSS backend, tracks the active profile in localStorage, and drives both
 * the initial "Who's watching?" gate and the header switcher. When no OMSS backend is reachable it goes
 * `unavailable` and the app runs ungated — a stateless setup never sees a profile wall.
 *
 * NOTE: the active profile is NOT yet attached to scrobble calls (X-Profile-Id). Wiring per-profile
 * watch state end-to-end also needs the leave-time sendBeacon (which can't set headers) to carry the id
 * via a query param plus a matching gatearr fallback — deliberately left for a follow-up so switching
 * can't split a title's state across profiles in the meantime.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
    const { baseUrl } = useOmss()
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [status, setStatus] = useState<ProfileStatus>("loading")
    // Read-only here: switching is a synchronous write + reload (see persistActive), so we never use the
    // setter — reading the persisted value is enough to resolve the active profile on boot.
    const [activeProfileId] = usePersistentState<number | null>("app.activeProfileId", null)
    const [refreshKey, setRefreshKey] = useState(0)

    useEffect(() => {
        if (!baseUrl) {
            setStatus("unavailable")
            return
        }
        let cancelled = false
        setStatus("loading")
        fetch(profilesUrl(baseUrl), { headers: { Accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((body) => {
                if (cancelled) return
                setProfiles(Array.isArray(body?.data) ? (body.data as Profile[]) : [])
                setStatus("ready")
            })
            .catch(() => {
                if (cancelled) return
                setProfiles([])
                setStatus("unavailable")
            })
        return () => {
            cancelled = true
        }
    }, [baseUrl, refreshKey])

    const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
    const activeProfile = useMemo(() => profiles.find((p) => p.id === activeProfileId) ?? null, [profiles, activeProfileId])
    const needsSelection = status === "ready" && profiles.length > 0 && activeProfile == null

    // Switching the active profile reloads the app: profile-scoped settings (Appearance / General /
    // Playback, via useProfileState) re-initialise from the new profile's localStorage namespace on a
    // fresh boot. The id is written SYNCHRONOUSLY before reload so it can't lose the usePersistentState
    // effect race. (A full reload is how Netflix/SkyShowtime switch profiles too.)
    const persistActive = (id: number | null) => {
        try {
            localStorage.setItem("app.activeProfileId", JSON.stringify(id))
        } catch {
            // ignore
        }
    }
    const selectProfile = useCallback((id: number) => {
        persistActive(id)
        window.location.reload()
    }, [])
    const clearSelection = useCallback(() => {
        persistActive(null)
        window.location.reload()
    }, [])

    const createProfile = useCallback(
        async (name: string, avatar?: string) => {
            if (!baseUrl) return null
            try {
                const r = await fetch(profilesUrl(baseUrl), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, avatar }),
                })
                if (!r.ok) return null
                const created = (await r.json()) as Profile
                setProfiles((prev) => [...prev, created])
                return created
            } catch {
                return null
            }
        },
        [baseUrl]
    )

    const updateProfile = useCallback(
        async (id: number, patch: { name?: string; avatar?: string | null }) => {
            if (!baseUrl) return null
            try {
                const r = await fetch(`${profilesUrl(baseUrl)}/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(patch),
                })
                if (!r.ok) return null
                const updated = (await r.json()) as Profile
                setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)))
                return updated
            } catch {
                return null
            }
        },
        [baseUrl]
    )

    const setDefaultProfile = useCallback(
        async (id: number) => {
            if (!baseUrl) return
            try {
                const r = await fetch(`${profilesUrl(baseUrl)}/${id}/default`, { method: "POST" })
                if (!r.ok) return
                setProfiles((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })))
            } catch {
                // best-effort
            }
        },
        [baseUrl]
    )

    const deleteProfile = useCallback(
        async (id: number) => {
            if (!baseUrl) return
            try {
                const r = await fetch(`${profilesUrl(baseUrl)}/${id}`, { method: "DELETE" })
                // 409 = refused (last profile); leave the list intact.
                if (!r.ok) return
                setProfiles((prev) => prev.filter((p) => p.id !== id))
                // Deleting the active profile drops us back to the "Who's watching?" gate (reload).
                if (activeProfileId === id) clearSelection()
            } catch {
                // best-effort
            }
        },
        [baseUrl, activeProfileId, clearSelection]
    )

    const value = useMemo<ProfileContextType>(
        () => ({ status, profiles, activeProfile, needsSelection, selectProfile, clearSelection, createProfile, updateProfile, setDefaultProfile, deleteProfile, refresh }),
        [status, profiles, activeProfile, needsSelection, selectProfile, clearSelection, createProfile, updateProfile, setDefaultProfile, deleteProfile, refresh]
    )

    return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfiles() {
    const ctx = useContext(ProfileContext)
    if (!ctx) throw new Error("ProfileProvider missing")
    return ctx
}
