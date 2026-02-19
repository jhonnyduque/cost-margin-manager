import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    base: '/',  // Raíz absoluta para Vercel y local

    plugins: [react()],

    server: {
      port: 3000,
      host: '0.0.0.0',           // Permite acceso desde red (opcional, pero útil)
      hmr: {
        host: 'localhost',       // Fuerza localhost para el WebSocket de HMR
        protocol: 'ws',          // Usa ws en lugar de wss (para desarrollo local)
        port: 3000,              // Asegura que coincida con el puerto del server
      },
    },

    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  }
})