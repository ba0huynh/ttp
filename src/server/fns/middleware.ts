import { createMiddleware } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

import type { UserRole } from '#/db/schema.ts'
import {
  SESSION_COOKIE,
  getUserBySessionToken,
} from '#/server/services/auth.ts'

/** Authentication required — injects `context.user` into server fn */
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const token = getCookie(SESSION_COOKIE)
    const user = token ? await getUserBySessionToken(token) : null
    if (!user)
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')
    return next({ context: { user } })
  },
)

export function assertRole(user: { role: UserRole }, roles: UserRole[]) {
  if (user.role !== 'admin' && !roles.includes(user.role)) {
    throw new Error('Bạn không có quyền thực hiện thao tác này')
  }
}

export const adminMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    assertRole(context.user, [])
    return next()
  })
