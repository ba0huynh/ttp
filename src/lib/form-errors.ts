/**
 * Helpers that turn server-function validation errors (stringified Zod v4
 * issues) into per-field messages so forms can render them under the input.
 */

interface ZodIssueLike {
  code?: string
  origin?: string
  minimum?: number
  maximum?: number
  format?: string
  path?: Array<string | number>
  message?: string
}

/** Field name -> Vietnamese message shown under that field's input */
export type FieldErrors = Record<string, string>

function issueToMessage(issue: ZodIssueLike): string {
  const isString = issue.origin === 'string'
  switch (issue.code) {
    case 'too_small':
      if (isString) {
        return issue.minimum === 1
          ? 'Không được để trống'
          : `Tối thiểu ${issue.minimum} ký tự`
      }
      return `Giá trị tối thiểu là ${issue.minimum}`
    case 'too_big':
      return isString
        ? `Tối đa ${issue.maximum} ký tự`
        : `Giá trị tối đa là ${issue.maximum}`
    case 'invalid_format':
      return issue.format === 'email'
        ? 'Email không hợp lệ'
        : 'Định dạng không hợp lệ'
    case 'invalid_type':
      return 'Vui lòng nhập giá trị hợp lệ'
    default:
      return issue.message || 'Dữ liệu không hợp lệ'
  }
}

/**
 * Parse an error thrown by a server function into `{ field: message }`.
 * Returns an empty object when the error is not a field-level validation
 * error (caller should then fall back to a generic dialog / banner).
 */
export function parseFieldErrors(err: unknown): FieldErrors {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const text = raw.trim()
  if (!text.startsWith('[')) return {}
  try {
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed)) return {}
    const out: FieldErrors = {}
    for (const item of parsed as ZodIssueLike[]) {
      const field = item.path?.[0]
      if (field === undefined) continue
      const key = String(field)
      // Keep the first message per field
      if (!(key in out)) out[key] = issueToMessage(item)
    }
    return out
  } catch {
    return {}
  }
}
