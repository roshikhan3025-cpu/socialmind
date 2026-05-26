import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    proxy: {
      // Proxy API calls to Vercel serverless functions in development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})