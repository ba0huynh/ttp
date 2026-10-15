import * as React from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog.tsx'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button for deletions and other irreversible actions */
  destructive?: boolean
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

let show: ((p: Pending) => void) | null = null

/**
 * Promise-based replacement for `window.confirm`:
 * `if (!(await confirmDialog({ title: 'Xóa ...?', destructive: true }))) return`.
 * Needs `<ConfirmDialogHost />` to be mounted (it is, inside `AppLayout`).
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ ...options, resolve })
    // No host mounted (should not happen): fall back to the browser dialog
    else resolve(window.confirm(options.description ?? options.title))
  })
}

export function ConfirmDialogHost() {
  const [open, setOpen] = React.useState(false)
  // Kept after closing so the text does not vanish during the fade-out
  const [current, setCurrent] = React.useState<Pending | null>(null)

  React.useEffect(() => {
    show = (p) => {
      setCurrent(p)
      setOpen(true)
    }
    return () => {
      show = null
    }
  }, [])

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        // Closing by Esc / Cancel / outside click means "no"; if the confirm
        // button was used its onClick already resolved with true
        if (!o) current?.resolve(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{current?.title}</AlertDialogTitle>
          {current?.description && (
            <AlertDialogDescription>
              {current.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{current?.cancelLabel ?? 'Hủy'}</AlertDialogCancel>
          <AlertDialogAction
            variant={current?.destructive ? 'destructive' : 'default'}
            onClick={() => current?.resolve(true)}
          >
            {current?.confirmLabel ?? 'Xác nhận'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
