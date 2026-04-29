import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('firebase')) {
            if (id.includes('auth')) return 'firebase-auth'
            if (id.includes('firestore')) return 'firebase-firestore'
            return 'firebase-core'
          }
          if (id.includes('react-router')) return 'router'
          if (id.includes('react')) return 'react-vendor'
          return 'vendor'
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: '보정성당 주일학교',
        short_name: '주일학교',
        description: '보정성당 주일학교 출석 및 전례 관리',
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
})
