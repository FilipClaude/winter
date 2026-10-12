import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Farben im Manifest = Token --color-bg (Manifest kann keine CSS-Variablen lesen).
const bg = '#0A0D12';

// GitHub Pages liefert unter /winter/ aus; der Workflow setzt BASE_PATH. Lokal und in Tests: '/'.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: base,
        name: 'Winter',
        short_name: 'Winter',
        description: 'Persönliches Tages-Tracking: Training, Schule, Körper, Habits.',
        lang: 'de',
        dir: 'ltr',
        start_url: `${base}#/heute`,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: bg,
        theme_color: bg,
        categories: ['health', 'productivity', 'education'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/apple-splash-*.png'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // BFV-Daten (vom täglichen Abgleich): Netz zuerst, offline die letzte Kopie.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/data/bfv.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'winter-bfv', networkTimeoutSeconds: 5, expiration: { maxEntries: 2 } },
          },
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
