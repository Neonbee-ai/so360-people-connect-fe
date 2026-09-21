/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    /** Canonical name set by the production deploy workflow. */
    readonly VITE_SO360_PEOPLE_CONNECT_API: string;
    /** Legacy name; still honoured so either environment spelling works. */
    readonly VITE_SO360_PEOPLE_API: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
