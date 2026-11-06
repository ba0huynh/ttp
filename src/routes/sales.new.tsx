import {
  alertDialog,
  formatErrorMessage,
} from '#/components/ui/confirm-dialog.tsx'
import { toast } from 'sonner'
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
  Download,
  Loader2,
  Upload,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
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
import { DecimalInput } from '#/components/ui/decimal-input.tsx'
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
import {
  DEFAULT_VAT_RATE,
  batchLabel,
  formatVnd,
  priceWithVat,
  todayIso,
} from '#/lib/business.ts'
import {
  availableVehiclesQuery,
  batchesQuery,
  customerOptionsQuery,
  currentUserQuery,
  masterDataQuery,
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
      queryClient.query(masterDataQuery()),
      queryClient.query(batchesQuery()),
    ])
  },
  component: NewSalesOrderPage,
})

function NewSalesOrderPage() {
  const { user } = Route.useRouteContext()
  const { data: customers } = useSuspenseQuery(customerOptionsQuery())
  const { data: availableVehicles } = useSuspenseQuery(availableVehiclesQuery())
  const { data: masterData } = useSuspenseQuery(masterDataQuery())
  const { data: batches } = useSuspenseQuery(batchesQuery())
  const queryClient = useQueryClient()
  const createOrder = useMutation({ mutationFn: createSalesOrderFn })
  const navigate = useNavigate()

  const [orderDate, setOrderDate] = React.useState(todayIso())
  // null = not chosen yet (require explicit user selection to avoid assigning to wrong customer)
  const [customerId, setCustomerId] = React.useState<number | null>(null)
  const [branchId, setBranchId] = React.useState<number | null>(null)

  // Selected vehicles to sell: price before VAT + VAT % (the VAT-inclusive
  // price is always calculated from the two)
  const [selectedItems, setSelectedItems] = React.useState<
    {
      vehicleId: number
      priceBeforeVat: number
      vatRate: number
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

  // Filter options: populated from master data / batches and available vehicles
  const modelOptions = React.useMemo(() => {
    const map = new Map<number, string>()
    for (const m of masterData.models) {
      if (m.id && m.name) {
        map.set(m.id, m.name)
      }
    }
    for (const v of availableVehicles) {
      if (v.modelId && v.modelName) {
        map.set(v.modelId, v.modelName)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [masterData.models, availableVehicles])

  const colorOptions = React.useMemo(() => {
    const map = new Map<number, { name: string; hex: string | null }>()
    for (const c of masterData.colors) {
      if (c.id && c.name) {
        map.set(c.id, { name: c.name, hex: c.hex ?? null })
      }
    }
    for (const v of availableVehicles) {
      if (v.colorId && v.colorName) {
        map.set(v.colorId, { name: v.colorName, hex: v.colorHex ?? null })
      }
    }
    return Array.from(map.entries())
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [masterData.colors, availableVehicles])

  const batchOptions = React.useMemo(() => {
    const map = new Map<number, string>()
    for (const b of batches) {
      if (b.id) {
        map.set(b.id, batchLabel(b))
      }
    }
    for (const v of availableVehicles) {
      if (v.batchId) {
        map.set(v.batchId, batchLabel(v))
      }
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'))
  }, [batches, availableVehicles])

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
          priceBeforeVat: existing ? existing.priceBeforeVat : v.sellingPrice,
          vatRate: existing ? existing.vatRate : DEFAULT_VAT_RATE,
          chassisNumber: v.chassisNumber,
          modelName: v.modelName,
          colorName: v.colorName,
          costPrice: v.costPrice,
        }
      })
    setSelectedItems(chosen)
    if (chosen.length > 0 && error?.includes('ít nhất một chiếc xe')) {
      setError(null)
    }
    setPickerOpen(false)
  }

  const removeItem = (vId: number) => {
    setSelectedItems(selectedItems.filter((i) => i.vehicleId !== vId))
  }

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [importing, setImporting] = React.useState(false)

  const handleDownloadTemplate = async () => {
    const { downloadSalesTemplate } = await import(
      '#/lib/sales-excel-import.ts'
    )
    downloadSalesTemplate(availableVehicles.map((v) => v.chassisNumber))
  }

  const handleImportFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const { parseSalesWorkbook } = await import('#/lib/sales-excel-import.ts')
      const result = await parseSalesWorkbook(
        file,
        availableVehicles.map((v) => v.chassisNumber),
      )
      if (result.missingChassis.length > 0) {
        const shown = result.missingChassis.slice(0, 20)
        const more = result.missingChassis.length - shown.length
        await alertDialog({
          title: 'Số khung không tồn tại',
          description:
            `${result.missingChassis.length} SỐ KHUNG trong file không tồn tại trong kho (hoặc không còn sẵn sàng để bán):\n` +
            shown.map((c) => `• ${c}`).join('\n') +
            (more > 0 ? `\n… và ${more} số khung khác` : '') +
            '\n\nKhông có xe nào được thêm. Vui lòng sửa file và nhập lại.',
          destructive: true,
        })
        return
      }
      if (result.invalidRows.length > 0) {
        await alertDialog({
          title: 'File Excel có dữ liệu không hợp lệ',
          description:
            result.invalidRows.slice(0, 20).join('\n') +
            '\n\nKhông có xe nào được thêm.',
          destructive: true,
        })
        return
      }
      if (result.rows.length === 0) {
        await alertDialog('File không có dòng dữ liệu nào để nhập.')
        return
      }
      const byChassis = new Map(
        availableVehicles.map((v) => [v.chassisNumber.trim().toLowerCase(), v]),
      )
      const next = new Map(selectedItems.map((i) => [i.vehicleId, i]))
      for (const r of result.rows) {
        const v = byChassis.get(r.chassisNumber.toLowerCase())
        if (!v) continue
        next.set(v.id, {
          vehicleId: v.id,
          priceBeforeVat: r.priceBeforeVat,
          vatRate: r.vatRate,
          chassisNumber: v.chassisNumber,
          modelName: v.modelName,
          colorName: v.colorName,
          costPrice: v.costPrice,
        })
      }
      setSelectedItems([...next.values()])
      toast.success(`Đã nhập ${result.rows.length} xe từ file Excel`)
    } catch (err) {
      await alertDialog({
        title: 'Không đọc được file Excel',
        description: formatErrorMessage(err, 'File không hợp lệ'),
        destructive: true,
      })
    } finally {
      setImporting(false)
    }
  }

  // Clear validation error as soon as user adds vehicles or selects a customer
  React.useEffect(() => {
    if (
      selectedItems.length > 0 &&
      error === 'Vui lòng chọn ít nhất một chiếc xe từ kho để bán'
    ) {
      setError(null)
    }
  }, [selectedItems.length, error])

  React.useEffect(() => {
    if (customerId !== null && error === 'Vui lòng chọn khách hàng') {
      setError(null)
    }
  }, [customerId, error])

  React.useEffect(() => {
    if (
      selectedItems.length > 0 &&
      selectedItems.every((i) => i.priceBeforeVat > 0) &&
      error?.includes('Đơn giá chưa VAT')
    ) {
      setError(null)
    }
  }, [selectedItems, error])

  const totalAmount = selectedItems.reduce(
    (s, i) => s + priceWithVat(i.priceBeforeVat, i.vatRate),
    0,
  )

  // Cost has no VAT, so it is compared with the price BEFORE VAT
  const lossItems = selectedItems.filter(
    (i) => i.priceBeforeVat > 0 && i.priceBeforeVat < i.costPrice,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedItems.length === 0) {
      setError('Vui lòng chọn ít nhất một chiếc xe từ kho để bán')
      return
    }
    if (customerId === null) {
      setError('Vui lòng chọn khách hàng')
      return
    }
    const invalidPriceIndex = selectedItems.findIndex(
      (i) => typeof i.priceBeforeVat !== 'number' || i.priceBeforeVat <= 0,
    )
    if (invalidPriceIndex !== -1) {
      setError(`Xe ${invalidPriceIndex + 1} — Đơn giá chưa VAT: Phải lớn hơn 0`)
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
            priceBeforeVat: i.priceBeforeVat,
            vatRate: i.vatRate,
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
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {submitting ? 'Đang lưu...' : 'Xác Nhận Lập Phiếu'}
          </Button>
        </div>

        {error && (
          <Alert
            variant="destructive"
            className="bg-rose-50 text-rose-900 border-rose-200 text-xs flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-rose-600 shrink-0" />
              <AlertDescription>{error}</AlertDescription>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-700 p-0.5 rounded transition-colors"
              aria-label="Đóng thông báo"
            >
              <X className="size-4" />
            </button>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columns 1 & 2: Selected vehicles list */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-bold text-slate-800">
                    Xe Chọn Bán ({selectedItems.length} xe &bull; Tổng tiền đã VAT:{' '}
                    <span className="text-emerald-800">
                      {formatVnd(totalAmount)}
                    </span>
                    )
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Mỗi xe (theo số khung) chỉ được phép bán đúng một lần
                  </CardDescription>
                </div>
                <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Download className="size-3.5" />
                    Xuất file mẫu
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={importing}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs gap-1.5"
                  >
                    {importing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    Nhập Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openPicker}
                    className="h-8 text-xs gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold hover:bg-emerald-100"
                  >
                    <Plus className="size-3.5" />
                    Chọn xe từ kho ({availableVehicles.length} xe)
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {lossItems.length > 0 && (
                  <div className="px-4 py-2 border-b border-rose-100 bg-rose-50 text-xs text-rose-600 space-y-0.5">
                    {lossItems.map((i) => (
                      <p key={i.vehicleId}>
                        Lưu ý: xe <strong>{i.chassisNumber}</strong> có giá bán
                        thấp hơn giá vốn {formatVnd(i.costPrice - i.priceBeforeVat)}{' '}
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
<TableHead className="w-12 text-center">STT</TableHead>
                          <TableHead>Số Khung</TableHead>
                          <TableHead>Dòng xe / Màu</TableHead>
                          <TableHead className="text-right">Giá Vốn</TableHead>
                          <TableHead className="text-right w-44">
                            Đơn Giá Chưa VAT (VNĐ) *
                          </TableHead>
                          <TableHead className="text-right w-28">
                            % VAT *
                          </TableHead>
                          <TableHead className="text-right w-40">
                            Đơn Giá Đã VAT (VNĐ)
                          </TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {selectedItems.map((item, idx) => (
                          <TableRow key={item.vehicleId}>
<TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
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
                                value={item.priceBeforeVat}
                                onValueChange={(n) => {
                                  const updated = [...selectedItems]
                                  updated[idx].priceBeforeVat = n
                                  setSelectedItems(updated)
                                  if (n > 0 && error?.includes('Đơn giá chưa VAT')) {
                                    setError(null)
                                  }
                                }}
                                className="h-9 text-sm text-right px-4 rounded-lg"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <DecimalInput
                                maxDecimals={2}
                                value={item.vatRate}
                                onValueChange={(n) => {
                                  const updated = [...selectedItems]
                                  updated[idx].vatRate = Math.min(n, 100)
                                  setSelectedItems(updated)
                                }}
                                className="h-9 text-sm text-right px-3 rounded-lg"
                              />
                            </TableCell>
                            <TableCell className="text-right font-semibold text-slate-900">
                              {formatVnd(
                                priceWithVat(item.priceBeforeVat, item.vatRate),
                              )}
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
                    value={customerId === null ? '' : String(customerId)}
                    placeholder={
                      customers.length === 0
                        ? 'Chưa có khách hàng: hãy tạo ở mục Khách hàng'
                        : 'Chọn khách hàng'
                    }
                    onValueChange={(val) => {
                      setCustomerId(Number(val))
                      setBranchId(null) // Reset branch
                      if (error === 'Vui lòng chọn khách hàng') setError(null)
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
                    placeholder={
                      customerId === null
                        ? 'Vui lòng chọn khách hàng trước'
                        : 'Chọn showroom/chi nhánh'
                    }
                    disabled={customerId === null}
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
<TableHead className="w-12 text-center">STT</TableHead>
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
                    {pickerPg.pageItems.map((v, rowIdx) => {
                      const checked = tempChecked.has(v.id)
                      return (
                        <TableRow
                          key={v.id}
                          className={`cursor-pointer ${checked ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}
                          onClick={() => toggleCheck(v.id)}
                        >
<TableCell className="text-center text-muted-foreground">{pickerPg.pageSize * (pickerPg.page - 1) + rowIdx + 1}</TableCell>
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
                    {filteredAvailableVehicles.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
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
                      {c.name}
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
