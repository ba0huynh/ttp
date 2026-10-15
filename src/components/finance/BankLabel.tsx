import { Landmark } from 'lucide-react'
import * as React from 'react'

/** Bank logo (VietQR CDN) with a neutral icon fallback when missing or broken */
export function BankLogo({
  src,
  name,
  className = 'h-6 w-11',
}: {
  src?: string | null
  name?: string | null
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)
  if (!src || failed)
    return (
      <span
        className={`${className} shrink-0 rounded bg-slate-100 text-slate-400 flex items-center justify-center`}
      >
        <Landmark className="size-3.5" />
      </span>
    )
  return (
    <img
      src={src}
      alt={name ?? ''}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 rounded bg-white object-contain`}
    />
  )
}

/** Logo + text on one line: used inside selects, tables and chips */
export function BankLabel({
  image,
  children,
  name,
}: {
  image?: string | null
  name?: string | null
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2">
      <BankLogo src={image} name={name} />
      <span className="truncate">{children}</span>
    </span>
  )
}
