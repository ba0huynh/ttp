import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { Button } from '#/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Label } from '#/components/ui/label.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import {
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
import { Textarea } from '#/components/ui/textarea.tsx'
import { masterDataQuery } from '#/lib/queries.ts'

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
    </Dialog>
  )
}
