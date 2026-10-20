import { Building2 } from 'lucide-react'
import * as React from 'react'

import { imageSrc } from '#/lib/image-url.ts'

/** Supplier logo with a neutral icon fallback when missing or broken */
export function SupplierLogo({
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
        <Building2 className="size-1/2 max-h-6 max-w-6" />
      </span>
    )
  return (
    <img
      src={imageSrc(src)}
      alt={name ?? ''}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 rounded bg-white object-contain`}
    />
  )
}
