import { computed, ReadonlySignal } from "@preact/signals";
import { ComponentChildren } from "preact";
import { createContext, useMemo } from "preact/compat";
import { useAttribute } from "./attributes";

import { useContextSafely } from "../utils/useContextSafely";
import { Location, parseLocation } from "../types/config";

const ServerLocationContext = createContext<{
  location: ReadonlySignal<Location>;
  serverUrl: ReadonlySignal<string>;
  webSocketUrl: ReadonlySignal<string>;
} | null>(null);

interface ServerLocationProviderProps {
  children: ComponentChildren;
}

export function ServerLocationProvider({ children }: ServerLocationProviderProps) {
  const serverLocation = useAttribute("server-location");
  const value = useMemo(() => {
    const location = computed(() => parseLocation(serverLocation.value));

    // Check if environment variables are missing (development only)
    if (import.meta.env.DEV) {
      const missingVars = [];
      if (!import.meta.env.VITE_SERVER_URL) missingVars.push("VITE_SERVER_URL");
      if (!import.meta.env.VITE_WEBSOCKET_URL) missingVars.push("VITE_WEBSOCKET_URL");

      if (missingVars.length > 0) {
        // Use globalThis to avoid linter warnings while still providing helpful debug info
        (globalThis as { __CONVAI_MISSING_ENV__?: string[] }).__CONVAI_MISSING_ENV__ = missingVars;
      }
    }

    const serverUrlMap: Record<Location, string> = {
      us: import.meta.env.VITE_SERVER_URL_US || "https://api.elevenlabs.io",
      "eu-residency":
        import.meta.env.VITE_SERVER_URL_EU_RESIDENCY || "https://api-eu.elevenlabs.io",
      "in-residency":
        import.meta.env.VITE_SERVER_URL_IN_RESIDENCY || "https://api-in.elevenlabs.io",
      global: import.meta.env.VITE_SERVER_URL || "https://api.elevenlabs.io",
    };

    const websocketUrlMap: Record<Location, string> = {
      us: import.meta.env.VITE_WEBSOCKET_URL_US || "wss://api.elevenlabs.io",
      "eu-residency":
        import.meta.env.VITE_WEBSOCKET_URL_EU_RESIDENCY || "wss://api-eu.elevenlabs.io",
      "in-residency":
        import.meta.env.VITE_WEBSOCKET_URL_IN_RESIDENCY || "wss://api-in.elevenlabs.io",
      global: import.meta.env.VITE_WEBSOCKET_URL || "wss://api.elevenlabs.io",
    };

    return {
      location,
      serverUrl: computed(() => serverUrlMap[location.value]),
      webSocketUrl: computed(() => websocketUrlMap[location.value]),
    };
  }, []);

  return <ServerLocationContext.Provider value={value}>{children}</ServerLocationContext.Provider>;
}

export function useServerLocation() {
  return useContextSafely(ServerLocationContext);
}
