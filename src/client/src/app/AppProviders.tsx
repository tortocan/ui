import { TooltipProvider } from "@/components/ui/tooltip"
import { type ReactNode } from "react"
import { OmssProvider } from "@/app/providers/omss-provider"
import { ProfileProvider } from "@/app/providers/profile-provider"
import { TMDBProvider } from "@/app/providers/tmdb-provider"
import { ThemeProvider } from "@/app/providers/theme-provider"
import { ColorThemeProvider } from "@/app/providers/color-theme-provider"
import { HistoryProvider } from "@/app/providers/history-provider"
import { MediaDrawerProvider } from "@/components/media/drawer/providers/MediaDrawerProvider"
import "@/app/i18n/i18n"
import "lenis/dist/lenis.css"
import { BrowserRouter } from "react-router-dom"

export default function AppProviders({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="app-theme">
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
