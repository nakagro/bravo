import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate", // automatically update when new SW available
      injectRegister: "auto", // automatically inject SW registration script
      strategies: "generateSW",
      workbox: {
        importScripts: ["./sw-push.js"], // include push handler
        skipWaiting: true, // immediately activate new SW
        clientsClaim: true, // take control of all clients immediately
      },
      devOptions: {
        enabled: true, // enable PWA in dev for easier testing
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
