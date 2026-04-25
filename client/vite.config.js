import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
      '/audio': { target: 'http://localhost:3000', changeOrigin: true },
      '/upload': { target: 'http://localhost:3000', changeOrigin: true },
      '/broadcast': { target: 'http://localhost:3000', changeOrigin: true },
      '/status': { target: 'http://localhost:3000', changeOrigin: true },
      '/radio/open': { target: 'http://localhost:3000', changeOrigin: true },
      '/radio/close': { target: 'http://localhost:3000', changeOrigin: true },
    }
  }
})