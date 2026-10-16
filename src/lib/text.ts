/** Lower-case and strip Vietnamese diacritics: "Quản Trị" -> "quan tri" */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
}

/**
 * Client-side list search: true when every word typed appears in at least one
 * of the fields, ignoring case and diacritics ("nguyen hung" finds
 * "Nguyễn Văn Hùng"). An empty query matches everything.
 */
export function matchesSearch(
  query: string,
  ...fields: (string | null | undefined)[]
): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = foldText(fields.filter(Boolean).join(' '))
  return words.every((w) => haystack.includes(w))
}
