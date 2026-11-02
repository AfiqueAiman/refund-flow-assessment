/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" to serve the API from the in-browser mock (MSW). */
  readonly VITE_ENABLE_MOCKS?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ORDER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
