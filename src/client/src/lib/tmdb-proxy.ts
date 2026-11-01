// Route TMDB API calls through gatearr's caching proxy to cut calls to api.themoviedb.org.
//
// The @lorenzopant/tmdb SDK HARDCODES `https://api.themoviedb.org/${version}` as its base — it exposes
// no baseUrl/fetch option, its RequestInterceptor can only rewrite the endpoint/params (not the host),
// and `ApiClient` isn't exported — so there's no supported way to repoint it via config. Instead we
// rewrite at the fetch layer: any request to `https://api.themoviedb.org/*` is sent to
// `{gatearr}/tmdb/*` (gatearr proxies + caches it in Postgres, hitting TMDB only on a miss). Everything
// else — crucially `image.tmdb.org` posters, the OMSS `/v1` calls, and the scrobble/follow calls — is
// left completely untouched. Install ONCE at client bootstrap, before any TMDB client is built.

const TMDB_API = "https://api.themoviedb.org"

let installed = false

/** Resolve the gatearr base the OMSS client uses: the persisted override (app.omssUrl), else the baked default. */
function resolveGatearrBase(): string {
    let base = ""
    try {
        const raw = localStorage.getItem("app.omssUrl")
        if (raw) base = raw.startsWith('"') ? (JSON.parse(raw) as string) : raw
    } catch {
        /* not JSON / no storage — fall through to the env default */
    }
    if (!base) base = import.meta.env.VITE_OMSS_API_URL ?? ""
    return base.replace(/\/+$/, "")
}

/**
 * Monkeypatch window.fetch (idempotent, client-only) to send TMDB API requests through the gatearr
 * proxy. No-op when there's no window, no fetch, or no configured gatearr base (then TMDB calls go
 * direct, exactly as before).
 */
export function installTmdbProxy(): void {
    if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return
    installed = true

    // Resolve the gatearr base PER REQUEST, not once at bootstrap: the backend URL is user-mutable at
    // runtime (the Settings input, ?omssurl=) with no page reload, so a base captured here would keep
    // routing TMDB to a stale target — or, if empty at boot, bypass the proxy forever. A TMDB call falls
    // back to going direct whenever no backend is configured at request time.
    const rewrite = (url: string): string => {
        if (!url.startsWith(TMDB_API)) return url
        const base = resolveGatearrBase()
        return base ? `${base}/tmdb` + url.slice(TMDB_API.length) : url
    }

    const original = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        try {
            if (typeof input === "string") return original(rewrite(input), init)
            if (input instanceof URL) return original(rewrite(input.toString()), init)
            // Request object — rebuild with the rewritten URL only when it actually changes, preserving
            // method/headers/body/credentials/etc. via the Request copy constructor.
            const req = input as Request
            const rewritten = rewrite(req.url)
            return rewritten === req.url ? original(input, init) : original(new Request(rewritten, req), init)
        } catch {
            return original(input as RequestInfo, init)
        }
    }
}
