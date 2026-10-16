import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2 } from 'lucide-react'
import * as React from 'react'

import { CostWarningAlert } from '#/components/pricing/CostWarningAlert.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  alertDialog,
  confirmDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
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
import {
  EXPENSE_TYPE_LABELS,
  computeSellingPrice,
  formatVnd,
  isBelowCost,
} from '#/lib/business.ts'
import type { PricingBase, PricingMethod } from '#/lib/business.ts'
import type { batchDetailQuery } from '#/lib/queries.ts'
import { loansQuery, masterDataQuery } from '#/lib/queries.ts'
import {
  addBatchExpenseFn,
  addVehiclesToBatchFn,
  removeBatchExpenseFn,
  removeVehicleFn,
  updateBatchInfoFn,
  updateBatchPricingFn,
} from '#/server/fns/batches.ts'

type BatchDetail = Awaited<
  ReturnType<NonNullable<ReturnType<typeof batchDetailQuery>['queryFn']>>
>
type ExpenseType = BatchDetail['expenses'][number]['expenseType']

const EXPENSE_TYPES = Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[]

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

function useBatchMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient()
  // Batch edits change cost/selling prices, inventory value and reports
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err: Error) => {
      void showErrorDialog(err, 'Có lỗi xảy ra')
    },
  })
}

function Section({
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
  const [importDate, setImportDate] = React.useState(detail.batch.importDate)
  const save = useBatchMutation(updateBatchInfoFn)

  return (
    <Section title="Thông Tin Lô">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-[11px]">Khế ước vay</Label>
          <SearchSelect
            className="h-8 w-full text-xs bg-white"
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
          <Label className="text-[11px]">Ngày nhập</Label>
          <Input
            type="date"
            value={importDate}
            onChange={(e) => setImportDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              data: {
                batchId: detail.batch.id,
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
            <SelectTrigger className="h-8 w-full text-xs bg-white">
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
            <SelectTrigger className="h-8 w-full text-xs bg-white">
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
            <Input
              type="number"
              min={0}
              step={0.1}
              value={value}
              onChange={(e) => setValue(Number(e.target.value) || 0)}
              className="h-8 text-xs"
            />
          ) : (
            <MoneyInput
              value={value}
              onValueChange={setValue}
              className="h-8 text-xs"
            />
          )}
        </div>
        <Button
          size="sm"
          className="h-8 text-xs gap-1 bg-emerald-700 hover:bg-emerald-800 text-white"
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
  const [type, setType] = React.useState<ExpenseType>('import_tax')
  const [description, setDescription] = React.useState('')
  const [amount, setAmount] = React.useState(0)
  const add = useBatchMutation(addBatchExpenseFn)
  const remove = useBatchMutation(removeBatchExpenseFn)
  const total = detail.expenses.reduce((s, e) => s + e.amount, 0)

  const handleAdd = async () => {
    if (amount <= 0) {
      await alertDialog('Số tiền chi phí phải lớn hơn 0')
      return
    }
    add.mutate(
      {
        data: {
          batchId: detail.batch.id,
          expense: {
            expenseType: type,
            description: description || null,
            amount,
          },
        },
      },
      {
        onSuccess: () => {
          setDescription('')
          setAmount(0)
        },
      },
    )
  }

  return (
    <Section
      title={`Chi Phí Lô (${detail.expenses.length} khoản — ${formatVnd(total)})`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {detail.expenses.map((e) => (
          <div
            key={e.id}
            className="p-2 bg-white rounded border border-slate-200 flex items-start justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="text-[11px] text-slate-500">
                {EXPENSE_TYPE_LABELS[e.expenseType] ?? e.expenseType}
              </div>
              <div className="font-bold text-slate-900">
                {formatVnd(e.amount)}
              </div>
              {e.description && (
                <div className="text-[10px] text-slate-400 truncate">
                  {e.description}
                </div>
              )}
            </div>
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
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
        <Select value={type} onValueChange={(v) => setType(v as ExpenseType)}>
          <SelectTrigger className="h-8 w-full text-xs bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {EXPENSE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Diễn giải"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-8 text-xs"
        />
        <MoneyInput
          placeholder="Số tiền"
          value={amount || ''}
          onValueChange={setAmount}
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          disabled={add.isPending}
          onClick={handleAdd}
        >
          <Plus className="size-3.5" />
          Thêm chi phí
        </Button>
      </div>
    </Section>
  )
}

/* ---------------------------------- Vehicles ---------------------------------- */

function VehiclesEditor({ detail }: { detail: BatchDetail }) {
  const { data: master } = useQuery(masterDataQuery())
  const models = master?.models ?? []
  const colors = master?.colors ?? []
  const [modelId, setModelId] = React.useState<number | null>(null)
  const [colorId, setColorId] = React.useState<number | null>(null)
  const [chassis, setChassis] = React.useState('')
  const [engine, setEngine] = React.useState('')
  const [price, setPrice] = React.useState(0)
  const add = useBatchMutation(addVehiclesToBatchFn)
  const remove = useBatchMutation(removeVehicleFn)

  const effModel = modelId ?? models[0]?.id ?? null
  const effColor = colorId ?? colors[0]?.id ?? null

  const handleAdd = async () => {
    if (!effModel || !effColor) {
      await alertDialog('Chưa có dòng xe / màu xe')
      return
    }
    if (!chassis.trim() || !engine.trim()) {
      await alertDialog('Vui lòng nhập đầy đủ số khung và số máy')
      return
    }
    if (price <= 0) {
      await alertDialog('Đơn giá nhập phải lớn hơn 0')
      return
    }
    add.mutate(
      {
        data: {
          batchId: detail.batch.id,
          vehicles: [
            {
              modelId: effModel,
              colorId: effColor,
              chassisNumber: chassis,
              engineNumber: engine,
              importPrice: price,
            },
          ],
        },
      },
      {
        onSuccess: () => {
          setChassis('')
          setEngine('')
        },
      },
    )
  }

  return (
    <Section
      title={`Danh Sách Xe Trong Lô & Phân Bổ Giá Vốn (${detail.vehicles.length} chiếc)`}
    >
      <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
        <Table>
          <TableHeader>
            <TableRow className="text-xs bg-slate-50">
              <TableHead>Số Khung (VIN)</TableHead>
              <TableHead>Số Máy</TableHead>
              <TableHead>Dòng xe / Màu</TableHead>
              <TableHead className="text-right">Đơn Giá Nhập</TableHead>
              <TableHead className="text-right">CP Phân Bổ</TableHead>
              <TableHead className="text-right">Giá Vốn Xe</TableHead>
              <TableHead className="text-right">Giá Bán Áp Dụng</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {detail.vehicles.map((v) => {
              const loss = isBelowCost(v.sellingPrice, v.costPrice)
              const locked = v.isSold || v.isDelivered || v.isInvoiced
              return (
                <TableRow key={v.id} className={loss ? 'bg-rose-50' : ''}>
                  <TableCell className="font-mono font-bold">
                    {v.chassisNumber}
                  </TableCell>
                  <TableCell className="font-mono text-slate-500">
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
                  <TableCell className="text-right font-bold text-slate-900">
                    {formatVnd(v.costPrice)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-bold ${loss ? 'text-rose-700' : 'text-emerald-800'}`}
                  >
                    {formatVnd(v.sellingPrice)}
                    {loss && (
                      <div className="text-[10px] font-semibold">
                        Dưới giá vốn
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {locked ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Đã bán
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                        disabled={remove.isPending}
                        onClick={async () => {
                          if (
                            await confirmDialog({
                              title: `Xóa xe ${v.chassisNumber} khỏi lô?`,
                              description: 'Chi phí lô sẽ được phân bổ lại.',
                              confirmLabel: 'Xóa',
                              destructive: true,
                            })
                          )
                            remove.mutate({ data: { vehicleId: v.id } })
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
        <SearchSelect
          className="h-8 w-full text-xs bg-white"
          placeholder="Dòng xe"
          value={effModel ? String(effModel) : ''}
          onValueChange={(v) => setModelId(Number(v))}
        >
          {models.map((m) => (
            <SearchSelectItem key={m.id} value={String(m.id)}>
              {m.name}
            </SearchSelectItem>
          ))}
        </SearchSelect>
        <SearchSelect
          className="h-8 w-full text-xs bg-white"
          placeholder="Màu xe"
          value={effColor ? String(effColor) : ''}
          onValueChange={(v) => setColorId(Number(v))}
        >
          {colors.map((c) => (
            <SearchSelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SearchSelectItem>
          ))}
        </SearchSelect>
        <Input
          placeholder="Số khung"
          value={chassis}
          onChange={(e) => setChassis(e.target.value)}
          className="h-8 text-xs"
        />
        <Input
          placeholder="Số máy"
          value={engine}
          onChange={(e) => setEngine(e.target.value)}
          className="h-8 text-xs"
        />
        <MoneyInput
          placeholder="Đơn giá nhập"
          value={price || ''}
          onValueChange={setPrice}
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          disabled={add.isPending}
          onClick={handleAdd}
        >
          <Plus className="size-3.5" />
          Thêm xe
        </Button>
      </div>
    </Section>
  )
}
