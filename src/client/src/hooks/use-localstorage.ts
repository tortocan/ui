import { useEffect, useState } from "react"

/** localStorage slot ProfileProvider persists the active profile id under (JSON, may be null). */
const ACTIVE_PROFILE_KEY = "app.activeProfileId"

/** The active profile id as a string slot ("default" before any profile is chosen). */
export function activeProfileSlot(): string {
    if (typeof window === "undefined") return "default"
    try {
        const raw = localStorage.getItem(ACTIVE_PROFILE_KEY)
        const v = raw ? (JSON.parse(raw) as number | null) : null
        return v == null ? "default" : String(v)
    } catch {
        return "default"
    }
}

/** Namespace a base settings key by the active profile, e.g. "app.colorTheme" → "app.colorTheme::p1". */
export function profileScopedKey(baseKey: string): string {
    return `${baseKey}::p${activeProfileSlot()}`
}

/** Read the legacy GLOBAL value for a base key (used to seed a profile's first read). */
export function legacyGlobalValue<T>(baseKey: string, fallback: T): T {
    if (typeof window === "undefined") return fallback
    try {
        const legacy = localStorage.getItem(baseKey)
        return legacy != null ? (JSON.parse(legacy) as T) : fallback
    } catch {
        return fallback
    }
}

/**
 * Like {@link usePersistentState} but the stored key is namespaced per active profile, so Appearance /
 * General / Playback settings are independent per profile. First read for a profile seeds from the
 * legacy GLOBAL key (`baseKey`) when present, so an existing user's current theme/color/toggles carry
 * into their profile instead of resetting. The profile only changes via a full reload (see
 * ProfileProvider), so the computed key is stable for the page's lifetime.
 */
export function useProfileState<T>(baseKey: string, initialValue: T) {
    return usePersistentState<T>(profileScopedKey(baseKey), legacyGlobalValue(baseKey, initialValue))
}

export function usePersistentState<T>(key: string, initialValue: T) {
    const [value, setValue] = useState<T>(() => {
        if (typeof window === "undefined") return initialValue

        try {
            const stored = localStorage.getItem(key)
            return stored ? (JSON.parse(stored) as T) : initialValue
        } catch {
            return initialValue
        }
    })

    useEffect(() => {
        if (typeof window === "undefined") return

        try {
            localStorage.setItem(key, JSON.stringify(value))
        } catch {
            // ignore
        }
    }, [key, value])

    return [value, setValue] as const
}
