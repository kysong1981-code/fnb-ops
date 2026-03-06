import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load environment variables based on mode (development, staging, production)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],

    // Environment variables
    define: {
      __ENV__: JSON.stringify(env),
    },

    // Server configuration for development
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
      },
    },

    // Build optimization
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['axios'],
          },
        },
      },
    },
  }
})
