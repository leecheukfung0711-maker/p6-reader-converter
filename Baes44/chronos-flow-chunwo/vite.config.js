import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

// Workspace root (the folder holding the shared .env with FRONTEND_PORT).
const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const workspaceEnv = loadEnv(mode, workspaceRoot, '')

  return {
    logLevel: 'error', // Suppress warnings, only show errors
    server: {
      // Port always comes from the workspace root .env (never hardcoded, never port+1).
      port: Number(workspaceEnv.FRONTEND_PORT) || 5173,
      strictPort: true,
      // Local backend (project / programme-version storage for the ProjectBar).
      // The app itself talks to the Base44 cloud through /api (base44 plugin),
      // so the local API gets its own prefix; the port comes from the root .env.
      proxy: {
        '/local-api': {
          target: `http://localhost:${workspaceEnv.BACKEND_PORT || 8080}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/local-api/, ''),
        },
      },
    },
    plugins: [
      base44({
        // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
        // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
        hmrNotifier: true,
        navigationNotifier: true,
        analyticsTracker: true,
        visualEditAgent: true
      }),
      react(),
    ]
  }
});