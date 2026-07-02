import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command }) => ({
  root,
  base: process.env.VITE_EMPLOYER_BASE || (command === 'serve' ? '/' : '/employer/'),
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3002,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:4000', ws: true },
    },
  },
}))
