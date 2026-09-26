import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'FitSathi — AI form coach',
        short_name: 'FitSathi',
        description: 'On-device AI form coach, adaptive plans and campus squads.',
        theme_color: '#050608',
        background_color: '#050608',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell + the pose model + the WASM runtime so a workout
        // works with zero connectivity in a hostel.
        //
        // Only ONE copy of the ~11 MB MediaPipe runtime is precached: the hashed
        // assets/vision_wasm_module_internal-*.wasm that Vite emits for the pose worker,
        // which is the path a workout actually takes. The unhashed public/wasm copy is
        // only reached by the main-thread fallback, so it is runtime-cached on first use
        // instead — precaching both would double the install to ~30 MB.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,task,wasm}'],
        globIgnores: [
          '**/pose_landmarker_full.task',
          '**/vision_wasm_nosimd_internal.*',
          '**/wasm/vision_wasm_internal.*',
        ],
        maximumFileSizeToCacheInBytes: 14 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/models\/pose_landmarker_full\.task$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pose-models', expiration: { maxEntries: 2 } },
          },
          {
            // Main-thread fallback runtime (FilesetResolver reads these from /wasm).
            urlPattern: /\/wasm\/vision_wasm_internal\.(js|wasm)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pose-wasm-fallback', expiration: { maxEntries: 4 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, host: true },
  preview: { port: 4173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})
