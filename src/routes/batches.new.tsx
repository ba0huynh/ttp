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
import { AlertCircle, ArrowLeft, Check, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { CostWarningAlert } from '#/components/pricing/CostWarningAlert.tsx'
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
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
  EXPENSE_TYPE_LABELS,
  formatVnd,
  todayIso,
} from '#/lib/business.ts'
import { createBatchFn } from '#/server/fns/batches.ts'
import { loansQuery, masterDataQuery, currentUserQuery } from '#/lib/queries.ts'

export const Route = createFileRoute('/batches/new')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
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

function NewBatchPage() {
  const { user } = Route.useRouteContext()
  const { data: master } = useSuspenseQuery(masterDataQuery())
  const { data: loans } = useSuspenseQuery(loansQuery())
  const queryClient = useQueryClient()
  const createBatch = useMutation({ mutationFn: createBatchFn })
  const navigate = useNavigate()

  // General batch information
  const [batchCode, setBatchCode] = React.useState(
    `LO-${todayIso().replace(/-/g, '')}`,
  )
  const [supplierId, setSupplierId] = React.useState<number>(
    master.suppliers[0]?.id ?? 1,
  )
  const [loanContractId, setLoanContractId] = React.useState<number | null>(
    null,
  )
  const [importDate, setImportDate] = React.useState(todayIso())
  const [customsDeclarationNo, setCustomsDeclarationNo] = React.useState('')
  const [note, setNote] = React.useState('')

  // Selling price configuration
  const [pricingBase, setPricingBase] = React.useState<
    'cost_price' | 'import_price'
  >('cost_price')
  const [pricingMethod, setPricingMethod] = React.useState<
    'percent' | 'fixed_amount'
  >('percent')
  const [pricingValue, setPricingValue] = React.useState<number>(8)

  // Imported vehicles list
  const [vehicles, setVehicles] = React.useState<
    {
      id: number
      modelId: number
      colorId: number
      chassisNumber: string
      engineNumber: string
      importPrice: number
    }[]
  >([
    {
      id: 1,
      modelId: master.models[0]?.id ?? 1,
      colorId: master.colors[0]?.id ?? 1,
      chassisNumber: 'VIN-TEST-001',
      engineNumber: 'ENG-TEST-001',
      importPrice: 80_000_000,
    },
    {
      id: 2,
      modelId: master.models[0]?.id ?? 1,
      colorId: master.colors[1]?.id ?? 2,
      chassisNumber: 'VIN-TEST-002',
      engineNumber: 'ENG-TEST-002',
      importPrice: 80_000_000,
    },
  ])

  // Batch expenses
  const [expenses, setExpenses] = React.useState<
    {
      id: number
      expenseType: any
      description: string
      amount: number
    }[]
  >([
    {
      id: 1,
      expenseType: 'import_tax',
      description: 'Thuế nhập khẩu và tiêu thụ đặc biệt',
      amount: 15_000_000,
    },
    {
      id: 2,
      expenseType: 'shipping_international',
      description: 'Vận chuyển quốc tế',
      amount: 5_000_000,
    },
  ])

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

  // Below-cost loss warning check
  const hasLossWarning = previewVehicles.some(
    (v) => v.sellingPrice < v.costPrice,
  )

  const handleAddVehicle = () => {
    const nextId = Math.max(0, ...vehicles.map((v) => v.id)) + 1
    setVehicles([
      ...vehicles,
      {
        id: nextId,
        modelId: master.models[0]?.id ?? 1,
        colorId: master.colors[0]?.id ?? 1,
        chassisNumber: `VIN-AUTO-${nextId}`,
        engineNumber: `ENG-AUTO-${nextId}`,
        importPrice: 50_000_000,
      },
    ])
  }

  const handleRemoveVehicle = (id: number) => {
    if (vehicles.length <= 1) return
    setVehicles(vehicles.filter((v) => v.id !== id))
  }

  const handleAddExpense = () => {
    const nextId = Math.max(0, ...expenses.map((e) => e.id)) + 1
    setExpenses([
      ...expenses,
      {
        id: nextId,
        expenseType: 'customs_fee',
        description: 'Chi phí hải quan & kiểm định',
        amount: 3_000_000,
      },
    ])
  }

  const handleRemoveExpense = (id: number) => {
    setExpenses(expenses.filter((e) => e.id !== id))
  }

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault()
    setError(null)

    try {
      await createBatch.mutateAsync({
        data: {
          batchCode,
          supplierId,
          loanContractId,
          importDate,
          customsDeclarationNo,
          pricingBase,
          pricingMethod,
          pricingValue,
          note,
          vehicles: vehicles.map((v) => ({
            modelId: v.modelId,
            colorId: v.colorId,
            chassisNumber: v.chassisNumber,
            engineNumber: v.engineNumber,
            importPrice: v.importPrice,
          })),
          expenses: expenses.map((e) => ({
            expenseType: e.expenseType,
            description: e.description,
            amount: e.amount,
          })),
        },
      })
      await queryClient.invalidateQueries()
      navigate({ to: '/batches' })
    } catch (err: unknown) {
      setError((err as Error).message || 'Có lỗi xảy ra khi tạo lô xe')
    }
  }

  return (
    <AppLayout user={user}>
      <form onSubmit={handleSubmit} className="space-y-6">
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
            type="submit"
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
            <AlertDescription>{error}</AlertDescription>
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
              sau khi cộng chi phí! Hãy xem xét lại mức % hoặc số tiền cộng thêm
              trong phần cấu hình giá bán.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columns 1 & 2: Batch Info, Vehicles List, Batch Expenses */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. General batch information */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  1. Thông Tin Lô Xe & Nguồn Vốn
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mã Lô Nhập *</Label>
                  <Input
                    required
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Ngày Nhập Cảng/Kho *
                  </Label>
                  <Input
                    type="date"
                    required
                    value={importDate}
                    onChange={(e) => setImportDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Nhà Cung Cấp *
                  </Label>
                  <Select
                    value={String(supplierId)}
                    onValueChange={(val) => setSupplierId(Number(val))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Chọn nhà cung cấp" />
                    </SelectTrigger>
                    <SelectContent>
                      {master.suppliers.map((s) => (
                        <SelectItem
                          key={s.id}
                          value={String(s.id)}
                          className="text-xs"
                        >
                          {s.name} ({s.country})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Khế Ước Vay Ngân Hàng (Tài trợ lô)
                  </Label>
                  <Select
                    value={loanContractId ? String(loanContractId) : 'none'}
                    onValueChange={(val) =>
                      setLoanContractId(val === 'none' ? null : Number(val))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Chọn khế ước vay (nếu có)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">
                        Vốn tự có (Không vay ngân hàng)
                      </SelectItem>
                      {loans
                        .filter((l) => l.status === 'active')
                        .map((l) => (
                          <SelectItem
                            key={l.id}
                            value={String(l.id)}
                            className="text-xs"
                          >
                            {l.contractNumber} ({l.bankShortName}) &bull; Dư nợ:{' '}
                            {formatVnd(l.outstanding)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Số Tờ Khai Hải Quan
                  </Label>
                  <Input
                    placeholder="Ví dụ: HQ-1002938475"
                    value={customsDeclarationNo}
                    onChange={(e) => setCustomsDeclarationNo(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Ghi Chú Lô</Label>
                  <Input
                    placeholder="Ghi chú nội bộ lô xe..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 2. Batch expenses */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">
                    2. Các Khoản Chi Phí Của Lô (Tổng: {formatVnd(totalExpense)}
                    )
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Thuế nhập khẩu, phí vận chuyển quốc tế & nội địa, kiểm định,
                    bến bãi...
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddExpense}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="size-3.5" />
                  Thêm chi phí
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Loại Chi Phí</TableHead>
                      <TableHead>Mô Tả Chi Tiết</TableHead>
                      <TableHead className="text-right w-40">
                        Số Tiền (VNĐ)
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {expenses.map((e, idx) => (
                      <TableRow key={e.id}>
                        <TableCell className="w-48">
                          <Select
                            value={e.expenseType}
                            onValueChange={(val) => {
                              const updated = [...expenses]
                              updated[idx].expenseType = val
                              setExpenses(updated)
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(EXPENSE_TYPE_LABELS).map(
                                ([k, label]) => (
                                  <SelectItem
                                    key={k}
                                    value={k}
                                    className="text-xs"
                                  >
                                    {label}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Mô tả khoản chi..."
                            value={e.description}
                            onChange={(ev) => {
                              const updated = [...expenses]
                              updated[idx].description = ev.target.value
                              setExpenses(updated)
                            }}
                            className="h-7 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="100000"
                            value={e.amount}
                            onChange={(ev) => {
                              const updated = [...expenses]
                              updated[idx].amount = Number(ev.target.value) || 0
                              setExpenses(updated)
                            }}
                            className="h-7 text-xs text-right font-medium"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveExpense(e.id)}
                            className="size-7 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 3. Batch vehicles list */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">
                    3. Danh Sách Chiếc Xe Trong Lô ({vehicles.length} xe &bull;
                    Tiền hàng: {formatVnd(totalImport)})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Nhập số khung (VIN) và đơn giá mua nguyên chiếc từ nhà cung
                    cấp
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddVehicle}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="size-3.5" />
                  Thêm xe
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs bg-slate-50">
                        <TableHead className="w-36">Số Khung (VIN) *</TableHead>
                        <TableHead className="w-32">Số Máy *</TableHead>
                        <TableHead>Dòng xe</TableHead>
                        <TableHead className="w-28">Màu xe</TableHead>
                        <TableHead className="text-right w-36">
                          Đơn Giá Nhập
                        </TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {vehicles.map((v, idx) => (
                        <TableRow key={v.id}>
                          <TableCell>
                            <Input
                              required
                              value={v.chassisNumber}
                              onChange={(ev) => {
                                const updated = [...vehicles]
                                updated[idx].chassisNumber = ev.target.value
                                setVehicles(updated)
                              }}
                              className="h-7 text-xs font-mono font-bold"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              required
                              value={v.engineNumber}
                              onChange={(ev) => {
                                const updated = [...vehicles]
                                updated[idx].engineNumber = ev.target.value
                                setVehicles(updated)
                              }}
                              className="h-7 text-xs font-mono"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={String(v.modelId)}
                              onValueChange={(val) => {
                                const updated = [...vehicles]
                                updated[idx].modelId = Number(val)
                                setVehicles(updated)
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {master.models.map((m) => (
                                  <SelectItem
                                    key={m.id}
                                    value={String(m.id)}
                                    className="text-xs"
                                  >
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={String(v.colorId)}
                              onValueChange={(val) => {
                                const updated = [...vehicles]
                                updated[idx].colorId = Number(val)
                                setVehicles(updated)
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {master.colors.map((c) => (
                                  <SelectItem
                                    key={c.id}
                                    value={String(c.id)}
                                    className="text-xs"
                                  >
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="1"
                              step="500000"
                              value={v.importPrice}
                              onChange={(ev) => {
                                const updated = [...vehicles]
                                updated[idx].importPrice =
                                  Number(ev.target.value) || 0
                                setVehicles(updated)
                              }}
                              className="h-7 text-xs text-right font-medium"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={vehicles.length <= 1}
                              onClick={() => handleRemoveVehicle(v.id)}
                              className="size-7 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Column 3: Batch pricing configuration & Cost Price Live Preview */}
          <div className="space-y-6">
            {/* Batch pricing configuration */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Cài Đặt Giá Bán Theo Lô
                </CardTitle>
                <CardDescription className="text-xs">
                  Áp dụng công thức chung cho toàn bộ xe trong lô
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Gốc Tính Giá Bán
                  </Label>
                  <Select
                    value={pricingBase}
                    onValueChange={(val: any) => setPricingBase(val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cost_price" className="text-xs">
                        🛡️ Dựa trên GIÁ VỐN (Khuyên dùng)
                      </SelectItem>
                      <SelectItem value="import_price" className="text-xs">
                        ⚠️ Dựa trên ĐƠN GIÁ NHẬP
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Phương Thức Định Giá
                  </Label>
                  <Select
                    value={pricingMethod}
                    onValueChange={(val: any) => setPricingMethod(val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent" className="text-xs">
                        Theo tỉ lệ % cộng thêm
                      </SelectItem>
                      <SelectItem value="fixed_amount" className="text-xs">
                        Theo số tiền VNĐ cố định
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    {pricingMethod === 'percent'
                      ? 'Tỉ Lệ Lợi Nhuận (%)'
                      : 'Số Tiền Cộng Thêm (VNĐ)'}
                  </Label>
                  <Input
                    type="number"
                    step={pricingMethod === 'percent' ? '0.5' : '500000'}
                    value={pricingValue}
                    onChange={(e) =>
                      setPricingValue(Number(e.target.value) || 0)
                    }
                    className="h-8 text-xs font-bold"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Cost price & Below-cost warning live preview table */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Xem Trước Giá Vốn & Giá Bán Lô
                </CardTitle>
                <CardDescription className="text-xs">
                  Phân bổ chi phí theo tỉ trọng giá trị xe
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {previewVehicles.map((v) => (
                    <div
                      key={v.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="font-mono text-slate-900">
                          {v.chassisNumber}
                        </span>
                        <span className="text-emerald-800 font-bold">
                          Bán: {formatVnd(v.sellingPrice)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Nhập: {formatVnd(v.importPrice)}</span>
                        <span>CP bổ: +{formatVnd(v.allocatedExpense)}</span>
                      </div>

                      <CostWarningAlert
                        sellingPrice={v.sellingPrice}
                        costPrice={v.costPrice}
                        importPrice={v.importPrice}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </AppLayout>
  )
}
