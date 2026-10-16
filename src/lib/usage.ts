import {
  showErrorDialog,
  showUsageDialog,
} from '#/components/ui/confirm-dialog.tsx'
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
