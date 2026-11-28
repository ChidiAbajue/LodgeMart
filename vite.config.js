import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local dev: /api is proxied to the backend (cd server && npm run dev), so the
// frontend needs no VITE_API_URL. In production set VITE_API_URL to the API URL.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
    },
  },
})
