import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react({ jsxImportSource: '@feynman/reading' }), tailwindcss(), {
    name: 'reading-runtime-source',
    enforce: 'post',
    config(config) {
      // React adds its JSX runtime to include; our runtime is app source.
      if (config.optimizeDeps?.include) config.optimizeDeps.include = config.optimizeDeps.include.filter(id => !id.startsWith('@feynman/reading/'))
    },
  }],
  resolve: { alias: { '@feynman/reading': fileURLToPath(new URL('./src/reading-runtime', import.meta.url)) } },
  // Keep the runtime on the app module graph so it shares the preference store.
  optimizeDeps: { exclude: ['@feynman/reading/jsx-runtime', '@feynman/reading/jsx-dev-runtime'] },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, watch: { usePolling: true }, proxy: { '/api': 'http://127.0.0.1:3001' } },
})
