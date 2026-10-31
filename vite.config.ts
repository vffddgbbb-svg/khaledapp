// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: { plugins: [VitePWA({
    strategies: "generateSW", filename: "sw.js", registerType: "autoUpdate", injectRegister: null,
    devOptions: { enabled: false },
    manifest: { id: "/", name: "رفيق المناوبات", short_name: "رفيق", lang: "ar", dir: "rtl", start_url: "/", scope: "/", display: "standalone", theme_color: "#146b62", background_color: "#f6faf9", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }] },
    workbox: {
      globPatterns: ["**/*.{js,css,woff2,png,ico}"], additionalManifestEntries: [{ url: "/offline.html", revision: "1" }],
      navigateFallback: "/offline.html", navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /^\/_server/],
      runtimeCaching: [
        { urlPattern: ({ request, url }) => request.mode === "navigate" && !/^\/(~oauth|api|_server)/.test(url.pathname), handler: "NetworkFirst", options: { cacheName: "public-navigation", networkTimeoutSeconds: 8, cacheableResponse: { statuses: [] }, precacheFallback: { fallbackURL: "/offline.html" } } },
        { urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/.*-[a-zA-Z0-9_-]+\.(js|css|woff2)$/.test(url.pathname), handler: "CacheFirst", options: { cacheName: "hashed-assets", expiration: { maxEntries: 100, maxAgeSeconds: 2592000 } } },
      ],
    },
  })] },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
