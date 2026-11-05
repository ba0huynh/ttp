import { createFileRoute } from '@tanstack/react-router'

import { isMailConfigured, sendMail } from '#/server/services/mail.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Dev-only SMTP smoke test: POST { "to": "a@b.com", "subject"?, "message"? }.
 * Disabled in production builds (404) because it has no authentication.
 * Delete this file once SMTP delivery is confirmed.
 */
export const Route = createFileRoute('/api/test-mail')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env.NODE_ENV === 'production')
          return json({ error: 'Not found' }, 404)
        if (!isMailConfigured())
          return json(
            {
              ok: false,
              error:
                'SMTP is not configured (check MAIL_DRIVER, SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, MAIL_FROM_ADDRESS in .env, then restart the dev server)',
            },
            500,
          )

        let body: { to?: string; subject?: string; message?: string }
        try {
          body = await request.json()
        } catch {
          return json({ ok: false, error: 'Body must be valid JSON' }, 400)
        }
        const to = String(body.to ?? '').trim()
        if (!EMAIL_RE.test(to))
          return json({ ok: false, error: '"to" must be a valid email' }, 400)

        const subject = String(body.subject ?? 'SMTP test - Trường Thịnh Phát')
        const message = String(
          body.message ?? 'Đây là email thử nghiệm gửi từ hệ thống.',
        )
        try {
          await sendMail({
            to,
            subject,
            text: message,
            html: `<p>${message.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</p>`,
          })
          return json({ ok: true, to, subject })
        } catch (e) {
          return json({ ok: false, error: (e as Error).message }, 502)
        }
      },
    },
  },
})
