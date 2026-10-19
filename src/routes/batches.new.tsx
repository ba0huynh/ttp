import { Section } from '#/components/batches/BatchEditor.tsx'

import { SupplierSelect } from '#/components/batches/SupplierSelect.tsx'
import { ModelSelect } from '#/components/batches/ModelSelect.tsx'
import { ColorSelect } from '#/components/batches/ColorSelect.tsx'
import { ExpenseTypeSelect } from '#/components/batches/ExpenseTypeSelect.tsx'
import { toast } from 'sonner'
import { cn, handleRowArrowNavigation } from '#/lib/utils.ts'
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
  Copy,
  Plus,
  Trash2,
  X,
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
  isBelowCost,
  modelLabel,
  todayIso,
} from '#/lib/business.ts'
import { currentUserQuery, masterDataQuery } from '#/lib/queries.ts'
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
    await queryClient.query(masterDataQuery())
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
  const queryClient = useQueryClient()
  const createBatch = useMutation({ mutationFn: createBatchFn })
  const navigate = useNavigate()

  // General batch information
  const [supplierId, setSupplierId] = React.useState<number>(0)
  const [importDate, setImportDate] = React.useState(todayIso())

  // Selling price configuration
  const [pricingBase, setPricingBase] = React.useState<
    'cost_price' | 'import_price'
  >('import_price')
  const [pricingMethod, setPricingMethod] = React.useState<
    'percent' | 'fixed_amount'
  >('percent')
  const [pricingValue, setPricingValue] = React.useState<number>(0)

  // Items already added
  const [vehicles, setVehicles] = React.useState<VehicleRow[]>([])
  const [expenses, setExpenses] = React.useState<ExpenseRow[]>([])

  // Expense inline row editing (id of expense being edited, or 'new' when adding)
  const [editingExpenseId, setEditingExpenseId] = React.useState<
    number | 'new' | null
  >(null)
  const [eDraft, setEDraft] = React.useState<{
    expenseTypeId: number
    description: string
    amount: number
  }>({
    expenseTypeId: 0,
    description: '',
    amount: 0,
  })

  const [eSubmitted, setESubmitted] = React.useState(false)

  const startAddExpense = () => {
    setEDraft({
      expenseTypeId: master.expenseTypes[0]?.id ?? 0,
      description: '',
      amount: 0,
    })
    setESubmitted(false)
    setEditingExpenseId('new')
  }

  const startEditExpense = (e: ExpenseRow) => {
    setEDraft({
      expenseTypeId: e.expenseTypeId,
      description: e.description,
      amount: e.amount,
    })
    setESubmitted(false)
    setEditingExpenseId(e.id)
  }

  const cancelExpenseEdit = () => {
    setEditingExpenseId(null)
    setESubmitted(false)
  }

  const saveExpenseInline = () => {
    setESubmitted(true)
    if (!eDraft.expenseTypeId || eDraft.amount <= 0) {
      toast.error('Vui lòng chọn loại chi phí và nhập số tiền (viền đỏ)')
      return
    }

    if (editingExpenseId === 'new') {
      const nextId = Math.max(0, ...expenses.map((x) => x.id)) + 1
      setExpenses([
        ...expenses,
        {
          id: nextId,
          expenseTypeId: eDraft.expenseTypeId,
          description: eDraft.description.trim(),
          amount: eDraft.amount,
        },
      ])
      toast.success('Đã thêm khoản chi phí')
    } else if (editingExpenseId !== null) {
      setExpenses(
        expenses.map((x) =>
          x.id === editingExpenseId
            ? {
                ...x,
                expenseTypeId: eDraft.expenseTypeId,
                description: eDraft.description.trim(),
                amount: eDraft.amount,
              }
            : x,
        ),
      )
      toast.success('Đã cập nhật chi phí')
    }
    setEditingExpenseId(null)
    setESubmitted(false)
  }

  const handleExpenseRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
    const currentTarget = e.currentTarget
    setTimeout(() => {
      const active = document.activeElement
      if (currentTarget && currentTarget.contains(active)) return
      if (
        active?.closest(
          '[data-radix-popper-content-wrapper], [role="dialog"], [data-radix-focus-guard]',
        )
      )
        return
      if (
        editingExpenseId === 'new' &&
        !eDraft.expenseTypeId &&
        eDraft.amount <= 0 &&
        !eDraft.description
      ) {
        setEditingExpenseId(null)
        setESubmitted(false)
        return
      }
      saveExpenseInline()
    }, 120)
  }

  const handleExpenseKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const active = document.activeElement
      if (active?.closest('[data-radix-popper-content-wrapper], [role="dialog"]')) return
      e.preventDefault()
      saveExpenseInline()
      return
    }
    if (e.key === 'Escape') {
      const active = document.activeElement
      if (active?.closest('[data-radix-popper-content-wrapper], [role="dialog"]')) return
      e.preventDefault()
      cancelExpenseEdit()
      return
    }
    handleRowArrowNavigation(e)
  }

  // Vehicle inline row editing (id of vehicle being edited, or 'new' when adding)
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

  const startAddVehicle = () => {
    setVDraft({
      modelId: master.models[0]?.id ?? 0,
      colorId: master.colors[0]?.id ?? 0,
      chassisNumber: '',
      engineNumber: '',
      importPrice: 0,
    })
    setVSubmitted(false)
    setEditingVehicleId('new')
  }

  const duplicateVehicle = (v: VehicleRow) => {
    setVDraft({
      modelId: v.modelId,
      colorId: v.colorId,
      chassisNumber: '',
      engineNumber: '',
      importPrice: v.importPrice,
    })
    setVSubmitted(false)
    setEditingVehicleId('new')
  }

  const startEditVehicle = (v: VehicleRow) => {
    setVDraft({
      modelId: v.modelId,
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

  const saveVehicleInline = () => {
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
    const dup = vehicles.some(
      (x) =>
        x.id !== editingVehicleId &&
        x.chassisNumber.trim().toLowerCase() === chassis.toLowerCase(),
    )
    if (dup) {
      toast.error('Số khung này đã có trong lô')
      return
    }

    if (editingVehicleId === 'new') {
      const nextId = Math.max(0, ...vehicles.map((x) => x.id)) + 1
      setVehicles([
        ...vehicles,
        {
          id: nextId,
          modelId: vDraft.modelId,
          colorId: vDraft.colorId,
          chassisNumber: chassis,
          engineNumber: engine,
          importPrice: vDraft.importPrice,
        },
      ])
      toast.success('Đã thêm xe vào lô')
    } else if (editingVehicleId !== null) {
      setVehicles(
        vehicles.map((x) =>
          x.id === editingVehicleId
            ? {
                ...x,
                modelId: vDraft.modelId,
                colorId: vDraft.colorId,
                chassisNumber: chassis,
                engineNumber: engine,
                importPrice: vDraft.importPrice,
              }
            : x,
        ),
      )
      toast.success('Đã cập nhật thông tin xe')
    }
    setEditingVehicleId(null)
    setVSubmitted(false)
  }

  const handleVehicleRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
    const currentTarget = e.currentTarget
    setTimeout(() => {
      const active = document.activeElement
      if (currentTarget && currentTarget.contains(active)) return
      if (
        active?.closest(
          '[data-radix-popper-content-wrapper], [role="dialog"], [data-radix-focus-guard]',
        )
      )
        return
      if (
        editingVehicleId === 'new' &&
        !vDraft.chassisNumber.trim() &&
        !vDraft.engineNumber.trim() &&
        vDraft.importPrice <= 0
      ) {
        setEditingVehicleId(null)
        setVSubmitted(false)
        return
      }
      saveVehicleInline()
    }, 120)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const active = document.activeElement
      if (active?.closest('[data-radix-popper-content-wrapper], [role="dialog"]')) return
      e.preventDefault()
      saveVehicleInline()
      return
    }
    if (e.key === 'Escape') {
      const active = document.activeElement
      if (active?.closest('[data-radix-popper-content-wrapper], [role="dialog"]')) return
      e.preventDefault()
      cancelVehicleEdit()
      return
    }
    handleRowArrowNavigation(e)
  }

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

  const hasLossWarning = previewVehicles.some((v) =>
    isBelowCost(v.sellingPrice, v.costPrice),
  )





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

        {/* GLOBAL BELOW-COST WARNING ALERT */}
        {hasLossWarning && (
          <Alert
            variant="destructive"
            className="bg-rose-50 border-rose-300 text-rose-900"
          >
            <AlertCircle className="size-5 text-rose-600" />
            <AlertDescription className="text-xs font-semibold">
              CẢNH BÁO BÁN LỖ: Có xe trong lô đang có Giá bán thấp hơn Giá vốn
              sau khi cộng chi phí! Hãy xem xét lại gốc tính giá, mức % hoặc số
              tiền cộng thêm trong phần cấu hình giá bán.
            </AlertDescription>
          </Alert>
        )}

        {/* 1. Batch information */}
        <Section title="Thông Tin Lô">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        </Section>

        {/* 2. Pricing */}
        <Section title="Cài Giá Bán Theo Lô">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Gốc tính giá</Label>
              <Select
                value={pricingBase}
                onValueChange={(val) =>
                  setPricingBase(val as 'cost_price' | 'import_price')
                }
              >
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
              onClick={startAddExpense}
              disabled={editingExpenseId !== null}
            >
              <Plus className="size-3.5" />
              Thêm chi phí
            </Button>
          }
        >
          {expenses.length === 0 && editingExpenseId === null ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center bg-white">
              <p className="text-sm text-slate-500">
                Chưa có khoản chi phí nào cho lô này
              </p>
              <Button
                type="button"
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
                  {expenses.map((e) => {
                    const isEditing = editingExpenseId === e.id
                    if (isEditing) {
                      return (
                        <TableRow
                          key={e.id}
                          className="bg-emerald-50/40 border-y border-emerald-200"
                          onBlur={handleExpenseRowBlur}
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
                                onClick={saveExpenseInline}
                                title="Lưu (Enter)"
                              >
                                <Check className="size-4" />
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
                          {expenseTypeName(e.expenseTypeId)}
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
                              onClick={() =>
                                setExpenses(expenses.filter((x) => x.id !== e.id))
                              }
                              disabled={editingExpenseId !== null}
                              aria-label="Xóa chi phí"
                              title="Xóa chi phí"
                            >
                              <Trash2 className="size-3.5" />
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
                      onBlur={handleExpenseRowBlur}
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
                            onClick={saveExpenseInline}
                            title="Lưu (Enter)"
                          >
                            <Check className="size-4" />
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

        {/* 4. Vehicles */}
        <Section
          title={`Danh Sách Xe Trong Lô & Phân Bổ Giá Vốn (${vehicles.length} chiếc — Tiền hàng ${formatVnd(totalImport)})`}
          aside={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 rounded-lg bg-white text-sm"
              onClick={startAddVehicle}
              disabled={editingVehicleId !== null}
            >
              <Plus className="size-3.5" />
              Thêm xe
            </Button>
          }
        >
          {vehicles.length === 0 && editingVehicleId === null ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center bg-white">
              <p className="text-sm text-slate-500">
                Chưa có xe nào trong danh sách lô
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 h-8 gap-1.5 text-xs text-emerald-700 hover:text-emerald-800"
                onClick={startAddVehicle}
              >
                <Plus className="size-3.5" />
                Thêm xe vào lô
              </Button>
            </div>
          ) : (
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
                    <TableHead className="text-right w-[130px]">
                      CP Phân Bổ
                    </TableHead>
                    <TableHead className="text-right w-[140px]">
                      Giá Vốn Xe
                    </TableHead>
                    <TableHead className="text-right w-[140px]">
                      Giá Bán Áp Dụng
                    </TableHead>
                    <TableHead className="w-[90px] text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {previewVehicles.map((v) => {
                    const isEditing = editingVehicleId === v.id
                    if (isEditing) {
                      return (
                        <TableRow
                          key={v.id}
                          className="bg-emerald-50/40 border-y border-emerald-200"
                          onBlur={handleVehicleRowBlur}
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
                                  setVDraft({
                                    ...vDraft,
                                    modelId: val,
                                  })
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
                                  setVDraft({
                                    ...vDraft,
                                    colorId: val,
                                  })
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
                                className="size-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={saveVehicleInline}
                                title="Lưu (Enter)"
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
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

                    const model = modelOf(v.modelId)
                    return (
                      <TableRow
                        key={v.id}
                        className={cn(
                          'cursor-pointer hover:bg-emerald-50/40 transition-colors group',
                          isBelowCost(v.sellingPrice, v.costPrice) &&
                            'bg-rose-50',
                        )}
                        onClick={() => {
                          if (editingVehicleId !== v.id) startEditVehicle(v)
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
                            {model ? modelLabel(model) : ''}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {colorOf(v.colorId)?.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
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
                          className="text-right whitespace-nowrap"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-slate-400 hover:text-emerald-700"
                              onClick={() => duplicateVehicle(v)}
                              disabled={editingVehicleId !== null}
                              aria-label="Nhân bản xe"
                              title="Nhân bản xe"
                            >
                              <Copy className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-slate-400 hover:text-rose-600"
                              onClick={() =>
                                setVehicles(
                                  vehicles.filter((x) => x.id !== v.id),
                                )
                              }
                              disabled={editingVehicleId !== null}
                              aria-label="Xóa xe"
                              title="Xóa xe"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {/* New row when adding a vehicle */}
                  {editingVehicleId === 'new' && (
                    <TableRow
                      className="bg-emerald-50/40 border-y border-emerald-200"
                      onBlur={handleVehicleRowBlur}
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
                            className="size-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={saveVehicleInline}
                            title="Lưu (Enter)"
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
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
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      </div>

    </AppLayout>
  )
}
