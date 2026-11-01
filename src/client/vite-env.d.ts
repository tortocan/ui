/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_TMDB_API_KEY: string
    readonly VITE_OMSS_API_URL?: string
    readonly VITE_STANDALONE: boolean
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
