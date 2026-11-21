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
    define: { 'import.meta.env.VITE_SERVER_ACCESS_GATE': JSON.stringify(process.env.PHONE_ACCESS_GATE === '1') },
    base: repositoryName ? `/${repositoryName}/` : '/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Authenticated deployments must always check the server before loading.
        disable: process.env.PHONE_ACCESS_GATE === '1',
        registerType: 'autoUpdate',
        includeAssets: ['tubiao.jpg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'app-icon-options/**/*', 'openings/christmas.webp'],
        manifest: false,
        workbox: {
          importScripts: ['notification-events.js'],
          globPatterns: ['**/*.{js,css,html,wasm}', 'qimen-engine-license.txt'],
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
