import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // './' = relative asset paths — works on any GitHub Pages subdirectory
  // without needing to know the exact repo name
  base: './',
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      // Dev only — proxies /api to local backend
      // In production VITE_API_URL points directly to Railway
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
