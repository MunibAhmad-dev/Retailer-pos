import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('react/')) {
              return 'vendor';
            }
            if (id.includes('lucide') || id.includes('radix') || id.includes('sonner')) {
              return 'ui';
            }
            return 'deps';
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      // Forward /api/* from the browser to Electron's HTTP bridge (port 3001).
      // Used by browserApiShim.ts when the app runs in a plain browser via
      // a Cloudflare tunnel instead of the Electron desktop client.
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './', // for electron relative paths
});