import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { hasPermission } from '#/lib/permissions.ts'
import type { PermissionKey } from '#/lib/permissions.ts'
import { currentUserQuery } from '#/lib/queries.ts'

/** True when the signed-in user's role holds the permission */
export function useCan(permission: PermissionKey): boolean {
  // Already loaded by every route's beforeLoad, so this is a cache read
  const { data: user } = useQuery(currentUserQuery())
  return hasPermission(user, permission)
}

/** Renders its children only for users whose role holds the permission */
export function Can({
  permission,
  children,
}: {
  permission: PermissionKey
  children: React.ReactNode
}) {
  return useCan(permission) ? <>{children}</> : null
}
