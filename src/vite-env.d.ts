/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_ID?: string;
  readonly VITE_SERVER_URL_US?: string;
  readonly VITE_WEBSOCKET_URL_US?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
