import { createServerFn } from '@tanstack/react-start'
import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'
import { eq, sql } from 'drizzle-orm'
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
import { authMiddleware } from './middleware.ts'

const cookieOpts = (expires: Date) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  expires,
})

/** Trả về user hiện tại hoặc null (dùng trong beforeLoad để guard route) */
export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const token = getCookie(SESSION_COOKIE)
    if (!token) return null
    return getUserBySessionToken(token)
  },
)

export const loginFn = createServerFn({ method: 'POST' })
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

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const token = getCookie(SESSION_COOKIE)
  if (token) await deleteSession(token)
  deleteCookie(SESSION_COOKIE, { path: '/' })
  return { ok: true }
})

/**
 * Đăng ký: người đầu tiên trở thành admin & được kích hoạt ngay.
 * Các tài khoản sau ở trạng thái CHỜ DUYỆT (is_active = false) cho tới khi admin kích hoạt.
 */
export const registerFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      username: z
        .string()
        .trim()
        .min(3, 'Tên đăng nhập tối thiểu 3 ký tự')
        .regex(/^[a-zA-Z0-9_.]+$/, 'Chỉ dùng chữ, số, dấu _ và .'),
      email: z.email('Email không hợp lệ'),
      fullName: z.string().trim().min(2, 'Nhập họ tên'),
      password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    }),
  )
  .handler(async ({ data }) => {
    const [cnt] = await db.select({ n: sql<number>`count(*)` }).from(users)
    const isFirst = Number(cnt?.n ?? 0) === 0
    const [dup] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        sql`${users.username} = ${data.username} OR ${users.email} = ${data.email}`,
      )
    if (dup) throw new Error('Tên đăng nhập hoặc email đã được sử dụng')
    await db.insert(users).values({
      username: data.username,
      email: data.email,
      fullName: data.fullName,
      passwordHash: await hashPassword(data.password),
      role: isFirst ? 'admin' : 'sales',
      isActive: isFirst,
    })
    return { pendingApproval: !isFirst }
  })

/**
 * Quên mật khẩu. Hệ thống chưa tích hợp email:
 *  - Link đặt lại được ghi ra log server.
 *  - Ở môi trường dev, link được trả về để hiển thị trực tiếp.
 */
export const forgotPasswordFn = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.email('Email không hợp lệ') }))
  .handler(async ({ data }) => {
    const token = await createPasswordResetToken(data.email)
    const link = token ? `/reset-password?token=${token}` : null
    if (link) console.info(`[password-reset] ${data.email}: ${link}`)
    return {
      ok: true,
      devLink: process.env.NODE_ENV !== 'production' ? link : null,
    }
  })

export const resetPasswordFn = createServerFn({ method: 'POST' })
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
