import { Suspense } from "react"
import { Outlet } from "react-router-dom"
import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import StartupOverlay from "@/components/animations/StartupOverlay.tsx"
import { MediaDrawerRoot } from "@/components/media/drawer/MediaDrawerRoot"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer.ts"
import { useProfiles } from "@/app/providers/profile-provider"
import WhoIsWatching from "@/pages/profiles/WhoIsWatching"

const PAGE_FALLBACK = (
    <div className="flex min-h-screen w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
)

export default function AppLayout() {
    const { isVisible } = useMediaDrawer()
    const { status, needsSelection } = useProfiles()

    // Initial-load "Who's watching?" gate: hold the shell until the profile list resolves, then show
    // the picker until one is chosen. An unreachable/stateless backend (status "unavailable") never
    // gates — the app renders normally.
    if (status === "loading") return PAGE_FALLBACK
    if (needsSelection) return <WhoIsWatching />

    return (
        <div className="relative min-h-screen w-full bg-background text-foreground">
            <MediaDrawerRoot />

            <Header />

            <div id="app-root" className={`relative flex min-h-screen flex-col transition-all duration-500 ease-out ${isVisible ? "scale-[0.97] opacity-90" : "opacity-100"}`}>
                {/* background effects */}
                {/* Performance reason: this used to animate-pulse 3 large blurred layers forever on every
                    route, forcing the browser to keep recompositing them while scrolling. They're static now —
                    same look, no continuous main-thread/compositor cost. */}
                <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                    <div className="absolute top-0 left-0 h-full w-full">
                        <div className="absolute -top-48 -left-48 h-[40vw] w-[40vw] rounded-full bg-primary/60 blur-[128px]" />
                        <div className="absolute -top-32 -left-32 h-[30vw] w-[30vw] rounded-full bg-primary/20 blur-[96px]" />
                        <div className="absolute -top-16 -left-16 h-[20vw] w-[20vw] rounded-full bg-primary/10 blur-3xl" />
                    </div>
                </div>

                <main className="relative z-10 mx-auto w-full flex-1 space-y-6">
                    <Suspense fallback={PAGE_FALLBACK}>
                        <Outlet />
                    </Suspense>
                </main>

                <Footer />
            </div>

            <StartupOverlay />
        </div>
    )
}
