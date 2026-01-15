import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Para Electron, usa caminhos relativos (./) para funcionar com file:// protocol
  // Para desenvolvimento web, o Vite serve automaticamente, então '/' funciona
  base: process.env.NODE_ENV === 'production' ? './' : '/',
  server: {
    port: 5173,
    strictPort: false,
    open: false,
    cors: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Mantém estrutura de diretórios para Electron
        preserveModules: false
      }
    }
  }
})


