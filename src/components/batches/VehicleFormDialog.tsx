import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { ModelOption } from '#/components/batches/ModelOption.tsx'
import { Button } from '#/components/ui/button.tsx'
import { ColorLabel } from '#/components/ui/color-label.tsx'
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
import { modelLabel } from '#/lib/business.ts'
import { masterDataQuery } from '#/lib/queries.ts'

export interface VehicleFormValues {
  modelId: number
  colorId: number
  chassisNumber: string
  engineNumber: string
  importPrice: number
}

const EMPTY: VehicleFormValues = {
  modelId: 0,
  colorId: 0,
  chassisNumber: '',
  engineNumber: '',
  importPrice: 0,
}

/**
 * Popup form to add or edit one vehicle of a batch. Used by the create page
 * (the vehicle stays in the page until the batch is saved) and by the batch
 * editor (it is saved at once). Picking a model suggests its colour, which
 * can still be changed.
 */
export function VehicleFormDialog({
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
  initial?: VehicleFormValues | null
  submitLabel?: string
  pending?: boolean
  /** Return normally to close the dialog; throw to keep it open */
  onSubmit: (values: VehicleFormValues) => Promise<void> | void
}) {
  const { data: master } = useQuery(masterDataQuery())
  const models = master?.models ?? []
  const colors = master?.colors ?? []
  const [v, setV] = React.useState<VehicleFormValues>(initial ?? EMPTY)
  const [error, setError] = React.useState<string | null>(null)

  // Start from the vehicle being edited (or an empty form) every time it opens
  React.useEffect(() => {
    if (open) {
      setV(initial ?? EMPTY)
      setError(null)
    }
  }, [open, initial])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!v.modelId || !v.colorId)
      return setError('Vui lòng chọn dòng xe và màu xe')
    if (!v.chassisNumber.trim() || !v.engineNumber.trim())
      return setError('Vui lòng nhập đầy đủ số khung và số máy')
    if (v.importPrice <= 0) return setError('Đơn giá nhập phải lớn hơn 0')
    try {
      await onSubmit({
        ...v,
        chassisNumber: v.chassisNumber.trim(),
        engineNumber: v.engineNumber.trim(),
      })
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không lưu được xe')
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
            <Label className="text-xs font-semibold">Dòng Xe *</Label>
            <SearchSelect
              className="h-11 w-full rounded-lg text-sm"
              placeholder="Chọn dòng xe"
              value={v.modelId ? String(v.modelId) : ''}
              onValueChange={(val) => {
                const id = Number(val)
                setV({
                  ...v,
                  modelId: id,
                  // the model's colour is only a suggestion
                  colorId:
                    models.find((m) => m.id === id)?.colorId ?? v.colorId,
                })
              }}
            >
              {models.map((m) => (
                <SearchSelectItem
                  key={m.id}
                  value={String(m.id)}
                  keywords={`${modelLabel(m)} ${colors.find((c) => c.id === m.colorId)?.name ?? ''}`}
                >
                  <ModelOption model={m} colors={colors} />
                </SearchSelectItem>
              ))}
            </SearchSelect>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Màu Xe *</Label>
            <SearchSelect
              className="h-11 w-full rounded-lg text-sm"
              placeholder="Chọn màu xe"
              value={v.colorId ? String(v.colorId) : ''}
              onValueChange={(val) => setV({ ...v, colorId: Number(val) })}
            >
              {colors.map((c) => (
                <SearchSelectItem
                  key={c.id}
                  value={String(c.id)}
                  keywords={c.name}
                >
                  <ColorLabel name={c.name} hex={c.hex} />
                </SearchSelectItem>
              ))}
            </SearchSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Số Khung *</Label>
              <Input
                value={v.chassisNumber}
                onChange={(e) => setV({ ...v, chassisNumber: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Số Máy *</Label>
              <Input
                value={v.engineNumber}
                onChange={(e) => setV({ ...v, engineNumber: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Đơn Giá Nhập *</Label>
            <MoneyInput
              blankZero
              placeholder="0"
              value={v.importPrice}
              onValueChange={(n) => setV({ ...v, importPrice: n })}
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
