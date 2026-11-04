import { createFileRoute } from '@tanstack/react-router'

import { hasPermission } from '#/lib/permissions.ts'
import {
  SESSION_COOKIE,
  getUserBySessionToken,
} from '#/server/services/auth.ts'
import { UPLOAD_FOLDERS, saveImage } from '#/server/services/uploads.ts'

/** Value of one cookie from a Cookie request header */
function cookieValue(header: string | null, name: string) {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

/** POST multipart form (`file`, `folder`) -> { key }. Needs master-data.manage. */
export const Route = createFileRoute('/api/uploads')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = cookieValue(request.headers.get('cookie'), SESSION_COOKIE)
        let user = null
        try {
          user = token ? await getUserBySessionToken(token) : null
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Phiên đăng nhập đã hết hạn'
          return json({ error: msg }, 401)
        }
        if (!user) return json({ error: 'Phiên đăng nhập đã hết hạn' }, 401)
        if (!hasPermission(user, 'master-data.manage'))
          return json(
            { error: 'Bạn không có quyền thực hiện thao tác này' },
            403,
          )
        try {
          const form = await request.formData()
          const file = form.get('file')
          const folder = String(form.get('folder') ?? '')
          if (!(file instanceof File))
            return json({ error: 'Chưa chọn ảnh' }, 400)
          if (!(UPLOAD_FOLDERS as readonly string[]).includes(folder))
            return json({ error: 'Thư mục không hợp lệ' }, 400)
          const key = await saveImage(
            folder as (typeof UPLOAD_FOLDERS)[number],
            file,
          )
          return json({ key })
        } catch (e) {
          return json({ error: (e as Error).message }, 400)
        }
      },
    },
  },
})
