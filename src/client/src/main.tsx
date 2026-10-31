import { createRoot } from "react-dom/client"
import "@/index.css"
import App from "@/app/App"
import AppProviders from "@/app/AppProviders"
import { AppSettingsProvider } from "@/app/providers/settings-provider.tsx"
import { installTmdbProxy } from "@/lib/tmdb-proxy"

// Route TMDB API calls through gatearr's caching proxy (must run before any TMDB client is built).
installTmdbProxy()

createRoot(document.getElementById("root")!).render(
    <AppSettingsProvider>
        <AppProviders>
            <App />
        </AppProviders>
    </AppSettingsProvider>
)
