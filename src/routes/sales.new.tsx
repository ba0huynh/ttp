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
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
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
import { ColorLabel } from '#/components/ui/color-label.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Input } from '#/components/ui/input.tsx'
import {
  TablePagination,
  usePagination,
} from '#/components/ui/table-pagination.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { MultiSearchSelect } from '#/components/ui/multi-search-select.tsx'
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

  // Modal to select vehicles from inventory with pagination, search & filters
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [tempChecked, setTempChecked] = React.useState<Set<number>>(new Set())
  const [pickerSearch, setPickerSearch] = React.useState('')
  const [filterModelIds, setFilterModelIds] = React.useState<number[]>([])
  const [filterColorIds, setFilterColorIds] = React.useState<number[]>([])
  const [filterBatchIds, setFilterBatchIds] = React.useState<number[]>([])
  const [filtersOpen, setFiltersOpen] = React.useState(false)

  // Unique filter options extracted from available vehicles
  const modelOptions = React.useMemo(() => {
    const map = new Map<number, string>()
    for (const v of availableVehicles) {
      if (v.modelId && v.modelName) {
        map.set(v.modelId, v.modelName)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [availableVehicles])

  const colorOptions = React.useMemo(() => {
    const map = new Map<number, { name: string; hex: string | null }>()
    for (const v of availableVehicles) {
      if (v.colorId && v.colorName) {
        map.set(v.colorId, { name: v.colorName, hex: v.colorHex ?? null })
      }
    }
    return Array.from(map.entries())
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [availableVehicles])

  const batchOptions = React.useMemo(() => {
    const map = new Map<number, string>()
    for (const v of availableVehicles) {
      if (v.batchId) {
        map.set(v.batchId, batchLabel(v))
      }
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'))
  }, [availableVehicles])

  const hasActiveFilters =
    pickerSearch.trim() !== '' ||
    filterModelIds.length > 0 ||
    filterColorIds.length > 0 ||
    filterBatchIds.length > 0

  // The three dropdown filters (the search box is separate): each counts once
  const dropdownFilterCount =
    (filterModelIds.length > 0 ? 1 : 0) +
    (filterColorIds.length > 0 ? 1 : 0) +
    (filterBatchIds.length > 0 ? 1 : 0)

  const clearAllFilters = () => {
    setPickerSearch('')
    setFilterModelIds([])
    setFilterColorIds([])
    setFilterBatchIds([])
  }

  const filteredAvailableVehicles = React.useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    return availableVehicles.filter((v) => {
      if (
        filterModelIds.length > 0 &&
        (!v.modelId || !filterModelIds.includes(v.modelId))
      )
        return false
      if (
        filterColorIds.length > 0 &&
        (!v.colorId || !filterColorIds.includes(v.colorId))
      )
        return false
      if (
        filterBatchIds.length > 0 &&
        (!v.batchId || !filterBatchIds.includes(v.batchId))
      )
        return false

      if (!q) return true
      const chassis = v.chassisNumber?.toLowerCase() ?? ''
      const engine = v.engineNumber?.toLowerCase() ?? ''
      const model = v.modelName?.toLowerCase() ?? ''
      const color = v.colorName?.toLowerCase() ?? ''
      const batch = batchLabel(v).toLowerCase()
      return (
        chassis.includes(q) ||
        engine.includes(q) ||
        model.includes(q) ||
        color.includes(q) ||
        batch.includes(q)
      )
    })
  }, [
    availableVehicles,
    pickerSearch,
    filterModelIds,
    filterColorIds,
    filterBatchIds,
  ])

  // 10 per page; any change of search / filter (or reopening) returns to page 1
  const pickerPg = usePagination(
    filteredAvailableVehicles,
    `${pickerOpen}|${pickerSearch}|${filterModelIds.join()}|${filterColorIds.join()}|${filterBatchIds.join()}`,
  )

  const allFilteredChecked =
    filteredAvailableVehicles.length > 0 &&
    filteredAvailableVehicles.every((v) => tempChecked.has(v.id))

  // The header checkbox works on the page in view
  const pageAllChecked =
    pickerPg.pageItems.length > 0 &&
    pickerPg.pageItems.every((v) => tempChecked.has(v.id))
  const pageSomeChecked =
    pickerPg.pageItems.some((v) => tempChecked.has(v.id)) && !pageAllChecked

  const toggleSelectPage = () => {
    const next = new Set(tempChecked)
    for (const v of pickerPg.pageItems) {
      if (pageAllChecked) next.delete(v.id)
      else next.add(v.id)
    }
    setTempChecked(next)
  }

  // Selects every vehicle matching the search / filters, across all pages
  const toggleSelectAllFiltered = () => {
    const next = new Set(tempChecked)
    if (allFilteredChecked) {
      for (const v of filteredAvailableVehicles) {
        next.delete(v.id)
      }
    } else {
      for (const v of filteredAvailableVehicles) {
        next.add(v.id)
      }
    }
    setTempChecked(next)
  }

  const submitting = createOrder.isPending
  const [error, setError] = React.useState<string | null>(null)

  // Branches list of currently selected customer
  const currentCustomer = customers.find((c) => c.id === customerId)
  const branches = currentCustomer?.branches ?? []

  const openPicker = () => {
    setTempChecked(new Set(selectedItems.map((i) => i.vehicleId)))
    setPickerSearch('')
    setFilterModelIds([])
    setFilterColorIds([])
    setFilterBatchIds([])
    setPickerOpen(true)
  }

  const handleSearchChange = (val: string) => {
    setPickerSearch(val)
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

  const lossItems = selectedItems.filter(
    (i) => i.unitPrice > 0 && i.unitPrice < i.costPrice,
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
      setError(formatErrorMessage(err, 'Lỗi khi tạo phiếu bán xe'))
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
                {lossItems.length > 0 && (
                  <div className="px-4 py-2 border-b border-rose-100 bg-rose-50 text-xs text-rose-600 space-y-0.5">
                    {lossItems.map((i) => (
                      <p key={i.vehicleId}>
                        Lưu ý: xe <strong>{i.chassisNumber}</strong> có giá bán
                        thấp hơn giá vốn {formatVnd(i.costPrice - i.unitPrice)}{' '}
                        (bán lỗ).
                      </p>
                    ))}
                  </div>
                )}
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
                          <TableHead>Số Khung</TableHead>
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
                                className="h-9 text-sm text-right px-4 rounded-lg"
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
                    className="h-11 text-sm px-4 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Khách Hàng * (Ghi nhận Doanh thu)
                  </Label>
                  <SearchSelect
                    className="h-11 w-full text-sm rounded-lg"
                    value={String(customerId)}
                    onValueChange={(val) => {
                      setCustomerId(Number(val))
                      setBranchId(null) // Reset branch
                    }}
                  >
                    {customers.map((c) => (
                      <SearchSelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SearchSelectItem>
                    ))}
                  </SearchSelect>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Điểm Bán Nhận Xe (Ghi nhận Công Nợ & HĐ)
                  </Label>
                  <SearchSelect
                    className="h-11 w-full text-sm rounded-lg"
                    placeholder="Chọn showroom/chi nhánh"
                    value={branchId ? String(branchId) : 'none'}
                    onValueChange={(val) =>
                      setBranchId(val === 'none' ? null : Number(val))
                    }
                  >
                    <SearchSelectItem value="none">
                      Trực tiếp khách hàng (không qua điểm bán)
                    </SearchSelectItem>
                    {branches.map((b) => (
                      <SearchSelectItem key={b.id} value={String(b.id)}>
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

        {/* Modal: Select vehicles from inventory with infinite scroll */}
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-h-[85vh] sm:max-w-5xl flex flex-col p-6 overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-base font-bold text-slate-900">
                Chọn Xe Từ Kho Để Bán
              </DialogTitle>
              <DialogDescription className="text-xs">
                Chỉ hiển thị những xe chưa từng được gán vào bất kỳ đơn bán nào
                ({availableVehicles.length} chiếc)
              </DialogDescription>
            </DialogHeader>

            {/* Search bar; the dropdown filters live in their own dialog */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 shrink-0">
              <div className="relative flex-1">
                <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={pickerSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Tìm theo số khung, số máy, dòng xe, màu, lô nhập..."
                  className="h-9 pl-9 pr-8 rounded-lg"
                />
                {pickerSearch && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 size-4 flex items-center justify-center text-xs"
                    title="Xóa tìm kiếm"
                  >
                    ×
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFiltersOpen(true)}
                aria-haspopup="dialog"
                className={`h-9 gap-1.5 shrink-0 ${dropdownFilterCount > 0 ? 'border-emerald-600 text-emerald-800' : ''}`}
              >
                <SlidersHorizontal className="size-4" />
                Bộ lọc
                {dropdownFilterCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-emerald-700 text-white text-[11px] px-1.5">
                    {dropdownFilterCount}
                  </span>
                )}
              </Button>

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-9 text-rose-600 hover:bg-rose-50 hover:text-rose-700 px-2.5 gap-1 shrink-0"
                >
                  <RotateCcw className="size-3.5" />
                  Xóa lọc
                </Button>
              )}

              <div className="text-xs text-slate-500 whitespace-nowrap self-center shrink-0">
                <strong>{filteredAvailableVehicles.length}</strong> xe
              </div>
            </div>

            {/* Table with a page-number footer */}
            <div className="border border-slate-200 rounded-lg flex flex-col overflow-hidden flex-1 my-2">
              <div className="overflow-y-auto max-h-[45vh] min-h-[220px] flex-1">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-xs">
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            pageAllChecked
                              ? true
                              : pageSomeChecked
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={toggleSelectPage}
                          aria-label="Chọn tất cả xe trong trang"
                        />
                      </TableHead>
                      <TableHead>Số Khung</TableHead>
                      <TableHead>Dòng xe / Màu</TableHead>
                      <TableHead>Lô Nhập</TableHead>
                      <TableHead className="text-right">Giá Bán Lô</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {pickerPg.pageItems.map((v) => {
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
                              <ColorLabel name={v.colorName} hex={v.colorHex} />
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
                    {filteredAvailableVehicles.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-xs text-slate-400 italic"
                        >
                          {pickerSearch
                            ? 'Không tìm thấy xe phù hợp với từ khóa'
                            : 'Kho không còn xe nào chưa bán'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <TablePagination pagination={pickerPg} />
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between shrink-0 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">
                  Đã chọn: <strong>{tempChecked.size} xe</strong>
                </span>
                {filteredAvailableVehicles.length > pickerPg.pageItems.length &&
                  !allFilteredChecked && (
                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      className="text-[11px] text-emerald-700 hover:underline font-medium"
                    >
                      Chọn tất cả {filteredAvailableVehicles.length} xe
                    </button>
                  )}
                {tempChecked.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setTempChecked(new Set())}
                    className="text-[11px] text-rose-600 hover:underline font-medium"
                  >
                    Bỏ chọn tất cả
                  </button>
                )}
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

        {/* Filter dialog for the vehicle picker (model / colour / batch) */}
        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Bộ Lọc Xe
              </DialogTitle>
              <DialogDescription className="text-xs">
                Thu hẹp danh sách xe trong kho theo dòng xe, màu xe và lô nhập.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Dòng xe</Label>
                <MultiSearchSelect
                  className="w-full"
                  placeholder={`Tất cả dòng xe (${modelOptions.length})`}
                  values={filterModelIds.map(String)}
                  onValuesChange={(vals) => {
                    setFilterModelIds(vals.map(Number))
                  }}
                >
                  {modelOptions.map((m) => (
                    <SearchSelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SearchSelectItem>
                  ))}
                </MultiSearchSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Màu xe</Label>
                <MultiSearchSelect
                  className="w-full"
                  placeholder={`Tất cả màu xe (${colorOptions.length})`}
                  values={filterColorIds.map(String)}
                  onValuesChange={(vals) => {
                    setFilterColorIds(vals.map(Number))
                  }}
                >
                  {colorOptions.map((c) => (
                    <SearchSelectItem
                      key={c.id}
                      value={String(c.id)}
                      keywords={c.name}
                    >
                      <ColorLabel name={c.name} hex={c.hex} />
                    </SearchSelectItem>
                  ))}
                </MultiSearchSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Lô nhập</Label>
                <MultiSearchSelect
                  className="w-full"
                  placeholder={`Tất cả lô nhập (${batchOptions.length})`}
                  values={filterBatchIds.map(String)}
                  onValuesChange={(vals) => {
                    setFilterBatchIds(vals.map(Number))
                  }}
                >
                  {batchOptions.map((b) => (
                    <SearchSelectItem
                      key={b.id}
                      value={String(b.id)}
                      className="truncate"
                    >
                      {b.label}
                    </SearchSelectItem>
                  ))}
                </MultiSearchSelect>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={dropdownFilterCount === 0}
                onClick={() => {
                  setFilterModelIds([])
                  setFilterColorIds([])
                  setFilterBatchIds([])
                }}
                className="h-8 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1"
              >
                <RotateCcw className="size-3.5" />
                Xóa lọc
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setFiltersOpen(false)}
                className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Xem {filteredAvailableVehicles.length} xe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </form>
    </AppLayout>
  )
}
