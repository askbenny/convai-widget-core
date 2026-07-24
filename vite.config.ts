/// <reference types="@vitest/browser/providers/playwright" />

import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";
import analyzer from "vite-bundle-analyzer";
import tailwindcss from "@tailwindcss/vite";
import tailwindShadowDOM from "./vite-plugin-tailwind-shadowdom";

export default defineConfig({
  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
    },
  },
  build: {
    lib: {
      entry: "src/index.ts",
      fileName: "index",
      formats: ["es"],
    },
    outDir: "dist",
    rollupOptions: {
      external: id =>
        id.startsWith("preact") ||
        id.startsWith("@preact") ||
        id.startsWith("@elevenlabs"),
      output: {
        // webrtcCompat must evaluate before the external @elevenlabs/client
        // import (which runs webrtc-adapter shims at import time). Keeping it
        // in its own chunk preserves that ordering; inlined into index.js it
        // would run after the hoisted external imports.
        manualChunks: id =>
          id.includes("utils/webrtcCompat") ? "webrtcCompat" : undefined,
      },
    },
  },
  plugins: [
    tailwindcss(),
    tailwindShadowDOM(),
    preact(),
    ...(process.env.ANALYZE ? [analyzer()] : []),
  ],
  test: {
    name: "ConvAI Widget Tests",
    browser: {
      provider: "playwright",
      enabled: true,
      instances: [
        {
          browser: "chromium",
          launch: {
            args: [
              "--use-fake-device-for-media-stream",
              "--use-fake-ui-for-media-stream",
            ],
          },
          context: {
            permissions: ["microphone"],
          },
        },
      ],
    },
  },
});
