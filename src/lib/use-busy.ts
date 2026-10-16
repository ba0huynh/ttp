import * as React from 'react'

/**
 * Which rows / buttons are waiting for the server right now, by key
 * (e.g. `banks:12`). Used by the delete buttons: the spinner covers both the
 * "what uses this row?" lookup before the confirmation popup and the delete
 * itself.
 */
export function useBusyKeys() {
  const [keys, setKeys] = React.useState<ReadonlySet<string>>(new Set())
  const setBusy = React.useCallback((key: string, on: boolean) => {
    setKeys((prev) => {
      if (prev.has(key) === on) return prev
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])
  return { isBusy: (key: string) => keys.has(key), setBusy }
}
