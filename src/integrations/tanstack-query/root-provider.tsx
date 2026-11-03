import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import {
  ACCOUNT_LOCKED_MESSAGE,
  isAccountLockedError,
  isUnauthenticatedError,
} from '#/lib/auth-errors.ts'
import { alertDialog } from '#/components/ui/confirm-dialog.tsx'

/**
 * The session can end while a page is open (an admin deactivated the account,
 * the session expired, the password was reset). Every server function then
 * answers UNAUTHENTICATED or ACCOUNT_LOCKED: drop all cached data and go back to the login page.
 * A full page load is used on purpose so no stale user data survives.
 */
let loggingOut = false
function handleAuthError(error: unknown) {
  if (typeof window === 'undefined' || loggingOut) return
  if (!isUnauthenticatedError(error) && !isAccountLockedError(error)) return
  if (window.location.pathname.startsWith('/login')) return
  loggingOut = true

  if (isAccountLockedError(error)) {
    try {
      void alertDialog({
        title: 'Tài khoản đã bị khóa',
        description: ACCOUNT_LOCKED_MESSAGE,
        buttonLabel: 'Về trang đăng nhập',
        destructive: true,
      }).then(() => {
        window.location.href = '/login?locked=1'
      })
    } catch {
      window.location.href = '/login?locked=1'
    }
    return
  }

  window.location.href = '/login'
}

export function getContext() {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleAuthError }),
    mutationCache: new MutationCache({ onError: handleAuthError }),
    defaultOptions: {
      // Internal data changes slowly: avoid hitting the server on every navigation
      queries: { staleTime: 30_000 },
    },
  })

  return {
    queryClient,
  }
}
export default function TanstackQueryProvider() {}
