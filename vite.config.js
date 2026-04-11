import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/calendar.ics': 'http://localhost:3001',
      '/feed.ics': 'http://localhost:3001',
    },
  },
})
