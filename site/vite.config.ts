import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

import { cloudflare } from "@cloudflare/vite-plugin";

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), cloudflare()],
  resolve: {
    alias: { '@': path('.') },
  },
  // Two pages: the marketing site and the client console, so neither ships the other's code.
  // Client environment only: the Worker has its own entry.
  environments: {
    client: {
      build: {
        rolldownOptions: {
          input: { main: path('index.html'), console: path('console/index.html') },
        },
      },
    },
  },
})
