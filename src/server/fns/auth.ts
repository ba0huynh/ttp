import { createServerFn } from '@tanstack/react-start'
import {
  deleteCookie,
  getCookie,
  getRequestUrl,
  setCookie,
} from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { users } from '#/db/schema.ts'
import {
  SESSION_COOKIE,
  authenticate,
  createPasswordResetToken,
  createSession,
  deleteSession,
  getUserBySessionToken,
  hashPassword,
  resetPasswordWithToken,
  verifyPassword,
} from '#/server/services/auth.ts'
import {
  isMailConfigured,
  sendPasswordResetMail,
} from '#/server/services/mail.ts'
import { authMiddleware, loggingMiddleware } from './middleware.ts'

const cookieOpts = (expires: Date) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  expires,
})

/** Returns current user or null (used in beforeLoad to guard routes) */
export const getCurrentUserFn = createServerFn({ method: 'GET' })
  .middleware([loggingMiddleware])
  .handler(async () => {
    const token = getCookie(SESSION_COOKIE)
    if (!token) return null
    return getUserBySessionToken(token)
  })

export const loginFn = createServerFn({ method: 'POST' })
  .middleware([loggingMiddleware])
  .validator(
    z.object({
      login: z.string().trim().min(1, 'Nhập tên đăng nhập hoặc email'),
      password: z.string().min(1, 'Nhập mật khẩu'),
    }),
  )
  .handler(async ({ data }) => {
    const user = await authenticate(data.login, data.password)
    if (!user)
      throw new Error(
        'Sai thông tin đăng nhập hoặc tài khoản chưa được kích hoạt',
      )
    const { token, expiresAt } = await createSession(user.id)
    setCookie(SESSION_COOKIE, token, cookieOpts(expiresAt))
    return { ok: true }
  })

export const logoutFn = createServerFn({ method: 'POST' })
  .middleware([loggingMiddleware])
  .handler(async () => {
    const token = getCookie(SESSION_COOKIE)
    if (token) await deleteSession(token)
    deleteCookie(SESSION_COOKIE, { path: '/' })
    return { ok: true }
  })

/**
 * Quên mật khẩu: gửi liên kết đặt lại qua SMTP (cấu hình trong .env).
 * Email không tồn tại thì báo lỗi ngay (không gửi). Khi SMTP chưa cấu hình:
 *  - Link đặt lại được ghi ra log server.
 *  - Ở môi trường dev, link được trả về để hiển thị trực tiếp.
 */
export const forgotPasswordFn = createServerFn({ method: 'POST' })
  .middleware([loggingMiddleware])
  .validator(z.object({ email: z.email('Email không hợp lệ') }))
  .handler(async ({ data }) => {
    const token = await createPasswordResetToken(data.email)
    if (!token) throw new Error('Email này chưa được đăng ký trong hệ thống')
    const path = `/reset-password?token=${token}`
    let mailed = false
    if (isMailConfigured()) {
      const origin =
        process.env.APP_URL?.replace(/\/$/, '') ?? getRequestUrl().origin
      try {
        await sendPasswordResetMail(data.email, `${origin}${path}`)
        mailed = true
      } catch (e) {
        console.error('[password-reset] sending mail failed:', e)
        throw new Error('Không gửi được email, vui lòng thử lại sau')
      }
    } else {
      console.info(`[password-reset] ${data.email}: ${path}`)
    }
    return {
      ok: true,
      mailed,
      devLink: !mailed && process.env.NODE_ENV !== 'production' ? path : null,
    }
  })

export const resetPasswordFn = createServerFn({ method: 'POST' })
  .middleware([loggingMiddleware])
  .validator(
    z.object({
      token: z.string().min(10),
      password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    }),
  )
  .handler(async ({ data }) => {
    const ok = await resetPasswordWithToken(data.token, data.password)
    if (!ok)
      throw new Error('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')
    return { ok: true }
  })

export const changePasswordFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự'),
    }),
  )
  .handler(async ({ data, context }) => {
    const [u] = await db
      .select()
      .from(users)
      .where(eq(users.id, context.user.id))
    if (!u || !(await verifyPassword(data.currentPassword, u.passwordHash)))
      throw new Error('Mật khẩu hiện tại không đúng')
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(data.newPassword) })
      .where(eq(users.id, u.id))
    return { ok: true }
  })
