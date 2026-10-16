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
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Checkbox } from '#/components/ui/checkbox.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Input } from '#/components/ui/input.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import { Label } from '#/components/ui/label.tsx'
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
import { formatVnd, todayIso, batchLabel } from '#/lib/business.ts'
import {
  availableVehiclesQuery,
  customerOptionsQuery,
  currentUserQuery,
} from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import { createSalesOrderFn } from '#/server/fns/sales.ts'

export const Route = createFileRoute('/sales/new')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'sales.create')
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.query(customerOptionsQuery()),
      queryClient.query(availableVehiclesQuery()),
    ])
  },
  component: NewSalesOrderPage,
})

function NewSalesOrderPage() {
  const { user } = Route.useRouteContext()
  const { data: customers } = useSuspenseQuery(customerOptionsQuery())
  const { data: availableVehicles } = useSuspenseQuery(availableVehiclesQuery())
  const queryClient = useQueryClient()
  const createOrder = useMutation({ mutationFn: createSalesOrderFn })
  const navigate = useNavigate()

  const [orderDate, setOrderDate] = React.useState(todayIso())
  const [customerId, setCustomerId] = React.useState<number>(
    customers[0]?.id ?? 1,
  )
  const [branchId, setBranchId] = React.useState<number | null>(null)

  // Selected vehicles to sell: vehicleId -> custom unitPrice
  const [selectedItems, setSelectedItems] = React.useState<
    {
      vehicleId: number
      unitPrice: number
      chassisNumber: string
      modelName: string
      colorName: string
      costPrice: number
    }[]
  >([])

  // Modal to select vehicles from inventory
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [tempChecked, setTempChecked] = React.useState<Set<number>>(new Set())

  const submitting = createOrder.isPending
  const [error, setError] = React.useState<string | null>(null)

  // Branches list of currently selected customer
  const currentCustomer = customers.find((c) => c.id === customerId)
  const branches = currentCustomer?.branches ?? []

  const openPicker = () => {
    setTempChecked(new Set(selectedItems.map((i) => i.vehicleId)))
    setPickerOpen(true)
  }

  const toggleCheck = (vId: number) => {
    const next = new Set(tempChecked)
    if (next.has(vId)) next.delete(vId)
    else next.add(vId)
    setTempChecked(next)
  }

  const confirmPicker = () => {
    const chosen = availableVehicles
      .filter((v) => tempChecked.has(v.id))
      .map((v) => {
        const existing = selectedItems.find((x) => x.vehicleId === v.id)
        return {
          vehicleId: v.id,
          unitPrice: existing ? existing.unitPrice : v.sellingPrice,
          chassisNumber: v.chassisNumber,
          modelName: v.modelName,
          colorName: v.colorName,
          costPrice: v.costPrice,
        }
      })
    setSelectedItems(chosen)
    setPickerOpen(false)
  }

  const removeItem = (vId: number) => {
    setSelectedItems(selectedItems.filter((i) => i.vehicleId !== vId))
  }

  const totalAmount = selectedItems.reduce(
    (s, i) => s + (Number(i.unitPrice) || 0),
    0,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedItems.length === 0) {
      setError('Vui lòng chọn ít nhất một chiếc xe từ kho để bán')
      return
    }
    setError(null)
    try {
      await createOrder.mutateAsync({
        data: {
          orderDate,
          customerId,
          branchId,
          items: selectedItems.map((i) => ({
            vehicleId: i.vehicleId,
            unitPrice: i.unitPrice,
          })),
        },
      })
      await queryClient.invalidateQueries()
      navigate({ to: '/sales' })
    } catch (err: unknown) {
      setError((err as Error).message || 'Lỗi khi tạo phiếu bán xe')
    }
  }

  return (
    <AppLayout user={user}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/sales">
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
                Lập Phiếu Bán Xe Mới
              </h1>
              <p className="text-xs text-slate-500">
                Doanh thu tính về Khách mẹ &bull; Công nợ ghi theo Pháp nhân
                điểm bán nhận xe
              </p>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs h-9 px-4 gap-1.5"
          >
            <Check className="size-4" />
            {submitting ? 'Đang lưu...' : 'Xác Nhận Lập Phiếu'}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columns 1 & 2: Selected vehicles list */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">
                    Xe Chọn Bán ({selectedItems.length} xe &bull; Tổng:{' '}
                    <span className="text-emerald-800">
                      {formatVnd(totalAmount)}
                    </span>
                    )
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Mỗi xe (theo số khung) chỉ được phép bán đúng một lần
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openPicker}
                  className="h-8 text-xs gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold hover:bg-emerald-100"
                >
                  <Plus className="size-3.5" />
                  Chọn xe từ kho ({availableVehicles.length} xe sẵn sàng)
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {selectedItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                    <p>Chưa có chiếc xe nào được chọn cho đơn hàng này.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openPicker}
                      className="text-xs"
                    >
                      Mở kho xe để chọn
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs bg-slate-50">
                          <TableHead>Số Khung (VIN)</TableHead>
                          <TableHead>Dòng xe / Màu</TableHead>
                          <TableHead className="text-right">Giá Vốn</TableHead>
                          <TableHead className="text-right w-44">
                            Đơn Giá Bán (VNĐ) *
                          </TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {selectedItems.map((item, idx) => (
                          <TableRow key={item.vehicleId}>
                            <TableCell className="font-medium text-slate-900">
                              {item.chassisNumber}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-900">
                                {item.modelName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {item.colorName}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-slate-500 font-medium">
                              {formatVnd(item.costPrice)}
                            </TableCell>
                            <TableCell className="text-right">
                              <MoneyInput
                                value={item.unitPrice}
                                onValueChange={(n) => {
                                  const updated = [...selectedItems]
                                  updated[idx].unitPrice = n
                                  setSelectedItems(updated)
                                }}
                                className="h-7 text-xs text-right"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.vehicleId)}
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
                )}
              </CardContent>
            </Card>
          </div>

          {/* Column 3: Customer & Receiving Branch */}
          <div className="space-y-4">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Thông Tin Khách Hàng & Giao Nhận
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Ngày Lập Phiếu *
                  </Label>
                  <Input
                    type="date"
                    required
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Khách Hàng Mẹ * (Ghi nhận Doanh thu)
                  </Label>
                  <SearchSelect
                    className="h-8 w-full text-xs"
                    value={String(customerId)}
                    onValueChange={(val) => {
                      setCustomerId(Number(val))
                      setBranchId(null) // Reset branch
                    }}
                  >
                    {customers.map((c) => (
                      <SearchSelectItem
                        key={c.id}
                        value={String(c.id)}
                        className="text-xs"
                      >
                        {c.name}
                      </SearchSelectItem>
                    ))}
                  </SearchSelect>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Điểm Bán Trực Thuộc Nhận Xe (Ghi nhận Công Nợ & HĐ)
                  </Label>
                  <SearchSelect
                    className="h-8 w-full text-xs"
                    placeholder="Chọn showroom/chi nhánh"
                    value={branchId ? String(branchId) : 'none'}
                    onValueChange={(val) =>
                      setBranchId(val === 'none' ? null : Number(val))
                    }
                  >
                    <SearchSelectItem value="none" className="text-xs">
                      Trực tiếp Pháp nhân Khách hàng Mẹ
                    </SearchSelectItem>
                    {branches.map((b) => (
                      <SearchSelectItem
                        key={b.id}
                        value={String(b.id)}
                        className="text-xs"
                      >
                        {b.name}
                      </SearchSelectItem>
                    ))}
                  </SearchSelect>
                  <p className="text-[11px] text-slate-500 pt-0.5">
                    Hóa đơn và công nợ phải thu sẽ gắn liền với điểm bán này.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal: Select vehicles from inventory */}
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Chọn Xe Từ Kho Để Bán
              </DialogTitle>
              <DialogDescription className="text-xs">
                Chỉ hiển thị những xe chưa từng được gán vào bất kỳ đơn bán nào
                ({availableVehicles.length} chiếc)
              </DialogDescription>
            </DialogHeader>

            <div className="border border-slate-200 rounded-lg overflow-x-auto my-2">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50">
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Số Khung (VIN)</TableHead>
                    <TableHead>Dòng xe / Màu</TableHead>
                    <TableHead>Lô Nhập</TableHead>
                    <TableHead className="text-right">Giá Bán Lô</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {availableVehicles.map((v) => {
                    const checked = tempChecked.has(v.id)
                    return (
                      <TableRow
                        key={v.id}
                        className={`cursor-pointer ${checked ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}
                        onClick={() => toggleCheck(v.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleCheck(v.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {v.chassisNumber}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">
                            {v.modelName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {v.colorName}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-900">
                          {batchLabel(v)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-900">
                          {formatVnd(v.sellingPrice)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <div className="text-xs font-semibold text-slate-700">
                Đã chọn: <strong>{tempChecked.size} xe</strong>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={confirmPicker}
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  Xác Nhận Thêm ({tempChecked.size} xe)
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </form>
    </AppLayout>
  )
}
