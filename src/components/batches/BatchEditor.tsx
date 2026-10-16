import { ExpenseFormDialog } from '#/components/batches/ExpenseFormDialog.tsx'
import { VehicleFormDialog } from '#/components/batches/VehicleFormDialog.tsx'
import { useBusyKeys } from '#/lib/use-busy.ts'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Save } from 'lucide-react'
import * as React from 'react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import {
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx'
import { formatVnd } from '#/lib/business.ts'
import type { PricingBase, PricingMethod } from '#/lib/business.ts'
import type { batchDetailQuery } from '#/lib/queries.ts'
import { loansQuery, masterDataQuery } from '#/lib/queries.ts'
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

/* ------------------------------ Batch info / loan ----------------------------- */

function BatchInfoEditor({ detail }: { detail: BatchDetail }) {
  const { data: loans = [] } = useQuery(loansQuery())
  const [loanId, setLoanId] = React.useState<number | null>(
    detail.batch.loanContractId,
  )
  const { data: master } = useQuery(masterDataQuery())
  const [supplierId, setSupplierId] = React.useState(
    detail.batch.supplierId ?? 0,
  )
  const [importDate, setImportDate] = React.useState(detail.batch.importDate)
  const save = useBatchMutation(updateBatchInfoFn)

  return (
    <Section title="Thông Tin Lô">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-[11px]">Nhà cung cấp</Label>
          <SearchSelect
            className="h-11 w-full text-sm bg-white rounded-lg"
            placeholder="Chọn nhà cung cấp"
            value={supplierId ? String(supplierId) : ''}
            onValueChange={(v) => setSupplierId(Number(v))}
          >
            {(master?.suppliers ?? []).map((s) => (
              <SearchSelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SearchSelectItem>
            ))}
          </SearchSelect>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Khế ước vay</Label>
          <SearchSelect
            className="h-11 w-full text-sm bg-white rounded-lg"
            value={loanId ? String(loanId) : 'none'}
            onValueChange={(v) => setLoanId(v === 'none' ? null : Number(v))}
          >
            <SearchSelectItem value="none">Vốn tự có</SearchSelectItem>
            {loans.map((l) => (
              <SearchSelectItem key={l.id} value={String(l.id)}>
                {l.contractNumber} — {l.bankName}
              </SearchSelectItem>
            ))}
          </SearchSelect>
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
                loanContractId: loanId,
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
  // The selling price always starts from the import price (no batch expenses)
  const base: PricingBase = 'import_price'
  const [method, setMethod] = React.useState<PricingMethod>(
    detail.batch.pricingMethod,
  )
  const [value, setValue] = React.useState(detail.batch.pricingValue)
  const save = useBatchMutation(updateBatchPricingFn)

  const dirty =
    base !== detail.batch.pricingBase ||
    method !== detail.batch.pricingMethod ||
    value !== detail.batch.pricingValue

  return (
    <Section title="Cài Giá Bán Theo Lô">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
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
    </Section>
  )
}

/* -------------------------------- Batch expenses ------------------------------- */

function ExpensesEditor({ detail }: { detail: BatchDetail }) {
  // Popup form: id of the expense being edited (null = adding)
  const [open, setOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<number | null>(null)
  const add = useBatchMutation(addBatchExpenseFn)
  const update = useBatchMutation(updateBatchExpenseFn)
  const remove = useBatchMutation(removeBatchExpenseFn)
  const total = detail.expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <Section
      title={`Chi Phí Lô (${detail.expenses.length} khoản — ${formatVnd(total)})`}
      aside={
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 rounded-lg bg-white text-sm"
          onClick={() => {
            setEditId(null)
            setOpen(true)
          }}
        >
          <Plus className="size-3.5" />
          Thêm chi phí
        </Button>
      }
    >
      {detail.expenses.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
          <Table>
            <TableHeader>
              <TableRow className="text-xs bg-slate-50">
                <TableHead>Loại Chi Phí</TableHead>
                <TableHead>Diễn Giải</TableHead>
                <TableHead className="text-right">Số Tiền</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {detail.expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium text-slate-900">
                    {e.expenseTypeName}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {e.description}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900">
                    {formatVnd(e.amount)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-slate-400 hover:text-emerald-700"
                      onClick={() => {
                        setEditId(e.id)
                        setOpen(true)
                      }}
                      aria-label="Sửa chi phí"
                      title="Sửa chi phí"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                      disabled={remove.isPending}
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ExpenseFormDialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? 'Sửa Chi Phí' : 'Thêm Chi Phí Của Lô'}
        submitLabel={editId ? 'Lưu' : 'Thêm Chi Phí'}
        pending={add.isPending || update.isPending}
        initial={
          editId
            ? (() => {
                const e = detail.expenses.find((x) => x.id === editId)
                return e
                  ? {
                      expenseTypeId: e.expenseTypeId,
                      description: e.description ?? '',
                      amount: e.amount,
                    }
                  : null
              })()
            : null
        }
        onSubmit={async (v) => {
          const expense = {
            expenseTypeId: v.expenseTypeId,
            description: v.description || null,
            amount: v.amount,
          }
          if (editId)
            await update.mutateAsync({ data: { expenseId: editId, expense } })
          else
            await add.mutateAsync({
              data: { batchId: detail.batch.id, expense },
            })
        }}
      />
    </Section>
  )
}

/* ---------------------------------- Vehicles ---------------------------------- */

function VehiclesEditor({ detail }: { detail: BatchDetail }) {
  const { isBusy, setBusy } = useBusyKeys()
  // Popup form: id of the vehicle being edited (null = adding)
  const [open, setOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<number | null>(null)
  const add = useBatchMutation(addVehiclesToBatchFn)
  const update = useBatchMutation(updateVehicleFn)
  const remove = useBatchMutation(removeVehicleFn, (err, vars) => {
    void reportDeleteFailure(
      err,
      { entity: 'vehicles', id: vars.data.vehicleId },
      'Không thể xóa xe khỏi lô',
    )
  })

  return (
    <Section
      title={`Danh Sách Xe Trong Lô & Phân Bổ Giá Vốn (${detail.vehicles.length} chiếc)`}
      aside={
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 rounded-lg bg-white text-sm"
          onClick={() => {
            setEditId(null)
            setOpen(true)
          }}
        >
          <Plus className="size-3.5" />
          Thêm xe
        </Button>
      }
    >
      <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
        <Table>
          <TableHeader>
            <TableRow className="text-xs bg-slate-50">
              <TableHead>Số Khung (VIN)</TableHead>
              <TableHead>Số Máy</TableHead>
              <TableHead>Dòng xe / Màu</TableHead>
              <TableHead className="text-right">Đơn Giá Nhập</TableHead>
              <TableHead className="text-right">Giá Bán Áp Dụng</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {detail.vehicles.map((v) => {
              const locked = v.isSold || v.isDelivered || v.isInvoiced
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    {v.chassisNumber}
                  </TableCell>
                  <TableCell className="text-slate-500">
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
                  <TableCell className="text-right font-bold text-emerald-800">
                    {formatVnd(v.sellingPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {locked ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Đã bán
                      </Badge>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-emerald-700"
                          onClick={() => {
                            setEditId(v.id)
                            setOpen(true)
                          }}
                          aria-label="Sửa xe"
                          title="Sửa xe"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                          disabled={
                            remove.isPending || isBusy(`vehicles:${v.id}`)
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
                        >
                          <BusyTrash
                            busy={
                              isBusy(`vehicles:${v.id}`) ||
                              (remove.isPending &&
                                remove.variables?.data.vehicleId === v.id)
                            }
                          />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <VehicleFormDialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? 'Sửa Xe' : 'Thêm Xe Vào Lô'}
        submitLabel={editId ? 'Lưu' : 'Thêm Xe'}
        pending={add.isPending || update.isPending}
        initial={
          editId
            ? (() => {
                const v = detail.vehicles.find((x) => x.id === editId)
                return v
                  ? {
                      modelId: v.modelId ?? 0,
                      colorId: v.colorId,
                      chassisNumber: v.chassisNumber,
                      engineNumber: v.engineNumber,
                      importPrice: v.importPrice,
                    }
                  : null
              })()
            : null
        }
        onSubmit={async (v) => {
          if (editId)
            await update.mutateAsync({ data: { vehicleId: editId, ...v } })
          else
            await add.mutateAsync({
              data: { batchId: detail.batch.id, vehicles: [v] },
            })
        }}
      />
    </Section>
  )
}
