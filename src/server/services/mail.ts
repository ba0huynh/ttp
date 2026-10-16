import nodemailer from 'nodemailer'

/** SMTP settings from the environment (`.env`); null when mail is not configured */
function mailConfig() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USERNAME
  const pass = process.env.SMTP_PASSWORD
  const from = process.env.MAIL_FROM_ADDRESS || user
  if (process.env.MAIL_DRIVER !== 'smtp' || !host || !user || !pass || !from)
    return null
  const port = Number(process.env.SMTP_PORT) || 587
  return {
    host,
    port,
    user,
    pass,
    from,
    fromName: process.env.MAIL_FROM_NAME || 'Trường Thịnh Phát',
    // Port 465 is implicit TLS; other ports upgrade with STARTTLS when SMTP_TLS is on
    secure: port === 465,
    requireTLS: port !== 465 && process.env.SMTP_TLS !== 'false',
  }
}

export const isMailConfigured = () => mailConfig() !== null

/** Sends one HTML mail through the configured SMTP server; throws if not configured */
export async function sendMail(opts: {
  to: string
  subject: string
  html: string
  text: string
}) {
  const c = mailConfig()
  if (!c) throw new Error('Máy chủ email chưa được cấu hình')
  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    requireTLS: c.requireTLS,
    auth: { user: c.user, pass: c.pass },
  })
  await transport.sendMail({
    from: { name: c.fromName, address: c.from },
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  })
}

/** Password reset mail with a link that stays valid for 30 minutes */
export function sendPasswordResetMail(to: string, link: string) {
  return sendMail({
    to,
    subject: 'Đặt lại mật khẩu - Trường Thịnh Phát',
    text: `Bạn vừa yêu cầu đặt lại mật khẩu. Mở liên kết sau (có hiệu lực 30 phút):\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
    html: `<p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản của mình.</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#0f6b4f;color:#fff;border-radius:6px;text-decoration:none">Đặt lại mật khẩu</a></p>
<p>Liên kết có hiệu lực trong 30 phút. Nếu nút không mở được, hãy dán địa chỉ này vào trình duyệt:<br>${link}</p>
<p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
  })
}
