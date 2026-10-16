import { Section } from '#/components/batches/BatchEditor.tsx'
import { ExpenseFormDialog } from '#/components/batches/ExpenseFormDialog.tsx'
import type { ExpenseFormValues } from '#/components/batches/ExpenseFormDialog.tsx'
import { VehicleFormDialog } from '#/components/batches/VehicleFormDialog.tsx'
import type { VehicleFormValues } from '#/components/batches/VehicleFormDialog.tsx'
import { formatErrorMessage } from '#/components/ui/confirm-dialog.tsx'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import * as React from 'react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import { Button } from '#/components/ui/button.tsx'
import { DecimalInput } from '#/components/ui/decimal-input.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import {
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
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
import {
  allocateBatchExpenses,
  computeSellingPrice,
  formatVnd,
  modelLabel,
  todayIso,
} from '#/lib/business.ts'
import { currentUserQuery, loansQuery, masterDataQuery } from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import { createBatchFn } from '#/server/fns/batches.ts'

export const Route = createFileRoute('/batches/new')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'batches.manage')
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.query(masterDataQuery()),
      queryClient.query(loansQuery()),
    ])
  },
  component: NewBatchPage,
})

interface VehicleRow {
  id: number
  modelId: number
  colorId: number
  chassisNumber: string
  engineNumber: string
  importPrice: number
}

interface ExpenseRow {
  id: number
  expenseTypeId: number
  description: string
  amount: number
}

/**
 * Same layout as the batch editor (`BatchEditor`): stacked sections, the items
 * already added on top and a one-line "add" row under them. Nothing is sent
 * until "Hoàn Tất Nhập Lô".
 */
function NewBatchPage() {
  const { user } = Route.useRouteContext()
  const { data: master } = useSuspenseQuery(masterDataQuery())
  const { data: loans } = useSuspenseQuery(loansQuery())
  const queryClient = useQueryClient()
  const createBatch = useMutation({ mutationFn: createBatchFn })
  const navigate = useNavigate()

  // General batch information
  const [supplierId, setSupplierId] = React.useState<number>(0)
  const [loanContractId, setLoanContractId] = React.useState<number | null>(
    null,
  )
  const [importDate, setImportDate] = React.useState(todayIso())

  // Selling price configuration
  // The selling price always starts from the import price (no batch expenses)
  const pricingBase = 'import_price' as const
  const [pricingMethod, setPricingMethod] = React.useState<
    'percent' | 'fixed_amount'
  >('percent')
  const [pricingValue, setPricingValue] = React.useState<number>(0)

  // Items already added
  const [vehicles, setVehicles] = React.useState<VehicleRow[]>([])
  const [expenses, setExpenses] = React.useState<ExpenseRow[]>([])

  // "Add" rows (drafts)
  const [expenseOpen, setExpenseOpen] = React.useState(false)
  const [editExpenseId, setEditExpenseId] = React.useState<number | null>(null)
  // Vehicle popup: id of the row being edited (null = adding)
  const [vehicleOpen, setVehicleOpen] = React.useState(false)
  const [editVehicleId, setEditVehicleId] = React.useState<number | null>(null)

  const submitting = createBatch.isPending
  const [error, setError] = React.useState<string | null>(null)

  // REAL-TIME COST & SELLING PRICE ALLOCATION (LIVE PREVIEW)
  const totalExpense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const totalImport = vehicles.reduce(
    (s, v) => s + (Number(v.importPrice) || 0),
    0,
  )
  const allocated = allocateBatchExpenses(
    vehicles.map((v) => ({
      id: v.id,
      importPrice: Number(v.importPrice) || 0,
    })),
    totalExpense,
  )
  const previewVehicles = vehicles.map((v, i) => {
    const alloc = allocated[i] || {
      allocatedExpense: 0,
      costPrice: v.importPrice,
    }
    const selling = computeSellingPrice(
      { importPrice: v.importPrice, costPrice: alloc.costPrice },
      { pricingBase, pricingMethod, pricingValue },
    )
    return {
      ...v,
      allocatedExpense: alloc.allocatedExpense,
      costPrice: alloc.costPrice,
      sellingPrice: selling,
    }
  })

  // Add or update an expense of the list (kept here until the batch is saved)
  const saveExpense = (v: ExpenseFormValues) => {
    if (editExpenseId) {
      setExpenses(
        expenses.map((x) => (x.id === editExpenseId ? { ...x, ...v } : x)),
      )
    } else {
      const nextId = Math.max(0, ...expenses.map((x) => x.id)) + 1
      setExpenses([...expenses, { id: nextId, ...v }])
    }
  }

  // Add or update a vehicle of the list (kept here until the batch is saved)
  const saveVehicle = (v: VehicleFormValues) => {
    const dup = vehicles.some(
      (x) =>
        x.id !== editVehicleId &&
        x.chassisNumber.toLowerCase() === v.chassisNumber.toLowerCase(),
    )
    if (dup) throw new Error('Số khung này đã có trong lô')
    if (editVehicleId) {
      setVehicles(
        vehicles.map((x) => (x.id === editVehicleId ? { ...x, ...v } : x)),
      )
    } else {
      const nextId = Math.max(0, ...vehicles.map((x) => x.id)) + 1
      setVehicles([...vehicles, { id: nextId, ...v }])
    }
  }

  const handleSubmit = async () => {
    setError(null)
    if (vehicles.length === 0) {
      setError('Vui lòng thêm ít nhất 1 xe vào lô')
      return
    }

    try {
      await createBatch.mutateAsync({
        data: {
          supplierId,
          loanContractId,
          importDate,
          pricingBase,
          pricingMethod,
          pricingValue,
          vehicles: vehicles.map((v) => ({
            modelId: v.modelId,
            colorId: v.colorId,
            chassisNumber: v.chassisNumber,
            engineNumber: v.engineNumber,
            importPrice: v.importPrice,
          })),
          expenses: expenses.map((e) => ({
            expenseTypeId: e.expenseTypeId,
            description: e.description,
            amount: e.amount,
          })),
        },
      })
      await queryClient.invalidateQueries()
      navigate({ to: '/batches' })
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Có lỗi xảy ra khi tạo lô xe'))
    }
  }

  const modelOf = (id: number) => master.models.find((m) => m.id === id)
  const colorOf = (id: number) => master.colors.find((c) => c.id === id)
  const expenseTypeName = (id: number) =>
    master.expenseTypes.find((t) => t.id === id)?.name ?? ''

  return (
    <AppLayout user={user}>
      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/batches">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
              >
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Nhập Lô Xe Mới & Thiết Lập Giá Vốn
              </h1>
              <p className="text-xs text-slate-500">
                Nhập danh sách xe & các khoản chi phí để hệ thống tự động phân
                bổ giá vốn
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs h-9 px-4 gap-1.5"
          >
            <Check className="size-4" />
            {submitting ? 'Đang lưu...' : 'Hoàn Tất Nhập Lô'}
          </Button>
        </div>

        {error && (
          <Alert
            variant="destructive"
            className="bg-rose-50 text-rose-900 border-rose-200 text-xs"
          >
            <AlertCircle className="size-4 text-rose-600" />
            <AlertDescription className="whitespace-pre-line">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* 1. Batch information */}
        <Section title="Thông Tin Lô">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Nhà cung cấp</Label>
              <SearchSelect
                className="h-11 w-full text-sm bg-white rounded-lg"
                placeholder="Chọn nhà cung cấp"
                value={supplierId ? String(supplierId) : ''}
                onValueChange={(val) => setSupplierId(Number(val))}
              >
                {master.suppliers.map((s) => (
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
                value={loanContractId ? String(loanContractId) : 'none'}
                onValueChange={(val) =>
                  setLoanContractId(val === 'none' ? null : Number(val))
                }
              >
                <SearchSelectItem value="none">
                  Vốn tự có (Không vay ngân hàng)
                </SearchSelectItem>
                {loans
                  .filter((l) => l.status === 'active')
                  .map((l) => (
                    <SearchSelectItem key={l.id} value={String(l.id)}>
                      {l.contractNumber} ({l.bankName}) &bull; Dư nợ:{' '}
                      {formatVnd(l.outstanding)}
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
        </Section>

        {/* 2. Pricing */}
        <Section title="Cài Giá Bán Theo Lô">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Cách cộng thêm</Label>
              <Select
                value={pricingMethod}
                onValueChange={(val) =>
                  setPricingMethod(val as 'percent' | 'fixed_amount')
                }
              >
                <SelectTrigger className="h-11 w-full text-sm bg-white rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Cộng % lợi nhuận</SelectItem>
                  <SelectItem value="fixed_amount">
                    Cộng số tiền cố định
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">
                {pricingMethod === 'percent' ? 'Tỷ lệ (%)' : 'Số tiền (VNĐ)'}
              </Label>
              {pricingMethod === 'percent' ? (
                <DecimalInput
                  maxDecimals={2}
                  blankZero
                  placeholder="0"
                  value={pricingValue}
                  onValueChange={setPricingValue}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              ) : (
                <MoneyInput
                  blankZero
                  placeholder="0"
                  value={pricingValue}
                  onValueChange={setPricingValue}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              )}
            </div>
          </div>
        </Section>

        {/* 3. Expenses */}
        <Section
          title={`Chi Phí Lô (${expenses.length} khoản — ${formatVnd(totalExpense)})`}
          aside={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 rounded-lg bg-white text-sm"
              onClick={() => {
                setEditExpenseId(null)
                setExpenseOpen(true)
              }}
            >
              <Plus className="size-3.5" />
              Thêm chi phí
            </Button>
          }
        >
          {expenses.length > 0 && (
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
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium text-slate-900">
                        {expenseTypeName(e.expenseTypeId)}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {e.description}
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900">
                        {formatVnd(e.amount)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-emerald-700"
                          onClick={() => {
                            setEditExpenseId(e.id)
                            setExpenseOpen(true)
                          }}
                          aria-label="Sửa chi phí"
                          title="Sửa chi phí"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                          onClick={() =>
                            setExpenses(expenses.filter((x) => x.id !== e.id))
                          }
                          aria-label="Xóa chi phí"
                          title="Xóa chi phí"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>

        {/* 4. Vehicles */}
        <Section
          title={`Danh Sách Xe Trong Lô & Phân Bổ Giá Vốn (${vehicles.length} chiếc — Tiền hàng ${formatVnd(totalImport)})`}
          aside={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 rounded-lg bg-white text-sm"
              onClick={() => {
                setEditVehicleId(null)
                setVehicleOpen(true)
              }}
            >
              <Plus className="size-3.5" />
              Thêm xe
            </Button>
          }
        >
          {vehicles.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50">
                    <TableHead>Số Khung (VIN)</TableHead>
                    <TableHead>Số Máy</TableHead>
                    <TableHead>Dòng xe / Màu</TableHead>
                    <TableHead className="text-right">Đơn Giá Nhập</TableHead>
                    <TableHead className="text-right">
                      Giá Bán Áp Dụng
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {previewVehicles.map((v) => {
                    const model = modelOf(v.modelId)
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
                            {model ? modelLabel(model) : ''}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {colorOf(v.colorId)?.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatVnd(v.importPrice)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-800">
                          {formatVnd(v.sellingPrice)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-emerald-700"
                            onClick={() => {
                              setEditVehicleId(v.id)
                              setVehicleOpen(true)
                            }}
                            aria-label="Sửa xe"
                            title="Sửa xe"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                            onClick={() =>
                              setVehicles(vehicles.filter((x) => x.id !== v.id))
                            }
                            aria-label="Xóa xe"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      </div>
      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        title={editExpenseId ? 'Sửa Chi Phí' : 'Thêm Chi Phí Của Lô'}
        submitLabel={editExpenseId ? 'Lưu' : 'Thêm Chi Phí'}
        initial={
          editExpenseId
            ? (expenses.find((x) => x.id === editExpenseId) ?? null)
            : null
        }
        onSubmit={saveExpense}
      />
      <VehicleFormDialog
        open={vehicleOpen}
        onOpenChange={setVehicleOpen}
        title={editVehicleId ? 'Sửa Xe' : 'Thêm Xe Vào Lô'}
        submitLabel={editVehicleId ? 'Lưu' : 'Thêm Xe'}
        initial={
          editVehicleId
            ? (vehicles.find((x) => x.id === editVehicleId) ?? null)
            : null
        }
        onSubmit={saveVehicle}
      />
    </AppLayout>
  )
}
