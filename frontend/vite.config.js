import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the React app runs on http://localhost:5173 and the
// Express API on http://localhost:8080. The proxy forwards /api requests to
// the API so the browser sees a single origin (no CORS needed, and the
// SameSite=strict session cookie works exactly as in production).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',
  },
});
