import {
  confirmDialog,
  showErrorDialog,
  showUsageDialog,
} from '#/components/ui/confirm-dialog.tsx'
import type { ConfirmOptions } from '#/components/ui/confirm-dialog.tsx'
import { getUsageFn } from '#/server/fns/usage.ts'

type UsageEntity = Parameters<typeof getUsageFn>[0]['data']['entity']

/**
 * Call from the `catch` of any delete. If other records still use the row it
 * lists them (name + link to the detail page); otherwise it shows the normal
 * error dialog.
 */
export async function reportDeleteFailure(
  err: unknown,
  target: { entity: UsageEntity; id: number; name?: string },
  fallback = 'Không thể xóa',
): Promise<void> {
  try {
    const { groups } = await getUsageFn({
      data: { entity: target.entity, id: target.id },
    })
    if (groups.length > 0) {
      await showUsageDialog(
        target.name ? `Không thể xóa "${target.name}"` : fallback,
        groups,
      )
      return
    }
  } catch {
    // The usage lookup itself failed: fall through to the original error
  }
  await showErrorDialog(err, fallback)
}

/**
 * First step of every delete: look up what uses the row. If something does,
 * show it (names + links) and return false; if nothing does, ask the normal
 * confirmation and return its answer. A failed lookup falls back to the plain
 * confirmation (the server still refuses a row that is in use).
 */
export async function confirmDelete(
  target: { entity: UsageEntity; id: number; name?: string },
  confirm: ConfirmOptions,
): Promise<boolean> {
  try {
    const { groups } = await getUsageFn({
      data: { entity: target.entity, id: target.id },
    })
    if (groups.length > 0) {
      await showUsageDialog(
        target.name ? `Không thể xóa "${target.name}"` : 'Không thể xóa',
        groups,
      )
      return false
    }
  } catch {
    // fall through to the confirmation
  }
  return confirmDialog({ confirmLabel: 'Xóa', destructive: true, ...confirm })
}
