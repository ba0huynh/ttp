import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { isUnauthenticatedError } from '#/lib/auth-errors.ts'

/**
 * The session can end while a page is open (an admin deactivated the account,
 * the session expired, the password was reset). Every server function then
 * answers UNAUTHENTICATED: drop all cached data and go back to the login page.
 * A full page load is used on purpose so no stale user data survives.
 */
let loggingOut = false
function handleAuthError(error: unknown) {
  if (typeof window === 'undefined' || loggingOut) return
  if (!isUnauthenticatedError(error)) return
  if (window.location.pathname.startsWith('/login')) return
  loggingOut = true
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
