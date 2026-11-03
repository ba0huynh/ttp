import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { ModelOption } from '#/components/batches/ModelOption.tsx'
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
import { Textarea } from '#/components/ui/textarea.tsx'
import {
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
import { saveColorFn, saveModelFn } from '#/server/fns/master-data.ts'
import { DEFAULT_VAT_RATE, formatVnd, modelLabel, priceWithVat } from '#/lib/business.ts'
import { masterDataQuery } from '#/lib/queries.ts'

export interface VehicleFormValues {
  modelId: number
  colorId: number
  chassisNumber: string
  engineNumber: string
  year?: number | null
  note?: string | null
  importPrice: number
  vatRate?: number
}

const EMPTY: VehicleFormValues = {
  modelId: 0,
  colorId: 0,
  chassisNumber: '',
  engineNumber: '',
  year: null,
  note: null,
  importPrice: 0,
  vatRate: DEFAULT_VAT_RATE,
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
  const queryClient = useQueryClient()
  const canManage = useCan('master-data.manage')

  // Quick-create a colour without leaving the vehicle form
  const [colorOpen, setColorOpen] = React.useState(false)
  const [cName, setCName] = React.useState('')
  const [cError, setCError] = React.useState<string | null>(null)
  const [cPending, setCPending] = React.useState(false)

  // Quick-create a model the same way
  const [modelOpen, setModelOpen] = React.useState(false)
  const [mName, setMName] = React.useState('')
  const [mError, setMError] = React.useState<string | null>(null)
  const [mPending, setMPending] = React.useState(false)

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!mName.trim()) return setMError('Vui lòng nhập dòng xe')
    setMPending(true)
    try {
      const res = await saveModelFn({
        data: {
          name: mName.trim(),
        },
      })
      await queryClient.invalidateQueries({ queryKey: ['master-data'] })
      setV((cur) => ({ ...cur, modelId: res.id }))
      setModelOpen(false)
    } catch (err: unknown) {
      setMError(err instanceof Error ? err.message : 'Không lưu được dòng xe')
    } finally {
      setMPending(false)
    }
  }

  const handleCreateColor = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!cName.trim()) return setCError('Vui lòng nhập tên màu')
    setCPending(true)
    try {
      const res = await saveColorFn({ data: { name: cName.trim() } })
      await queryClient.invalidateQueries({ queryKey: ['master-data'] })
      setV((cur) => ({ ...cur, colorId: res.id }))
      setColorOpen(false)
    } catch (err: unknown) {
      setCError(err instanceof Error ? err.message : 'Không lưu được màu')
    } finally {
      setCPending(false)
    }
  }

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
        year: v.year ? Number(v.year) : null,
        note: v.note?.trim() || null,
      })
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không lưu được xe')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Dòng Xe *</Label>
              <SearchSelect
                className="h-11 w-full rounded-lg text-sm"
                placeholder="Chọn dòng xe"
                value={v.modelId ? String(v.modelId) : ''}
                onValueChange={(val) => {
                  setV({ ...v, modelId: Number(val) })
                }}
                createAction={
                  canManage
                    ? {
                        label: 'Thêm dòng xe mới',
                        onClick: () => {
                          setMName('')
                          setMError(null)
                          setModelOpen(true)
                        },
                      }
                    : undefined
                }
              >
                {models.map((m) => (
                  <SearchSelectItem
                    key={m.id}
                    value={String(m.id)}
                    keywords={modelLabel(m)}
                  >
                    <ModelOption model={m} />
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
                createAction={
                  canManage
                    ? {
                        label: 'Thêm màu mới',
                        onClick: () => {
                          setCName('')
                          setCError(null)
                          setColorOpen(true)
                        },
                      }
                    : undefined
                }
              >
                {colors.map((c) => (
                  <SearchSelectItem
                    key={c.id}
                    value={String(c.id)}
                    keywords={c.name}
                  >
                    {c.name}
                  </SearchSelectItem>
                ))}
              </SearchSelect>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Năm / Đời xe</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="2026"
                value={v.year ?? ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setV({
                    ...v,
                    year: val ? Number(val) : null,
                  })
                }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="vehicle-note" className="text-xs font-semibold">
              Ghi chú
            </Label>
            <Textarea
              id="vehicle-note"
              value={v.note ?? ''}
              onChange={(e) => setV({ ...v, note: e.target.value })}
              placeholder="Ghi chú (tùy chọn)"
              rows={3}
            />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">% VAT *</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={v.vatRate ?? DEFAULT_VAT_RATE}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d.]/g, '')
                  setV({
                    ...v,
                    vatRate: val === '' ? 0 : Math.min(100, Number(val)),
                  })
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Đơn Giá Đã VAT</Label>
              <Input
                readOnly
                tabIndex={-1}
                value={formatVnd(priceWithVat(v.importPrice, v.vatRate ?? DEFAULT_VAT_RATE))}
                className="bg-slate-50 font-medium text-slate-700"
              />
            </div>
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
      <Dialog open={modelOpen} onOpenChange={setModelOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Thêm Dòng Xe Mới
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleCreateModel}
            noValidate
            className="space-y-3 pt-2"
          >
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Dòng Xe *</Label>
              <Input
                autoFocus
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                placeholder="SH 150i ABS"
              />
            </div>
            {mError && (
              <p className="text-[11px] font-medium text-rose-600">{mError}</p>
            )}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModelOpen(false)}
                className="h-8 text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={mPending}
                size="sm"
                className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                {mPending ? 'Đang lưu...' : 'Lưu Dòng Xe'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={colorOpen} onOpenChange={setColorOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Thêm Màu Mới
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleCreateColor}
            noValidate
            className="space-y-3 pt-2"
          >
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tên Màu *</Label>
              <Input
                autoFocus
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="Đỏ Đô"
              />
            </div>
            {cError && (
              <p className="text-[11px] font-medium text-rose-600">{cError}</p>
            )}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setColorOpen(false)}
                className="h-8 text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={cPending}
                size="sm"
                className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                {cPending ? 'Đang lưu...' : 'Lưu Màu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
