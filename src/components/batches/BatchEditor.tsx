import { SupplierSelect } from '#/components/batches/SupplierSelect.tsx'
import { ModelSelect } from '#/components/batches/ModelSelect.tsx'
import { ColorSelect } from '#/components/batches/ColorSelect.tsx'
import { ExpenseTypeSelect } from '#/components/batches/ExpenseTypeSelect.tsx'
import { toast } from 'sonner'
import { useBusyKeys } from '#/lib/use-busy.ts'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Loader2, Plus, RotateCcw, Save, Search, X } from 'lucide-react'
import * as React from 'react'

import { cn, handleRowArrowNavigation } from '#/lib/utils.ts'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  confirmDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
import { DecimalInput } from '#/components/ui/decimal-input.tsx'
import { Input } from '#/components/ui/input.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { MultiSearchSelect } from '#/components/ui/multi-search-select.tsx'
import { SearchSelectItem } from '#/components/ui/search-select.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx'
import { CostWarningAlert } from '#/components/pricing/CostWarningAlert.tsx'
import { computeSellingPrice, formatVnd, isBelowCost } from '#/lib/business.ts'
import type { PricingBase, PricingMethod } from '#/lib/business.ts'
import { masterDataQuery } from '#/lib/queries.ts'
import type { batchDetailQuery } from '#/lib/queries.ts'
import { confirmDelete, reportDeleteFailure } from '#/lib/usage.ts'
import {
  addBatchExpenseFn,
  addVehiclesToBatchFn,
  removeBatchExpenseFn,
  updateBatchExpenseFn,
  removeVehicleFn,
  updateVehicleFn,
  updateBatchInfoFn,
  updateBatchPricingFn,
} from '#/server/fns/batches.ts'

type BatchDetail = Awaited<
  ReturnType<NonNullable<ReturnType<typeof batchDetailQuery>['queryFn']>>
>
/**
 * Module 05: editors for one batch — financing loan, selling price setup, batch
 * expenses and vehicles. Every change is recalculated server-side (allocation +
 * cost + selling price for the whole batch).
 */
export function BatchEditor({ detail }: { detail: BatchDetail }) {
  return (
    <div className="space-y-4">
      <BatchInfoEditor detail={detail} />
      <PricingEditor detail={detail} />
      <ExpensesEditor detail={detail} />
      <VehiclesEditor detail={detail} />
    </div>
  )
}

export type { BatchDetail }

function useBatchMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  /** Replaces the default error dialog (e.g. to explain a refused delete) */
  onFail?: (err: Error, vars: TVars) => void,
) {
  const queryClient = useQueryClient()
  // Batch edits change cost/selling prices, inventory value and reports
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err: Error, vars: TVars) => {
      if (onFail) onFail(err, vars)
      else void showErrorDialog(err, 'Có lỗi xảy ra')
    },
  })
}

export function Section({
  title,
  children,
  aside,
}: {
  title: string
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-800">{title}</div>
        {aside}
      </div>
      {children}
    </div>
  )
}

/* -------------------------------- Batch info ---------------------------------- */

function BatchInfoEditor({ detail }: { detail: BatchDetail }) {
  const [supplierId, setSupplierId] = React.useState(
    detail.batch.supplierId ?? 0,
  )
  const [importDate, setImportDate] = React.useState(detail.batch.importDate)
  const save = useBatchMutation(updateBatchInfoFn)

  return (
    <Section title="Thông Tin Lô">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-[11px]">Nhà cung cấp</Label>
          <SupplierSelect value={supplierId} onChange={setSupplierId} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Ngày nhập *</Label>
          <Input
            type="date"
            value={importDate}
            onChange={(e) => setImportDate(e.target.value)}
            className="h-11 text-sm px-4 rounded-lg"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="h-11 rounded-lg text-sm gap-1.5"
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              data: {
                batchId: detail.batch.id,
                supplierId,
                importDate,
              },
            })
          }
        >
          <Save className="size-3.5" />
          {save.isPending ? 'Đang lưu...' : 'Lưu thông tin'}
        </Button>
      </div>
    </Section>
  )
}

/* ------------------------------- Selling price ------------------------------- */

function PricingEditor({ detail }: { detail: BatchDetail }) {
  const [base, setBase] = React.useState<PricingBase>(detail.batch.pricingBase)
  const [method, setMethod] = React.useState<PricingMethod>(
    detail.batch.pricingMethod,
  )
  const [value, setValue] = React.useState(detail.batch.pricingValue)
  const save = useBatchMutation(updateBatchPricingFn)

  // Live preview with the same formula the server applies
  const preview = detail.vehicles.map((v) => ({
    ...v,
    newPrice: computeSellingPrice(v, {
      pricingBase: base,
      pricingMethod: method,
      pricingValue: value,
    }),
  }))
  const losses = preview.filter((v) => isBelowCost(v.newPrice, v.costPrice))
  const worst = [...preview].sort(
    (a, b) => a.newPrice - a.costPrice - (b.newPrice - b.costPrice),
  )[0]
  const dirty =
    base !== detail.batch.pricingBase ||
    method !== detail.batch.pricingMethod ||
    value !== detail.batch.pricingValue

  return (
    <Section
      title="Cài Giá Bán Theo Lô"
      aside={
        losses.length > 0 && (
          <Badge className="bg-rose-600 text-white text-[11px]">
            {losses.length}/{preview.length} xe bán dưới giá vốn
          </Badge>
        )
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-[11px]">Gốc tính giá</Label>
          <Select value={base} onValueChange={(v) => setBase(v as PricingBase)}>
            <SelectTrigger className="h-11 w-full text-sm bg-white rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="import_price">Đơn giá nhập</SelectItem>
              <SelectItem value="cost_price">Giá vốn thực tế</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Cách cộng thêm</Label>
          <Select
            value={method}
            onValueChange={(v) => setMethod(v as PricingMethod)}
          >
            <SelectTrigger className="h-11 w-full text-sm bg-white rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Cộng % lợi nhuận</SelectItem>
              <SelectItem value="fixed_amount">Cộng số tiền cố định</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">
            {method === 'percent' ? 'Tỷ lệ (%)' : 'Số tiền (VNĐ)'}
          </Label>
          {method === 'percent' ? (
            <DecimalInput
              maxDecimals={2}
              blankZero
              placeholder="0"
              value={value}
              onValueChange={setValue}
              className="h-11 text-sm px-4 rounded-lg"
            />
          ) : (
            <MoneyInput
              blankZero
              placeholder="0"
              value={value}
              onValueChange={setValue}
              className="h-11 text-sm px-4 rounded-lg"
            />
          )}
        </div>
        <Button
          size="sm"
          className="h-11 rounded-lg text-sm gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate({
              data: {
                batchId: detail.batch.id,
                pricingBase: base,
                pricingMethod: method,
                pricingValue: value,
              },
            })
          }
        >
          <Save className="size-3.5" />
          {save.isPending ? 'Đang áp dụng...' : 'Áp dụng cho cả lô'}
        </Button>
      </div>
      {worst && isBelowCost(worst.newPrice, worst.costPrice) && (
        <CostWarningAlert
          sellingPrice={worst.newPrice}
          costPrice={worst.costPrice}
          importPrice={worst.importPrice}
        />
      )}
    </Section>
  )
}

/* -------------------------------- Batch expenses ------------------------------- */

function ExpensesEditor({ detail }: { detail: BatchDetail }) {
  const { data: master } = useQuery(masterDataQuery())
  const [editingExpenseId, setEditingExpenseId] = React.useState<
    number | 'new' | null
  >(null)
  const [eSubmitted, setESubmitted] = React.useState(false)
  const [eDraft, setEDraft] = React.useState<{
    expenseTypeId: number
    description: string
    amount: number
  }>({
    expenseTypeId: 0,
    description: '',
    amount: 0,
  })

  const add = useBatchMutation(addBatchExpenseFn)
  const update = useBatchMutation(updateBatchExpenseFn)
  const remove = useBatchMutation(removeBatchExpenseFn)
  const isSaving = add.isPending || update.isPending
  const total = detail.expenses.reduce((s, e) => s + e.amount, 0)

  const startAddExpense = () => {
    setEDraft({
      expenseTypeId: master?.expenseTypes[0]?.id ?? 0,
      description: '',
      amount: 0,
    })
    setESubmitted(false)
    setEditingExpenseId('new')
  }

  const startEditExpense = (e: (typeof detail.expenses)[number]) => {
    setEDraft({
      expenseTypeId: e.expenseTypeId,
      description: e.description ?? '',
      amount: e.amount,
    })
    setESubmitted(false)
    setEditingExpenseId(e.id)
  }

  const cancelExpenseEdit = () => {
    setEditingExpenseId(null)
    setESubmitted(false)
  }

  const saveExpenseInline = async () => {
    setESubmitted(true)
    if (!eDraft.expenseTypeId) {
      toast.error('Vui lòng chọn loại chi phí (viền đỏ)')
      return
    }
    if (eDraft.amount <= 0) {
      toast.error('Số tiền chi phí phải lớn hơn 0 (viền đỏ)')
      return
    }

    try {
      const expense = {
        expenseTypeId: eDraft.expenseTypeId,
        description: eDraft.description.trim() || null,
        amount: eDraft.amount,
      }
      if (editingExpenseId === 'new') {
        await add.mutateAsync({
          data: { batchId: detail.batch.id, expense },
        })
        toast.success('Đã thêm khoản chi phí')
      } else if (editingExpenseId !== null) {
        const orig = detail.expenses.find((x) => x.id === editingExpenseId)
        const desc = eDraft.description.trim() || null
        const origDesc = orig?.description?.trim() || null
        const hasChanged =
          !orig ||
          orig.expenseTypeId !== eDraft.expenseTypeId ||
          origDesc !== desc ||
          orig.amount !== eDraft.amount

        if (hasChanged) {
          await update.mutateAsync({
            data: { expenseId: editingExpenseId, expense },
          })
          toast.success('Đã cập nhật chi phí')
        }
      }
      setEditingExpenseId(null)
      setESubmitted(false)
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Có lỗi xảy ra khi lưu chi phí')
    }
  }

  const handleExpenseKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const active = document.activeElement as HTMLElement | null
      if (
        active?.closest(
          '[data-radix-popper-content-wrapper], [role="dialog"], [data-radix-popover-content]',
        ) ||
        active?.getAttribute('aria-haspopup') === 'dialog' ||
        active?.getAttribute('data-state') === 'open'
      )
        return
      e.preventDefault()
      e.stopPropagation()
      void saveExpenseInline()
      return
    }
    if (e.key === 'Escape') {
      const active = document.activeElement
      if (active?.closest('[data-radix-popper-content-wrapper], [role="dialog"]')) return
      e.preventDefault()
      e.stopPropagation()
      cancelExpenseEdit()
      return
    }
    handleRowArrowNavigation(e)
  }

  return (
    <Section
      title={`Chi Phí Lô (${detail.expenses.length} khoản — ${formatVnd(total)})`}
      aside={
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 rounded-lg bg-white text-sm"
          onClick={startAddExpense}
          disabled={editingExpenseId !== null}
        >
          <Plus className="size-3.5" />
          Thêm chi phí
        </Button>
      }
    >
      {detail.expenses.length === 0 && editingExpenseId === null ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center bg-white">
          <p className="text-sm text-slate-500">
            Chưa có khoản chi phí nào cho lô này
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 h-8 gap-1.5 text-xs text-emerald-700 hover:text-emerald-800"
            onClick={startAddExpense}
          >
            <Plus className="size-3.5" />
            Thêm chi phí lô
          </Button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
          <Table>
            <TableHeader>
              <TableRow className="text-xs bg-slate-50">
                <TableHead className="w-[240px]">Loại Chi Phí</TableHead>
                <TableHead>Diễn Giải</TableHead>
                <TableHead className="w-[180px] text-right">Số Tiền</TableHead>
                <TableHead className="w-[90px] text-right" />
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {detail.expenses.map((e) => {
                const isEditing = editingExpenseId === e.id
                if (isEditing) {
                  return (
                    <TableRow
                      key={e.id}
                      className="bg-emerald-50/40 border-y border-emerald-200"
                      onKeyDown={handleExpenseKeyDown}
                    >
                      <TableCell className="p-2 align-middle">
                        <ExpenseTypeSelect
                          className={cn(
                            'h-8 text-xs bg-white w-full',
                            eSubmitted &&
                              !eDraft.expenseTypeId &&
                              'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20',
                          )}
                          value={eDraft.expenseTypeId}
                          onChange={(val) =>
                            setEDraft({
                              ...eDraft,
                              expenseTypeId: val,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="p-2 align-middle">
                        <Input
                          value={eDraft.description}
                          onChange={(ev) =>
                            setEDraft({
                              ...eDraft,
                              description: ev.target.value,
                            })
                          }
                          onKeyDown={handleExpenseKeyDown}
                          placeholder="Diễn giải (tùy chọn)"
                          className="h-8 text-xs bg-white"
                        />
                      </TableCell>
                      <TableCell className="p-2 align-middle text-right">
                        <MoneyInput
                          value={eDraft.amount}
                          onValueChange={(val: number) =>
                            setEDraft({ ...eDraft, amount: val })
                          }
                          blankZero
                          onKeyDown={handleExpenseKeyDown}
                          placeholder="Số tiền *"
                          className={cn(
                            'h-8 text-xs text-right bg-white',
                            eSubmitted &&
                              eDraft.amount <= 0 &&
                              'border-rose-500 ring-1 ring-rose-500 focus-visible:ring-rose-500 bg-rose-50/20',
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap p-2 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => void saveExpenseInline()}
                            disabled={isSaving}
                            aria-label="Lưu (Enter)"
                            title="Lưu (Enter)"
                          >
                            {isSaving ? (
                              <Loader2 className="size-4 animate-spin text-emerald-700" />
                            ) : (
                              <Check className="size-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={cancelExpenseEdit}
                            title="Hủy (Esc)"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }

                return (
                  <TableRow
                    key={e.id}
                    className="cursor-pointer hover:bg-emerald-50/40 transition-colors group"
                    onClick={() => {
                      if (editingExpenseId !== e.id) startEditExpense(e)
                    }}
                  >
                    <TableCell className="font-medium text-slate-900">
                      {e.expenseTypeName}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {e.description || '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-900">
                      {formatVnd(e.amount)}
                    </TableCell>
                    <TableCell
                      className="text-right whitespace-nowrap"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-slate-400 hover:text-rose-600"
                          disabled={remove.isPending || editingExpenseId !== null}
                          onClick={async () => {
                            if (
                              await confirmDialog({
                                title: 'Xóa khoản chi phí này?',
                                description: 'Giá vốn cả lô sẽ được tính lại.',
                                confirmLabel: 'Xóa',
                                destructive: true,
                              })
                            )
                              remove.mutate({ data: { expenseId: e.id } })
                          }}
                          aria-label="Xóa chi phí"
                          title="Xóa chi phí"
                        >
                          <BusyTrash
                            busy={
                              remove.isPending &&
                              remove.variables?.data.expenseId === e.id
                            }
                          />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}

              {/* New row when adding an expense */}
              {editingExpenseId === 'new' && (
                <TableRow
                  className="bg-emerald-50/40 border-y border-emerald-200"
                  onKeyDown={handleExpenseKeyDown}
                >
                  <TableCell className="p-2 align-middle">
                    <ExpenseTypeSelect
                      className={cn(
                        'h-8 text-xs bg-white w-full',
                        eSubmitted &&
                          !eDraft.expenseTypeId &&
                          'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20',
                      )}
                      value={eDraft.expenseTypeId}
                      onChange={(val) =>
                        setEDraft({
                          ...eDraft,
                          expenseTypeId: val,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="p-2 align-middle">
                    <Input
                      autoFocus
                      value={eDraft.description}
                      onChange={(ev) =>
                        setEDraft({
                          ...eDraft,
                          description: ev.target.value,
                        })
                      }
                      onKeyDown={handleExpenseKeyDown}
                      placeholder="Diễn giải (tùy chọn)"
                      className="h-8 text-xs bg-white"
                    />
                  </TableCell>
                  <TableCell className="p-2 align-middle text-right">
                    <MoneyInput
                      value={eDraft.amount}
                      onValueChange={(val: number) =>
                        setEDraft({ ...eDraft, amount: val })
                      }
                      blankZero
                      onKeyDown={handleExpenseKeyDown}
                      placeholder="Số tiền *"
                      className={cn(
                        'h-8 text-xs text-right bg-white',
                        eSubmitted &&
                          eDraft.amount <= 0 &&
                          'border-rose-500 ring-1 ring-rose-500 focus-visible:ring-rose-500 bg-rose-50/20',
                      )}
                    />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap p-2 align-middle">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => void saveExpenseInline()}
                        disabled={isSaving}
                        aria-label="Lưu (Enter)"
                        title="Lưu (Enter)"
                      >
                        {isSaving ? (
                          <Loader2 className="size-4 animate-spin text-emerald-700" />
                        ) : (
                          <Check className="size-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={cancelExpenseEdit}
                        title="Hủy (Esc)"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  )
}

/* ---------------------------------- Vehicles ---------------------------------- */

function VehiclesEditor({ detail }: { detail: BatchDetail }) {
  const { data: master } = useQuery(masterDataQuery())
  const { isBusy, setBusy } = useBusyKeys()
  // Inline row editing: id of vehicle being edited, or 'new' when adding
  const [editingVehicleId, setEditingVehicleId] = React.useState<
    number | 'new' | null
  >(null)
  const [vSubmitted, setVSubmitted] = React.useState(false)
  const [vDraft, setVDraft] = React.useState<{
    modelId: number
    colorId: number
    chassisNumber: string
    engineNumber: string
    importPrice: number
  }>({
    modelId: 0,
    colorId: 0,
    chassisNumber: '',
    engineNumber: '',
    importPrice: 0,
  })

  const add = useBatchMutation(addVehiclesToBatchFn)
  const update = useBatchMutation(updateVehicleFn)
  const remove = useBatchMutation(removeVehicleFn, (err, vars) => {
    void reportDeleteFailure(
      err,
      { entity: 'vehicles', id: vars.data.vehicleId },
      'Không thể xóa xe khỏi lô',
    )
  })

  const isSaving = add.isPending || update.isPending

  const [vehicleSearch, setVehicleSearch] = React.useState('')
  const [vehicleModelFilters, setVehicleModelFilters] = React.useState<number[]>([])
  const [vehicleColorFilters, setVehicleColorFilters] = React.useState<number[]>([])

  const batchModelOptions = React.useMemo(() => {
    const map = new Map<number, string>()
    for (const v of detail.vehicles) {
      if (v.modelId && v.modelName) {
        map.set(v.modelId, v.modelName)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [detail.vehicles])

  const batchColorOptions = React.useMemo(() => {
    const map = new Map<number, string>()
    for (const v of detail.vehicles) {
      if (v.colorId && v.colorName) {
        map.set(v.colorId, v.colorName)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [detail.vehicles])

  const hasVehicleFilter =
    vehicleSearch.trim() !== '' ||
    vehicleModelFilters.length > 0 ||
    vehicleColorFilters.length > 0

  const clearVehicleFilters = () => {
    setVehicleSearch('')
    setVehicleModelFilters([])
    setVehicleColorFilters([])
  }

  const filteredVehicles = React.useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase()
    return detail.vehicles.filter((v) => {
      if (editingVehicleId === v.id) return true
      if (
        vehicleModelFilters.length > 0 &&
        (!v.modelId || !vehicleModelFilters.includes(v.modelId))
      )
        return false
      if (
        vehicleColorFilters.length > 0 &&
        (!v.colorId || !vehicleColorFilters.includes(v.colorId))
      )
        return false
      if (!q) return true
      const chassis = v.chassisNumber.toLowerCase()
      const engine = v.engineNumber.toLowerCase()
      const model = (v.modelName ?? '').toLowerCase()
      const color = (v.colorName ?? '').toLowerCase()
      return (
        chassis.includes(q) ||
        engine.includes(q) ||
        model.includes(q) ||
        color.includes(q)
      )
    })
  }, [
    detail.vehicles,
    vehicleSearch,
    vehicleModelFilters,
    vehicleColorFilters,
    editingVehicleId,
  ])

  const startAddVehicle = () => {
    setVDraft({
      modelId: master?.models[0]?.id ?? 0,
      colorId: master?.colors[0]?.id ?? 0,
      chassisNumber: '',
      engineNumber: '',
      importPrice: 0,
    })
    setVSubmitted(false)
    setEditingVehicleId('new')
  }

  const duplicateVehicle = (v: (typeof detail.vehicles)[number]) => {
    setVDraft({
      modelId: v.modelId ?? 0,
      colorId: v.colorId,
      chassisNumber: '',
      engineNumber: '',
      importPrice: v.importPrice,
    })
    setVSubmitted(false)
    setEditingVehicleId('new')
  }

  const startEditVehicle = (v: (typeof detail.vehicles)[number]) => {
    setVDraft({
      modelId: v.modelId ?? 0,
      colorId: v.colorId,
      chassisNumber: v.chassisNumber,
      engineNumber: v.engineNumber,
      importPrice: v.importPrice,
    })
    setVSubmitted(false)
    setEditingVehicleId(v.id)
  }

  const cancelVehicleEdit = () => {
    setEditingVehicleId(null)
    setVSubmitted(false)
  }

  const saveVehicleInline = async () => {
    setVSubmitted(true)
    const chassis = vDraft.chassisNumber.trim()
    const engine = vDraft.engineNumber.trim()
    if (
      !chassis ||
      !engine ||
      !vDraft.modelId ||
      !vDraft.colorId ||
      vDraft.importPrice <= 0
    ) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc (viền đỏ)')
      return
    }
    const dup = detail.vehicles.some(
      (x) =>
        x.id !== editingVehicleId &&
        x.chassisNumber.trim().toLowerCase() === chassis.toLowerCase(),
    )
    if (dup) {
      toast.error('Số khung này đã có trong lô')
      return
    }

    try {
      if (editingVehicleId === 'new') {
        await add.mutateAsync({
          data: {
            batchId: detail.batch.id,
            vehicles: [
              {
                chassisNumber: chassis,
                engineNumber: engine,
                modelId: vDraft.modelId,
                colorId: vDraft.colorId,
                importPrice: vDraft.importPrice,
              },
            ],
          },
        })
        toast.success('Đã thêm xe vào lô')
      } else if (editingVehicleId !== null) {
        const orig = detail.vehicles.find((x) => x.id === editingVehicleId)
        const hasChanged =
          !orig ||
          (orig.modelId ?? 0) !== vDraft.modelId ||
          orig.colorId !== vDraft.colorId ||
          orig.chassisNumber.trim() !== chassis ||
          orig.engineNumber.trim() !== engine ||
          Number(orig.importPrice) !== vDraft.importPrice

        if (hasChanged) {
          await update.mutateAsync({
            data: {
              vehicleId: editingVehicleId,
              chassisNumber: chassis,
              engineNumber: engine,
              modelId: vDraft.modelId,
              colorId: vDraft.colorId,
              importPrice: vDraft.importPrice,
            },
          })
          toast.success('Đã cập nhật thông tin xe')
        }
      }
      setEditingVehicleId(null)
      setVSubmitted(false)
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Có lỗi xảy ra khi lưu xe')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const active = document.activeElement as HTMLElement | null
      if (
        active?.closest(
          '[data-radix-popper-content-wrapper], [role="dialog"], [data-radix-popover-content]',
        ) ||
        active?.getAttribute('aria-haspopup') === 'dialog' ||
        active?.getAttribute('data-state') === 'open'
      )
        return
      e.preventDefault()
      e.stopPropagation()
      void saveVehicleInline()
      return
    }
    if (e.key === 'Escape') {
      const active = document.activeElement
      if (active?.closest('[data-radix-popper-content-wrapper], [role="dialog"]')) return
      e.preventDefault()
      e.stopPropagation()
      cancelVehicleEdit()
      return
    }
    handleRowArrowNavigation(e)
  }

  return (
    <Section
      title={`Danh Sách Xe Trong Lô & Phân Bổ Giá Vốn (${detail.vehicles.length} chiếc)`}
      aside={
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 rounded-lg bg-white text-sm"
          onClick={startAddVehicle}
          disabled={editingVehicleId !== null || isSaving}
        >
          <Plus className="size-3.5" />
          Thêm xe
        </Button>
      }
    >
      {detail.vehicles.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              placeholder="Tìm theo số khung, số máy, dòng xe, màu..."
              className="h-9 pl-9 pr-8 text-xs rounded-lg bg-white"
            />
            {vehicleSearch && (
              <button
                type="button"
                onClick={() => setVehicleSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 size-4 flex items-center justify-center text-xs"
                title="Xóa tìm kiếm"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {batchModelOptions.length > 1 && (
              <MultiSearchSelect
                className="h-9 w-44 text-xs rounded-lg bg-white"
                placeholder={`Tất cả dòng xe (${batchModelOptions.length})`}
                values={vehicleModelFilters.map(String)}
                onValuesChange={(vals) =>
                  setVehicleModelFilters(vals.map(Number))
                }
              >
                {batchModelOptions.map((m) => (
                  <SearchSelectItem
                    key={m.id}
                    value={String(m.id)}
                   
                  >
                    {m.name}
                  </SearchSelectItem>
                ))}
              </MultiSearchSelect>
            )}

            {batchColorOptions.length > 1 && (
              <MultiSearchSelect
                className="h-9 w-40 text-xs rounded-lg bg-white"
                placeholder={`Tất cả màu (${batchColorOptions.length})`}
                values={vehicleColorFilters.map(String)}
                onValuesChange={(vals) =>
                  setVehicleColorFilters(vals.map(Number))
                }
              >
                {batchColorOptions.map((c) => (
                  <SearchSelectItem
                    key={c.id}
                    value={String(c.id)}
                   
                  >
                    {c.name}
                  </SearchSelectItem>
                ))}
              </MultiSearchSelect>
            )}

            {hasVehicleFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearVehicleFilters}
                className="h-9 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 px-2.5 gap-1 shrink-0"
              >
                <RotateCcw className="size-3" />
                Xóa lọc
              </Button>
            )}

            <div className="text-[11px] text-slate-500 whitespace-nowrap self-center px-1">
              Hiển thị <strong>{filteredVehicles.length}</strong> / {detail.vehicles.length} xe
            </div>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
        <Table>
          <TableHeader>
            <TableRow className="text-xs bg-slate-50">
              <TableHead className="w-[180px]">Số Khung</TableHead>
              <TableHead className="w-[180px]">Số Máy</TableHead>
              <TableHead className="min-w-[220px]">Dòng xe / Màu</TableHead>
              <TableHead className="text-right w-[160px]">
                Đơn Giá Nhập
              </TableHead>
              <TableHead className="text-right w-[130px]">CP Phân Bổ</TableHead>
              <TableHead className="text-right w-[140px]">Giá Vốn Xe</TableHead>
              <TableHead className="text-right w-[140px]">
                Giá Bán Áp Dụng
              </TableHead>
              <TableHead className="w-[90px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {filteredVehicles.map((v) => {
              const locked = v.isSold || v.isDelivered || v.isInvoiced
              const isEditing = editingVehicleId === v.id

              if (isEditing) {
                return (
                  <TableRow
                    key={v.id}
                    className="bg-emerald-50/40 border-y border-emerald-200"
                    onKeyDown={handleKeyDown}
                  >
                    <TableCell className="p-2 align-middle">
                      <Input
                        autoFocus
                        value={vDraft.chassisNumber}
                        onChange={(e) =>
                          setVDraft({
                            ...vDraft,
                            chassisNumber: e.target.value,
                          })
                        }
                        onKeyDown={handleKeyDown}
                        placeholder="Số khung *"
                        className={cn(
                          'h-8 text-xs font-mono uppercase bg-white',
                          vSubmitted &&
                            !vDraft.chassisNumber.trim() &&
                            'border-rose-500 ring-1 ring-rose-500 focus-visible:ring-rose-500 bg-rose-50/20',
                        )}
                        disabled={isSaving}
                      />
                    </TableCell>
                    <TableCell className="p-2 align-middle">
                      <Input
                        value={vDraft.engineNumber}
                        onChange={(e) =>
                          setVDraft({
                            ...vDraft,
                            engineNumber: e.target.value,
                          })
                        }
                        onKeyDown={handleKeyDown}
                        placeholder="Số máy *"
                        className={cn(
                          'h-8 text-xs font-mono uppercase bg-white',
                          vSubmitted &&
                            !vDraft.engineNumber.trim() &&
                            'border-rose-500 ring-1 ring-rose-500 focus-visible:ring-rose-500 bg-rose-50/20',
                        )}
                        disabled={isSaving}
                      />
                    </TableCell>
                    <TableCell className="p-2 align-middle">
                      <div className="flex flex-col gap-1.5">
                        <ModelSelect
                          className={cn(
                            'h-8 text-xs bg-white w-full',
                            vSubmitted &&
                              !vDraft.modelId &&
                              'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20',
                          )}
                          value={vDraft.modelId}
                          onChange={(val) =>
                            setVDraft({ ...vDraft, modelId: val })
                          }
                        />
                        <ColorSelect
                          className={cn(
                            'h-8 text-xs bg-white w-full',
                            vSubmitted &&
                              !vDraft.colorId &&
                              'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20',
                          )}
                          value={vDraft.colorId}
                          onChange={(val) =>
                            setVDraft({ ...vDraft, colorId: val })
                          }
                        />
                      </div>
                    </TableCell>
                    <TableCell className="p-2 align-middle text-right">
                      <MoneyInput
                        value={vDraft.importPrice}
                        onValueChange={(val: number) =>
                          setVDraft({ ...vDraft, importPrice: val })
                        }
                        blankZero
                        onKeyDown={handleKeyDown}
                        placeholder="Đơn giá nhập *"
                        className={cn(
                          'h-8 text-xs text-right bg-white',
                          vSubmitted &&
                            vDraft.importPrice <= 0 &&
                            'border-rose-500 ring-1 ring-rose-500 focus-visible:ring-rose-500 bg-rose-50/20',
                        )}
                        disabled={isSaving}
                      />
                    </TableCell>
                    <TableCell className="text-right text-slate-400 text-xs align-middle">
                      +{formatVnd(v.allocatedExpense)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-600 text-xs align-middle">
                      {formatVnd(v.costPrice)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-800 text-xs align-middle">
                      {formatVnd(v.sellingPrice)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap p-2 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isSaving}
                          className="size-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => void saveVehicleInline()}
                          aria-label="Lưu (Enter)"
                          title="Lưu (Enter)"
                        >
                          {isSaving ? (
                            <Loader2 className="size-4 animate-spin text-emerald-700" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isSaving}
                          className="size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={cancelVehicleEdit}
                          title="Hủy (Esc)"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              }

              return (
                <TableRow
                  key={v.id}
                  className={cn(
                    !locked &&
                      'cursor-pointer hover:bg-emerald-50/40 transition-colors group',
                    isBelowCost(v.sellingPrice, v.costPrice) && 'bg-rose-50',
                  )}
                  onClick={() => {
                    if (!locked && editingVehicleId !== v.id) startEditVehicle(v)
                  }}
                >
                  <TableCell className="font-medium font-mono">
                    {v.chassisNumber}
                  </TableCell>
                  <TableCell className="text-slate-500 font-mono">
                    {v.engineNumber}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {v.modelName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {v.colorName}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(v.importPrice)}
                  </TableCell>
                  <TableCell className="text-right text-slate-500">
                    +{formatVnd(v.allocatedExpense)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900">
                    {formatVnd(v.costPrice)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-800">
                    {formatVnd(v.sellingPrice)}
                    {isBelowCost(v.sellingPrice, v.costPrice) && (
                      <div className="text-[10px] font-medium text-rose-700">
                        Dưới giá vốn
                      </div>
                    )}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-slate-400 hover:text-emerald-700"
                        onClick={() => duplicateVehicle(v)}
                        disabled={editingVehicleId !== null || isSaving}
                        aria-label="Nhân bản xe"
                        title="Nhân bản xe"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      {locked ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Đã bán
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-slate-400 hover:text-rose-600"
                          disabled={
                            remove.isPending ||
                            isBusy(`vehicles:${v.id}`) ||
                            editingVehicleId !== null
                          }
                          onClick={async () => {
                            if (
                              await confirmDelete(
                                {
                                  entity: 'vehicles',
                                  id: v.id,
                                  name: v.chassisNumber,
                                },
                                {
                                  title: `Xóa xe ${v.chassisNumber} khỏi lô?`,
                                  description:
                                    'Chi phí lô sẽ được phân bổ lại.',
                                },
                                (checking) =>
                                  setBusy(`vehicles:${v.id}`, checking),
                              )
                            )
                              remove.mutate({ data: { vehicleId: v.id } })
                          }}
                          aria-label="Xóa xe"
                          title="Xóa xe"
                        >
                          <BusyTrash
                            busy={
                              isBusy(`vehicles:${v.id}`) ||
                              (remove.isPending &&
                                remove.variables?.data.vehicleId === v.id)
                            }
                          />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}

            {/* New row when adding a vehicle */}
            {editingVehicleId === 'new' && (
              <TableRow
                className="bg-emerald-50/40 border-y border-emerald-200"
                onKeyDown={handleKeyDown}
              >
                <TableCell className="p-2 align-middle">
                  <Input
                    autoFocus
                    value={vDraft.chassisNumber}
                    onChange={(e) =>
                      setVDraft({
                        ...vDraft,
                        chassisNumber: e.target.value,
                      })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Số khung *"
                    className={cn(
                      'h-8 text-xs font-mono uppercase bg-white',
                      vSubmitted &&
                        !vDraft.chassisNumber.trim() &&
                        'border-rose-500 ring-1 ring-rose-500 focus-visible:ring-rose-500 bg-rose-50/20',
                    )}
                    disabled={isSaving}
                  />
                </TableCell>
                <TableCell className="p-2 align-middle">
                  <Input
                    value={vDraft.engineNumber}
                    onChange={(e) =>
                      setVDraft({
                        ...vDraft,
                        engineNumber: e.target.value,
                      })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Số máy *"
                    className={cn(
                      'h-8 text-xs font-mono uppercase bg-white',
                      vSubmitted &&
                        !vDraft.engineNumber.trim() &&
                        'border-rose-500 ring-1 ring-rose-500 focus-visible:ring-rose-500 bg-rose-50/20',
                    )}
                    disabled={isSaving}
                  />
                </TableCell>
                <TableCell className="p-2 align-middle">
                  <div className="flex flex-col gap-1.5">
                    <ModelSelect
                      className={cn(
                        'h-8 text-xs bg-white w-full',
                        vSubmitted &&
                          !vDraft.modelId &&
                          'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20',
                      )}
                      value={vDraft.modelId}
                      onChange={(val) =>
                        setVDraft({ ...vDraft, modelId: val })
                      }
                    />
                    <ColorSelect
                      className={cn(
                        'h-8 text-xs bg-white w-full',
                        vSubmitted &&
                          !vDraft.colorId &&
                          'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20',
                      )}
                      value={vDraft.colorId}
                      onChange={(val) =>
                        setVDraft({ ...vDraft, colorId: val })
                      }
                    />
                  </div>
                </TableCell>
                <TableCell className="p-2 align-middle text-right">
                  <MoneyInput
                    value={vDraft.importPrice}
                    onValueChange={(val: number) =>
                      setVDraft({ ...vDraft, importPrice: val })
                    }
                    blankZero
                    onKeyDown={handleKeyDown}
                    placeholder="Đơn giá nhập *"
                    className={cn(
                      'h-8 text-xs text-right bg-white',
                      vSubmitted &&
                        vDraft.importPrice <= 0 &&
                        'border-rose-500 ring-1 ring-rose-500 focus-visible:ring-rose-500 bg-rose-50/20',
                    )}
                    disabled={isSaving}
                  />
                </TableCell>
                <TableCell className="text-right text-slate-400 text-xs align-middle">
                  (tính tự động)
                </TableCell>
                <TableCell className="text-right text-slate-400 text-xs align-middle">
                  (tính tự động)
                </TableCell>
                <TableCell className="text-right text-slate-400 text-xs align-middle">
                  (tính tự động)
                </TableCell>
                <TableCell className="text-right whitespace-nowrap p-2 align-middle">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isSaving}
                      className="size-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => void saveVehicleInline()}
                      aria-label="Lưu (Enter)"
                      title="Lưu (Enter)"
                    >
                      {isSaving ? (
                        <Loader2 className="size-4 animate-spin text-emerald-700" />
                      ) : (
                        <Check className="size-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isSaving}
                      className="size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={cancelVehicleEdit}
                      title="Hủy (Esc)"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {filteredVehicles.length === 0 && editingVehicleId !== 'new' && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-xs text-slate-400 italic"
                >
                  Không tìm thấy xe phù hợp với bộ lọc
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Section>
  )
}
