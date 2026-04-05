import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['vite.svg'],
        manifest: {
          name: 'Data4Life',
          short_name: 'Data4Life',
          description: 'WHOOP sleep dashboard',
          theme_color: '#0b1220',
          background_color: '#0b1220',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/vite.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
      }),
    ],
    server: {
      proxy: apiTarget
        ? {
            '/aws-api': {
              target: apiTarget,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(/^\/aws-api/, '') || '/',
              // Ensure Cognito JWT reaches API Gateway (some proxy setups drop this).
              configure(proxy) {
                proxy.on('proxyReq', (proxyReq, req) => {
                  const auth = req.headers.authorization ?? req.headers.Authorization
                  if (typeof auth === 'string' && auth.length > 0) {
                    proxyReq.setHeader('Authorization', auth)
                  }
                })
              },
            },
          }
        : {},
    },
  }
})
