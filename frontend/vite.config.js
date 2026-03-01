import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  // In dev, base is '/' so npm run dev just works at localhost:5173
  // In build, base is '/static/' so FastAPI's app.mount("/static", ...) serves the assets
  base: command === 'build' ? '/static/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
}))
