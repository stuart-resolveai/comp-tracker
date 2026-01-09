/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SALESFORCE_CLIENT_ID: string;
  readonly VITE_SALESFORCE_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
