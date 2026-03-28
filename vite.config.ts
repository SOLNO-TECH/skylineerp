import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API_TARGET = 'http://127.0.0.1:3001';

const apiProxy = {
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
  },
  '/uploads': {
    target: API_TARGET,
    changeOrigin: true,
  },
} as const;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  /* 127.0.0.1 evita fallos del proxy en Windows cuando localhost resuelve a IPv6 (::1) y la API solo escucha en IPv4 */
  server: {
    proxy: { ...apiProxy },
  },
  preview: {
    proxy: { ...apiProxy },
  },
})
