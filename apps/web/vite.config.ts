import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Dua entry HTML terpisah (keputusan #10, PLAN.md §5.5): index.html untuk
// undangan tamu (legacy jQuery + CSS vendor, TIDAK boleh menyentuh Tailwind),
// admin.html untuk dashboard admin (Tailwind + React Router, TIDAK boleh
// menyentuh CSS/JS legacy). globals.css hanya diimpor dari admin-main.tsx.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'admin.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    // Wajib: tanpa ini vitest men-stub modul CSS jadi string kosong, dan
    // penjaga spesifisitas di WeddingWish.test.tsx (yang membaca
    // wedding-wish.css lewat ?raw) lolos tanpa memeriksa apa pun.
    css: true,
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
