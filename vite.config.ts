import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  lint: {
    plugins: ["react", "typescript", "oxc"],
    categories: {
      correctness: "warn",
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "typescript/ban-ts-comment": "error",
      "typescript/no-explicit-any": "off",
    },
    ignorePatterns: [
      "dist",
      "dev-dist",
      "convex/_generated",
      "exports",
      "scripts",
    ],
  },
  test: {
    // convex-test must run un-externalized so its import.meta.glob of
    // convex/ modules works inside the test bundle
    server: { deps: { inline: ["convex-test"] } },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate", // automatically update when new SW available
      injectRegister: "auto", // automatically inject SW registration script
      strategies: "generateSW",
      manifest: {
        name: "Brigade Availability and Operations",
        short_name: "BRAVO",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
      },
      workbox: {
        importScripts: ["./sw-push.js"], // include push handler
        skipWaiting: true, // immediately activate new SW
        clientsClaim: true, // take control of all clients immediately
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit (default is 2 MB)
      },
      devOptions: {
        enabled: true, // enable PWA in dev for easier testing
        // In dev, generateSW globs over dev-dist which only contains the SW
        // itself, so workbox warns that the glob matches nothing — harmless
        suppressWarnings: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // listen on 0.0.0.0 so the dev server is reachable on the LAN
    warmup: {
      // pre-transform on dev server start to speed up first page load
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/pages/AuthPage.tsx",
        "./src/pages/DashboardPage.tsx",
        "./src/pages/AvailabilityPage.tsx",
      ],
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // PDF generation — large libs only used in specific features
          if (
            id.includes("jspdf") ||
            id.includes("html2canvas") ||
            id.includes("dompurify") ||
            id.includes("purify")
          ) {
            return "vendor-pdf";
          }

          // Charts — recharts and its d3 sub-dependencies
          if (id.includes("recharts") || id.includes("d3-")) {
            return "vendor-charts";
          }

          // Core React runtime + routing
          if (
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/react/")
          ) {
            return "vendor-react";
          }

          // Convex client
          if (id.includes("/convex/") || id.includes("@convex-dev")) {
            return "vendor-convex";
          }

          // Radix UI primitives + related UI libs
          if (
            id.includes("@radix-ui") ||
            id.includes("@headlessui") ||
            id.includes("/cmdk/") ||
            id.includes("/vaul/") ||
            id.includes("/sonner/") ||
            id.includes("@dnd-kit")
          ) {
            return "vendor-ui";
          }
        },
      },
    },
  },
});
