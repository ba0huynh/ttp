import { redirect } from '@tanstack/react-router'

import { hasPermission, landingPath } from '#/lib/permissions.ts'
import type { PermissionHolder, PermissionKey } from '#/lib/permissions.ts'

/**
 * Call in a route's `beforeLoad` after the login check: sends the user to the
 * first page their role may open when it lacks the permission for this one.
 * (The server functions enforce the same permissions; this only avoids
 * showing an error page.)
 */
export function requirePagePermission(
  user: PermissionHolder,
  key: PermissionKey,
) {
  if (!hasPermission(user, key))
    throw redirect({ to: landingPath(user) as '/' })
}
