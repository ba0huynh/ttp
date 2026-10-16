import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// `PORT` in .env sets the dev/preview server port (default 3000). The
// production server (`npm run start`) reads the same variable via Nitro.
const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.PORT) || 3000

  return {
    // APP_URL (.env) is the public address of the app, used to build image URLs
    define: {
      'import.meta.env.VITE_APP_URL': JSON.stringify(env.APP_URL ?? ''),
    },
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    resolve: { tsconfigPaths: true },
    build: {
      rolldownOptions: {
        // Các thư viện React (Radix, TanStack Query...) có dòng "use client" ở đầu
        // file; khi bundle chúng bị bỏ đi và đây chỉ là cảnh báo vô hại (app dùng
        // TanStack Start, không phải RSC), nên ẩn đi cho log build gọn.
        onLog(level, log, defaultHandler) {
          if (log.code === 'MODULE_LEVEL_DIRECTIVE') return
          defaultHandler(level, log)
        },
      },
    },
    plugins: [
      devtools(),
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
        strategy: ['url', 'baseLocale'],
      }),
      nitro({
        output: { dir: 'dist' },
        rollupConfig: { external: [/^@sentry\//] },
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  }
})

export default config
