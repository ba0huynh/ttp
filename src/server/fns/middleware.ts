import { createMiddleware } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

import { UNAUTHENTICATED_MESSAGE } from '#/lib/auth-errors.ts'
import { hasAnyPermission } from '#/lib/permissions.ts'
import type { PermissionKey } from '#/lib/permissions.ts'
import {
  SESSION_COOKIE,
  getUserBySessionToken,
} from '#/server/services/auth.ts'

/**
 * Logs every server function call (name, HTTP method, duration, result).
 * Payloads are deliberately NOT logged: they can contain passwords.
 */
export const loggingMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next, method, serverFnMeta }) => {
    const label = `${method} ${serverFnMeta.name}`
    const startedAt = performance.now()
    const elapsed = () => `${Math.round(performance.now() - startedAt)}ms`
    console.log(`[api] → ${label}`)
    try {
      const result = await next()
      console.log(`[api] ✓ ${label} ${elapsed()}`)
      return result
    } catch (err) {
      console.error(
        `[api] ✗ ${label} ${elapsed()} — ${err instanceof Error ? err.message : String(err)}`,
      )
      throw err
    }
  },
)

/** Authentication required — injects `context.user` into server fn */
export const authMiddleware = createMiddleware({ type: 'function' })
  .middleware([loggingMiddleware])
  .server(async ({ next }) => {
    const token = getCookie(SESSION_COOKIE)
    const user = token ? await getUserBySessionToken(token) : null
    if (!user) throw new Error(UNAUTHENTICATED_MESSAGE)
    return next({ context: { user } })
  })

/**
 * Authentication + permission check: the user's role must hold at least one of
 * the permissions (admin roles hold all). Use it instead of `authMiddleware`
 * on every server function that reads or changes protected data.
 */
export const requirePermission = (...keys: PermissionKey[]) =>
  createMiddleware({ type: 'function' })
    .middleware([authMiddleware])
    .server(async ({ next, context }) => {
      if (!hasAnyPermission(context.user, keys)) {
        throw new Error('Bạn không có quyền thực hiện thao tác này')
      }
      return next()
    })
