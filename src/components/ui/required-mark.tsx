import * as React from 'react'

/**
 * Turns a trailing "*" in label text ("Tên Đăng Nhập *") into a red asterisk.
 * Only plain-string children are rewritten; anything else is returned as is.
 */
export function markRequired(children: React.ReactNode): React.ReactNode {
  const convert = (node: React.ReactNode): React.ReactNode => {
    if (typeof node !== 'string') return node
    const m = /^([\s\S]*?)\s*\*\s*$/.exec(node)
    if (!m) return node
    return (
      <span>
        {m[1]}
        <span className="ml-0.5 font-semibold text-rose-600">*</span>
      </span>
    )
  }
  if (Array.isArray(children)) {
    // Only the last piece of the label can carry the asterisk
    const last = children.length - 1
    return children.map((c, i) => (i === last ? convert(c) : c))
  }
  return convert(children)
}
