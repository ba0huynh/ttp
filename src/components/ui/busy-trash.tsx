import { Loader2, Trash2 } from 'lucide-react'

/** Trash icon that turns into a spinner while the delete is in progress */
export function BusyTrash({
  busy,
  className = 'size-3.5',
}: {
  busy: boolean
  className?: string
}) {
  return busy ? (
    <Loader2 className={`${className} animate-spin`} />
  ) : (
    <Trash2 className={className} />
  )
}
