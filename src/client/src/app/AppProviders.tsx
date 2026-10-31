import { TooltipProvider } from "@/components/ui/tooltip"
import { type ReactNode } from "react"
import { OmssProvider } from "@/app/providers/omss-provider"
import { ProfileProvider } from "@/app/providers/profile-provider"
import { TMDBProvider } from "@/app/providers/tmdb-provider"
import { ThemeProvider } from "@/app/providers/theme-provider"
import { ColorThemeProvider } from "@/app/providers/color-theme-provider"
import { HistoryProvider } from "@/app/providers/history-provider"
import { MediaDrawerProvider } from "@/components/media/drawer/providers/MediaDrawerProvider"
import { profileScopedKey } from "@/hooks/use-localstorage"
import "@/app/i18n/i18n"
import "lenis/dist/lenis.css"
import { BrowserRouter } from "react-router-dom"

type Theme = "dark" | "light" | "system"

export default function AppProviders({ children }: { children: ReactNode }) {
    // Theme is per-profile: scope its storage key to the active profile, and default to the legacy
    // global theme so an existing user keeps their light/dark/system choice on first run.
    const themeKey = profileScopedKey("app-theme")
    const legacyTheme = (typeof window !== "undefined" ? localStorage.getItem("app-theme") : null) as Theme | null

    return (
        <ThemeProvider defaultTheme={legacyTheme ?? "dark"} storageKey={themeKey}>
            <ColorThemeProvider>
                <TooltipProvider delayDuration={150}>
                    <TMDBProvider>
                        <OmssProvider>
                            <ProfileProvider>
                                <HistoryProvider>
                                    <BrowserRouter>
                                        <MediaDrawerProvider>{children}</MediaDrawerProvider>
                                    </BrowserRouter>
                                </HistoryProvider>
                            </ProfileProvider>
                        </OmssProvider>
                    </TMDBProvider>
                </TooltipProvider>
            </ColorThemeProvider>
        </ThemeProvider>
    )
}
