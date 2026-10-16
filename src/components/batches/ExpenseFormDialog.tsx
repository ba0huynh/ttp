import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { useCan } from '#/components/auth/Can.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import {
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
import { Textarea } from '#/components/ui/textarea.tsx'
import { masterDataQuery } from '#/lib/queries.ts'
import { saveExpenseTypeFn } from '#/server/fns/master-data.ts'

export interface ExpenseFormValues {
  expenseTypeId: number
  description: string
  amount: number
}

const EMPTY: ExpenseFormValues = {
  expenseTypeId: 0,
  description: '',
  amount: 0,
}

/**
 * Popup form to add or edit one batch expense. Used by the create page (the
 * expense stays in the page until the batch is saved) and by the batch editor
 * (it is saved at once).
 */
export function ExpenseFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  submitLabel = 'Lưu',
  pending = false,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initial?: ExpenseFormValues | null
  submitLabel?: string
  pending?: boolean
  /** Return normally to close the dialog; throw to keep it open */
  onSubmit: (values: ExpenseFormValues) => Promise<void> | void
}) {
  const { data: master } = useQuery(masterDataQuery())
  const types = master?.expenseTypes ?? []
  const [v, setV] = React.useState<ExpenseFormValues>(initial ?? EMPTY)
  const [error, setError] = React.useState<string | null>(null)

  const queryClient = useQueryClient()
  const canManage = useCan('master-data.manage')

  // Quick-create an expense type without leaving the expense form
  const [typeOpen, setTypeOpen] = React.useState(false)
  const [tName, setTName] = React.useState('')
  const [tError, setTError] = React.useState<string | null>(null)
  const [tPending, setTPending] = React.useState(false)

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!tName.trim()) return setTError('Vui lòng nhập tên loại chi phí')
    setTPending(true)
    try {
      const res = await saveExpenseTypeFn({ data: { name: tName.trim() } })
      await queryClient.invalidateQueries({ queryKey: ['master-data'] })
      setV((cur) => ({ ...cur, expenseTypeId: res.id }))
      setTypeOpen(false)
    } catch (err: unknown) {
      setTError(
        err instanceof Error ? err.message : 'Không lưu được loại chi phí',
      )
    } finally {
      setTPending(false)
    }
  }

  // Start from the expense being edited (or an empty form) every time it opens
  React.useEffect(() => {
    if (open) {
      setV(initial ?? EMPTY)
      setError(null)
    }
  }, [open, initial])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!v.expenseTypeId) return setError('Vui lòng chọn loại chi phí')
    if (v.amount <= 0) return setError('Số tiền chi phí phải lớn hơn 0')
    try {
      await onSubmit({ ...v, description: v.description.trim() })
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không lưu được chi phí')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Loại Chi Phí *</Label>
            <SearchSelect
              className="h-11 w-full rounded-lg text-sm"
              placeholder="Chọn loại chi phí"
              value={v.expenseTypeId ? String(v.expenseTypeId) : ''}
              onValueChange={(val) =>
                setV({ ...v, expenseTypeId: Number(val) })
              }
              createAction={
                canManage
                  ? {
                      label: 'Thêm loại chi phí mới',
                      onClick: () => {
                        setTName('')
                        setTError(null)
                        setTypeOpen(true)
                      },
                    }
                  : undefined
              }
            >
              {types.map((t) => (
                <SearchSelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SearchSelectItem>
              ))}
            </SearchSelect>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Diễn Giải</Label>
            <Textarea
              rows={3}
              maxLength={255}
              value={v.description}
              onChange={(e) => setV({ ...v, description: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Số Tiền (VNĐ) *</Label>
            <MoneyInput
              blankZero
              placeholder="0"
              value={v.amount}
              onValueChange={(n) => setV({ ...v, amount: n })}
            />
          </div>
          {error && (
            <p className="text-[11px] font-medium text-rose-600">{error}</p>
          )}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={pending}
              size="sm"
              className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
            >
              {pending ? 'Đang lưu...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Thêm Loại Chi Phí Mới
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleCreateType}
            noValidate
            className="space-y-3 pt-2"
          >
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Tên Loại Chi Phí *
              </Label>
              <Input
                autoFocus
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                placeholder="Thuế nhập khẩu"
              />
            </div>
            {tError && (
              <p className="text-[11px] font-medium text-rose-600">{tError}</p>
            )}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTypeOpen(false)}
                className="h-8 text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={tPending}
                size="sm"
                className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                {tPending ? 'Đang lưu...' : 'Lưu Loại Chi Phí'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
