import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'MacPhail Freedom Calculator',
        short_name: 'Freedom Calc',
        description: 'Plan your debt payoff with avalanche, snowball, or custom strategies.',
        theme_color: '#0B1220',
        background_color: '#0B1220',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/roqlxsfaleuwcfwordfk\.supabase\.co\/.*/i,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ]
})
