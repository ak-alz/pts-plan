import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

import manifest from './src/manifest.js';

export default defineConfig(() => {
  return {
    base: '/',
    server: {
      port: 5174,
      strictPort: true,
      hmr: {
        host: 'localhost',
        port: 5174,
      },
    },
    build: {
      modulePreload: false,
      emptyOutDir: true,
      outDir: 'build',
      rollupOptions: {
        input: {
          'whats-new': 'whats-new.html',
        },
        output: {
          chunkFileNames: 'assets/chunk-[hash].js',
        },
      },
    },
    plugins: [
      crx({ manifest }),
      vue(),
      tailwindcss(),
    ],
    legacy: {
      skipWebSocketTokenCheck: true,
    },
  };
});
