import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig(() => {
  return {
    base: repositoryName ? `/${repositoryName}/` : '/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['tubiao.jpg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'app-icon-options/**/*'],
        manifest: false,
        workbox: {
          importScripts: ['notification-events.js'],
          globPatterns: ['**/*.{js,css,html,wasm}', 'qimen-engine-license.txt'],
          runtimeCaching: [{
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/openings\/rain-window(?:\.mp4|-poster\.webp)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'yyphone-opening-media-v1',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          }],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
