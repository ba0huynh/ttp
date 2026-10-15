/**
 * Marker for "the request had no valid session". The server middleware throws
 * an Error whose message starts with this code; the client recognises it and
 * logs the user out automatically. Kept in `lib/` so both sides share it.
 */
export const UNAUTHENTICATED_CODE = 'UNAUTHENTICATED'

export const UNAUTHENTICATED_MESSAGE = `${UNAUTHENTICATED_CODE}: Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại`

export function isUnauthenticatedError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ((error as { message?: unknown } | null)?.message ?? '')
  return typeof message === 'string' && message.includes(UNAUTHENTICATED_CODE)
}
