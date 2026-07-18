/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'Memorize - Spaced Repetition',
        short_name: 'Memorize',
        description: 'Aplicativo inteligente de memorização com repetição espaçada',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // O bundle principal passou de 2 MiB (limite padrão do Workbox) e deixaria de ser
        // precacheado — o app é local-first e precisa abrir offline, então o teto sobe.
        // O ideal continua sendo dividir o bundle; isto apenas destrava o build.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      devOptions: {
        // Desligado em dev apenas para reduzir ruído: o SW loga "No route found" para toda
        // requisição que não está no precache, poluindo o console durante a depuração.
        // Em produção o SW continua ativo normalmente.
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'src': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
