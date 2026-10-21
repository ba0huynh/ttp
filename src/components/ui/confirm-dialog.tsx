import { Link } from '@tanstack/react-router'
import { AlertCircle, Info } from 'lucide-react'
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

/** Records that use something which cannot be deleted, shown as links */
export interface UsageGroupView {
  title: string
  total: number
  items: { label: string; href: string }[]
}

export interface AlertOptions {
  title?: string
  description?: string
  buttonLabel?: string
  destructive?: boolean
  /** Optional list of related records, each a link to its page */
  groups?: UsageGroupView[]
}

interface PendingConfirm extends ConfirmOptions {
  type: 'confirm'
  resolve: (ok: boolean) => void
}

interface PendingAlert extends AlertOptions {
  type: 'alert'
  resolve: () => void
}

type Pending = PendingConfirm | PendingAlert

let showDialog: ((p: Pending) => void) | null = null

const FIELD_TRANSLATIONS: Record<string, string> = {
  password: 'Mật khẩu',
  currentPassword: 'Mật khẩu hiện tại',
  newPassword: 'Mật khẩu mới',
  username: 'Tên đăng nhập',
  fullName: 'Họ và tên',
  email: 'Email',
  phone: 'Số điện thoại',
  roleId: 'Vai trò',
  taxCode: 'Mã số thuế',
  name: 'Tên',
  accountName: 'Tên tài khoản',
  accountNumber: 'Số tài khoản',
  branch: 'Chi nhánh',
  bankId: 'Ngân hàng',
  address: 'Địa chỉ',
  representative: 'Người đại diện',
  chassisNumber: 'Số khung',
  engineNumber: 'Số máy',
  importPrice: 'Đơn giá nhập',
  sellingPrice: 'Đơn giá bán',
  amount: 'Số tiền',
  modelId: 'Dòng xe',
  colorId: 'Màu xe',
  supplierId: 'Nhà cung cấp',
  expenseTypeId: 'Loại chi phí',
  pricingValue: 'Giá trị định giá',
}

/** Names of list fields, used to say which row an error belongs to */
const ROW_LABELS: Record<string, string> = {
  vehicles: 'Xe',
  expenses: 'Chi phí',
}

/** `['vehicles', 0, 'importPrice']` -> `Xe 1 — Đơn giá nhập` */
function describePath(path: Array<string | number> | undefined): string {
  if (!path || path.length === 0) return ''
  const parts: string[] = []
  for (let i = 0; i < path.length; i++) {
    const key = path[i]
    const next = path[i + 1]
    if (
      typeof key === 'string' &&
      ROW_LABELS[key] &&
      typeof next === 'number'
    ) {
      parts.push(`${ROW_LABELS[key]} ${next + 1}`)
      i++
    } else if (typeof key === 'string') {
      parts.push(FIELD_TRANSLATIONS[key] || key)
    }
  }
  return parts.join(' — ')
}

/**
 * Parses raw error messages (such as stringified Zod issues) into user-friendly strings.
 */
export function formatErrorMessage(
  err: unknown,
  fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.',
): string {
  if (!err) return fallback
  const raw = err instanceof Error ? err.message : String(err)
  if (!raw) return fallback

  // Never show raw SQL ("Failed query: delete from ...") to the user
  if (raw.startsWith('Failed query')) return fallback

  const trimmed = raw.trim()
  try {
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((item: any) => {
            const field = describePath(item.path)

            let msg = item.message || 'Dữ liệu không hợp lệ'
            if (item.code === 'too_small' && item.type === 'string') {
              msg = `Tối thiểu ${item.minimum} ký tự`
            } else if (item.code === 'too_big' && item.type === 'string') {
              msg = `Tối đa ${item.maximum} ký tự`
            }

            return field ? `${field}: ${msg}` : msg
          })
          .join('\n')
      }
      if (parsed && typeof parsed === 'object') {
        if (parsed.message) return String(parsed.message)
        if (parsed.error) return String(parsed.error)
      }
    }
  } catch {
    // If JSON parsing fails, fall through to raw string
  }

  return raw
}

/**
 * Promise-based replacement for `window.confirm`:
 * `if (!(await confirmDialog({ title: 'Xóa ...?', destructive: true }))) return`.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (showDialog) {
      showDialog({ ...options, type: 'confirm', resolve })
    } else {
      resolve(window.confirm(options.description ?? options.title))
    }
  })
}

/**
 * Promise-based replacement for `window.alert`:
 * `await alertDialog('Đã lưu thành công!')` or `await alertDialog({ title: 'Lỗi', description: '...' })`.
 */
export function alertDialog(
  messageOrOptions: string | AlertOptions,
  options?: Partial<AlertOptions>,
): Promise<void> {
  return new Promise((resolve) => {
    const opts: AlertOptions =
      typeof messageOrOptions === 'string'
        ? { description: messageOrOptions, ...options }
        : { ...messageOrOptions, ...options }

    if (showDialog) {
      showDialog({ ...opts, type: 'alert', resolve })
    } else {
      window.alert(opts.description ?? opts.title ?? 'Thông báo')
      resolve()
    }
  })
}

/**
 * "Cannot delete: it is still used by ..." with the names of the records using
 * it, each linking to its detail page (see `reportDeleteFailure` in lib/usage.ts).
 */
export function showUsageDialog(
  title: string,
  groups: UsageGroupView[],
): Promise<void> {
  return alertDialog({
    title,
    description:
      'Mục này đang được sử dụng nên chưa thể xóa. Hãy đổi hoặc xóa các mục bên dưới trước, bấm vào tên để mở chi tiết.',
    groups,
    destructive: true,
    buttonLabel: 'Đã hiểu',
  })
}

/**
 * Helper to show an error dialog with automated Zod/API error formatting.
 */
export function showErrorDialog(
  err: unknown,
  fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.',
): Promise<void> {
  const formatted = formatErrorMessage(err, fallback)
  return alertDialog({
    title: 'Thông Báo Lỗi',
    description: formatted,
    destructive: true,
    buttonLabel: 'Đã hiểu',
  })
}

export function ConfirmDialogHost() {
  const [open, setOpen] = React.useState(false)
  const [current, setCurrent] = React.useState<Pending | null>(null)

  React.useEffect(() => {
    showDialog = (p) => {
      setCurrent(p)
      setOpen(true)
    }
    return () => {
      showDialog = null
    }
  }, [])

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen && current) {
      if (current.type === 'confirm') {
        current.resolve(false)
      } else {
        current.resolve()
      }
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className="max-h-[85vh] max-w-md overflow-y-auto"
        onOverlayClick={() => handleOpenChange(false)}
      >
        <AlertDialogHeader>
          <div className="flex items-center gap-2.5">
            {current?.destructive ? (
              <div className="size-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="size-4.5" />
              </div>
            ) : (
              <div className="size-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Info className="size-4.5" />
              </div>
            )}
            <AlertDialogTitle className="text-sm font-bold text-slate-900">
              {current?.title ||
                (current?.destructive ? 'Thông Báo Lỗi' : 'Thông Báo')}
            </AlertDialogTitle>
          </div>
          {current?.description && (
            <AlertDialogDescription className="text-xs text-slate-600 whitespace-pre-line text-left pl-10.5 leading-relaxed">
              {current.description}
            </AlertDialogDescription>
          )}
          {current?.type === 'alert' && current.groups && (
            <div className="space-y-3 pl-10.5 text-left">
              {current.groups.map((g) => (
                <div key={g.title} className="space-y-1">
                  <div className="text-xs font-semibold text-slate-800">
                    {g.title} ({g.total})
                  </div>
                  <ul className="space-y-0.5 text-xs">
                    {g.items.map((item, i) => {
                      const [path, query = ''] = item.href.split('?')
                      return (
                        <li key={i}>
                          <Link
                            to={path as '/'}
                            search={
                              Object.fromEntries(
                                new URLSearchParams(query),
                              ) as never
                            }
                            onClick={() => {
                              current.resolve()
                              setOpen(false)
                            }}
                            className="text-emerald-700 hover:underline"
                          >
                            {item.label}
                          </Link>
                        </li>
                      )
                    })}
                    {g.total > g.items.length && (
                      <li className="text-slate-500">
                        … và {g.total - g.items.length} mục khác
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="pt-2">
          {current?.type === 'confirm' ? (
            <>
              <AlertDialogCancel className="h-8 text-xs">
                {current.cancelLabel ?? 'Hủy'}
              </AlertDialogCancel>
              <AlertDialogAction
                variant={current.destructive ? 'destructive' : 'default'}
                className="h-8 text-xs font-semibold"
                onClick={() => {
                  current.resolve(true)
                  setOpen(false)
                }}
              >
                {current.confirmLabel ?? 'Xác nhận'}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction
              variant={current?.destructive ? 'destructive' : 'default'}
              className="h-8 text-xs font-semibold"
              onClick={() => {
                current?.resolve()
                setOpen(false)
              }}
            >
              {current?.buttonLabel ?? 'Đóng'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
