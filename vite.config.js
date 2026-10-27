import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Two HTML entry points: "/" (English) and "/zh/" (Chinese, own titles for search engines).
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 4321, host: true },
  preview: { port: 4321 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        zh: resolve(__dirname, 'zh/index.html'),
      },
    },
  },
})
