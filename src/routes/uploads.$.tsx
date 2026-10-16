import { createFileRoute } from '@tanstack/react-router'

import { readImage } from '#/server/services/uploads.ts'

/** GET /uploads/<key>: serves a stored image (public, like a logo) */
export const Route = createFileRoute('/uploads/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const img = await readImage(params._splat ?? '')
        if (!img) return new Response('Not found', { status: 404 })
        return new Response(new Uint8Array(img.data), {
          headers: {
            'content-type': img.type,
            'cache-control': 'public, max-age=31536000, immutable',
            'x-content-type-options': 'nosniff',
          },
        })
      },
    },
  },
})
