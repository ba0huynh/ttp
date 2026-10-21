import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Pencil, SlidersHorizontal } from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

import { VehicleFormDialog } from '#/components/batches/VehicleFormDialog.tsx'
import { useCan } from '#/components/auth/Can.tsx'
import {
  DeliveryStatusBadge,
  InvoiceStatusBadge,
} from '#/components/inventory/DualInventoryBadge.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { MultiSearchSelect } from '#/components/ui/multi-search-select.tsx'
import { PriceRangeFilter } from '#/components/ui/price-range-filter.tsx'
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
  TablePagination,
  usePagination,
} from '#/components/ui/table-pagination.tsx'
import { formatVnd, batchLabel } from '#/lib/business.ts'
import {
  inventorySummaryQuery,
  vehiclesQuery,
  currentUserQuery,
} from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import { confirmDelete, reportDeleteFailure } from '#/lib/usage.ts'
import { useBusyKeys } from '#/lib/use-busy.ts'
import { useUrlText } from '#/lib/use-url-text.ts'
import { removeVehicleFn, updateVehicleFn } from '#/server/fns/batches.ts'

const STOCK_FILTERS = [
  'physical',
  'invoiced',
  'mismatch',
  'available',
] as const

export const Route = createFileRoute('/inventory')({
  // Filter and search live in the URL (?stock=mismatch&chassis=...) so a reload or a
  // shared link keeps them; defaults ("all", empty search) are left out
  validateSearch: z.object({
    stock: z.array(z.enum(STOCK_FILTERS)).optional().catch(undefined),
    chassis: z.string().optional().catch(undefined),
    engine: z.string().optional().catch(undefined),
    batch: z.array(z.number().int()).optional().catch(undefined),
    model: z.array(z.string()).optional().catch(undefined),
    color: z.array(z.string()).optional().catch(undefined),
    delivered: z.array(z.enum(['yes', 'no'])).optional().catch(undefined),
    invoiced: z.array(z.enum(['yes', 'no'])).optional().catch(undefined),
    priceType: z.enum(['import', 'cost']).optional().catch(undefined),
    minPrice: z.number().optional().catch(undefined),
    maxPrice: z.number().optional().catch(undefined),
    minFee: z.number().optional().catch(undefined),
    maxFee: z.number().optional().catch(undefined),
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'inventory.view')
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.query(inventorySummaryQuery()),
      queryClient.query(vehiclesQuery()),
    ])
  },
  component: InventoryPage,
})

function InventoryPage() {
  const { user } = Route.useRouteContext()
  const { data: summary } = useSuspenseQuery(inventorySummaryQuery())
  const { data: vehicles } = useSuspenseQuery(vehiclesQuery())
  const queryClient = useQueryClient()
  const canManage = useCan('batches.manage')
  const { isBusy, setBusy } = useBusyKeys()
  const [editVehicle, setEditVehicle] = React.useState<
    (typeof vehicles)[number] | null
  >(null)

  const deleteVehicle = useMutation({
    mutationFn: removeVehicleFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const updateVehicle = useMutation({
    mutationFn: updateVehicleFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const handleDeleteVehicle = async (v: (typeof vehicles)[number]) => {
    const key = `vehicles:${v.id}`
    const ok = await confirmDelete(
      { entity: 'vehicles', id: v.id, name: v.chassisNumber },
      {
        title: `Xóa xe ${v.chassisNumber}?`,
        description:
          'Xe sẽ bị xóa khỏi kho và chi phí lô sẽ được phân bổ lại.',
      },
      (checking) => setBusy(key, checking),
    )
    if (!ok) return
    setBusy(key, true)
    try {
      await deleteVehicle.mutateAsync({ data: { vehicleId: v.id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity: 'vehicles', id: v.id, name: v.chassisNumber },
        'Không thể xóa xe',
      )
    } finally {
      setBusy(key, false)
    }
  }

  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()
  const filterStock = searchParams.stock ?? []
  // The box filters instantly; the URL follows once typing pauses
  const [chassisSearch, setChassisSearch] = useUrlText(
    searchParams.chassis ?? '',
    (chassis) =>
      navigate({
        search: (prev) => ({ ...prev, chassis: chassis || undefined }),
        replace: true,
      }),
  )
  const [engineSearch, setEngineSearch] = useUrlText(
    searchParams.engine ?? '',
    (engine) =>
      navigate({
        search: (prev) => ({ ...prev, engine: engine || undefined }),
        replace: true,
      }),
  )
  const setFilterStock = (stock: (typeof STOCK_FILTERS)[number][]) =>
    navigate({
      search: (prev) => ({
        ...prev,
        stock: stock.length ? stock : undefined,
      }),
      replace: true,
    })

  const filterBatch = searchParams.batch ?? []
  const filterModel = searchParams.model ?? []
  const filterColor = searchParams.color ?? []
  const filterDelivered = searchParams.delivered ?? []
  const filterInvoiced = searchParams.invoiced ?? []
  const filterPriceType = searchParams.priceType ?? 'import'
  const filterMinPrice = searchParams.minPrice
  const filterMaxPrice = searchParams.maxPrice
  const filterMinFee = searchParams.minFee
  const filterMaxFee = searchParams.maxFee
  const setDropdownFilter = (
    key:
      | 'batch'
      | 'model'
      | 'color'
      | 'delivered'
      | 'invoiced'
      | 'priceType'
      | 'minPrice'
      | 'maxPrice',
    value: string | number | string[] | number[] | undefined,
  ) =>
    navigate({
      search: (prev) => ({ ...prev, [key]: value }),
      replace: true,
    })

  // Dropdown options come from the vehicles actually in stock
  const batchOptions = [
    ...new Map(vehicles.map((v) => [v.batchId, batchLabel(v)])),
  ]
  const modelOptions = [...new Set(vehicles.map((v) => v.modelName))].sort()
  // Color name -> swatch, so the dropdown shows the same dot as the table
  const colorHexByName = new Map(vehicles.map((v) => [v.colorName, v.colorHex]))
  const colorOptions = [...colorHexByName.keys()].sort()
  const activeFilterCount = [
    filterBatch.length > 0,
    filterModel.length > 0,
    filterColor.length > 0,
    filterDelivered.length > 0,
    filterInvoiced.length > 0,
    filterMinPrice !== undefined || filterMaxPrice !== undefined,
    filterMinFee !== undefined || filterMaxFee !== undefined,
    filterStock.length > 0,
    Boolean(chassisSearch.trim()),
    Boolean(engineSearch.trim()),
  ].filter(Boolean).length
  const hasDropdownFilter = activeFilterCount > 0
  const [showFilters, setShowFilters] = React.useState(false)

  const filtered = vehicles.filter((v) => {
    if (filterBatch.length && !filterBatch.includes(v.batchId)) return false
    if (filterModel.length && !filterModel.includes(v.modelName)) return false
    if (filterColor.length && !filterColor.includes(v.colorName)) return false
    if (
      filterDelivered.length &&
      !filterDelivered.includes(v.isDelivered ? 'yes' : 'no')
    )
      return false
    if (
      filterInvoiced.length &&
      !filterInvoiced.includes(v.isInvoiced ? 'yes' : 'no')
    )
      return false
    const price = filterPriceType === 'cost' ? v.costPrice : v.importPrice
    if (filterMinPrice !== undefined && price < filterMinPrice) return false
    if (filterMaxPrice !== undefined && price > filterMaxPrice) return false
    // Fee = the batch expenses allocated to this vehicle (cost - import price)
    const fee = v.costPrice - v.importPrice
    if (filterMinFee !== undefined && fee < filterMinFee) return false
    if (filterMaxFee !== undefined && fee > filterMaxFee) return false
    const chassisQ = chassisSearch.trim().toLowerCase()
    if (chassisQ && !v.chassisNumber.toLowerCase().includes(chassisQ)) {
      return false
    }
    const engineQ = engineSearch.trim().toLowerCase()
    if (engineQ && !v.engineNumber.toLowerCase().includes(engineQ)) {
      return false
    }

    // Several stock statuses combine as "any of"
    if (filterStock.length) {
      return filterStock.some((s) => {
        if (s === 'physical') return !v.isDelivered
        if (s === 'invoiced') return !v.isInvoiced
        if (s === 'available') return !v.salesOrderId
        // Mismatch between the two inventories
        return v.isDelivered !== v.isInvoiced
      })
    }
    return true
  })
  const vehiclesPg = usePagination(
    filtered,
    `${chassisSearch}|${engineSearch}|${filterStock.join()}|${filterBatch.join()}|${filterModel.join()}|${filterColor.join()}|${filterDelivered}|${filterInvoiced}|${filterPriceType}|${filterMinPrice}|${filterMaxPrice}|${filterMinFee}|${filterMaxFee}`,
  )

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Kho Xe — Cơ Chế 2 Kho Độc Lập
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Theo dõi song song <strong>Kho thực tế</strong> (vật lý) và{' '}
              <strong>Kho hóa đơn</strong> (chứng từ tài chính) trên từng chiếc
              xe máy.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(true)}
            aria-haspopup="dialog"
            className={`h-11 rounded-lg text-sm gap-1.5 self-start sm:self-auto ${hasDropdownFilter ? 'border-emerald-600 text-emerald-800' : ''}`}
          >
            <SlidersHorizontal className="size-4" />
            Bộ lọc
            {hasDropdownFilter && (
              <span className="ml-0.5 rounded-full bg-emerald-700 text-white text-[11px] px-1.5">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

            {/* Advanced filters dialog (opened by "Bộ lọc") */}
            <Dialog open={showFilters} onOpenChange={setShowFilters}>
              <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Bộ Lọc Nâng Cao
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Kết quả được lọc ngay khi thay đổi ({filtered.length} xe
                    phù hợp)
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Số khung</Label>
                    <Input
                      placeholder="Số khung..."
                      value={chassisSearch}
                      onChange={(e) => setChassisSearch(e.target.value)}
                      className="h-11 text-sm rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Số máy</Label>
                    <Input
                      placeholder="Số máy..."
                      value={engineSearch}
                      onChange={(e) => setEngineSearch(e.target.value)}
                      className="h-11 text-sm rounded-lg"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">
                      Tình trạng kho
                    </Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder={`Tất cả (${vehicles.length})`}
                      values={filterStock}
                      onValuesChange={(vals) =>
                        setFilterStock(vals as (typeof STOCK_FILTERS)[number][])
                      }
                    >
                      <SearchSelectItem value="physical">
                        Tồn thực tế ({summary.physical})
                      </SearchSelectItem>
                      <SearchSelectItem value="invoiced">
                        Tồn hóa đơn ({summary.invoiced})
                      </SearchSelectItem>
                      <SearchSelectItem value="mismatch">
                        Xe đang lệch 2 kho (
                        {summary.invoicedNotDelivered +
                          summary.deliveredNotInvoiced}
                        )
                      </SearchSelectItem>
                      <SearchSelectItem value="available">
                        Chưa bán ({summary.unsold})
                      </SearchSelectItem>
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Lô nhập</Label>
              <MultiSearchSelect
                className="h-11 w-full text-sm rounded-lg"
                placeholder="Tất cả lô nhập"
                values={filterBatch.map(String)}
                onValuesChange={(vals) =>
                  setDropdownFilter(
                    'batch',
                    vals.length ? vals.map(Number) : undefined,
                  )
                }
              >
                {batchOptions.map(([id, label]) => (
                  <SearchSelectItem
                    key={id}
                    value={String(id)}
                   
                  >
                    {label}
                  </SearchSelectItem>
                ))}
              </MultiSearchSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Dòng xe</Label>
              <MultiSearchSelect
                className="h-11 w-full text-sm rounded-lg"
                placeholder="Tất cả dòng xe"
                values={filterModel}
                onValuesChange={(vals) =>
                  setDropdownFilter('model', vals.length ? vals : undefined)
                }
              >
                {modelOptions.map((m) => (
                  <SearchSelectItem key={m} value={m}>
                    {m}
                  </SearchSelectItem>
                ))}
              </MultiSearchSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Màu</Label>
              <MultiSearchSelect
                className="h-11 w-full text-sm rounded-lg"
                placeholder="Tất cả màu"
                values={filterColor}
                onValuesChange={(vals) =>
                  setDropdownFilter('color', vals.length ? vals : undefined)
                }
              >
                {colorOptions.map((c) => (
                  <SearchSelectItem key={c} value={c}>
                    {colorHexByName.get(c) && (
                      <span
                        className="size-2.5 shrink-0 rounded-full inline-block border border-slate-300"
                        style={{
                          backgroundColor: colorHexByName.get(c) ?? undefined,
                        }}
                      />
                    )}
                    {c}
                  </SearchSelectItem>
                ))}
              </MultiSearchSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Giao xe</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Giao xe: tất cả"
                      values={filterDelivered}
                      onValuesChange={(vals) =>
                        setDropdownFilter(
                          'delivered',
                          vals.length ? (vals as ('yes' | 'no')[]) : undefined,
                        )
                      }
                    >
                      <SearchSelectItem value="yes">
                        Đã giao xe
                      </SearchSelectItem>
                      <SearchSelectItem value="no">
                        Chưa giao xe
                      </SearchSelectItem>
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Hóa đơn</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Hóa đơn: tất cả"
                      values={filterInvoiced}
                      onValuesChange={(vals) =>
                        setDropdownFilter(
                          'invoiced',
                          vals.length ? (vals as ('yes' | 'no')[]) : undefined,
                        )
                      }
                    >
                      <SearchSelectItem value="yes">
                        Đã có hóa đơn
                      </SearchSelectItem>
                      <SearchSelectItem value="no">
                        Chưa có hóa đơn
                      </SearchSelectItem>
                    </MultiSearchSelect>
                  </div>

                  {/* Price filter: which price, plus a min / max range */}
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Loại giá</Label>
                    <SearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      value={filterPriceType}
                      onValueChange={(val) =>
                        setDropdownFilter(
                          'priceType',
                          val === 'import' ? undefined : val,
                        )
                      }
                    >
                      <SearchSelectItem value="import">
                        Đơn giá nhập (giá nhập thực tế)
                      </SearchSelectItem>
                      <SearchSelectItem value="cost">
                        Giá vốn xe (đã gồm chi phí)
                      </SearchSelectItem>
                    </SearchSelect>
                  </div>
                  <div className="sm:col-span-2">
                    <PriceRangeFilter
                      label="Chi phí phân bổ (giá vốn − giá nhập)"
                      min={filterMinFee}
                      max={filterMaxFee}
                      onChange={(lo, hi) =>
                        navigate({
                          search: (prev) => ({
                            ...prev,
                            minFee: lo,
                            maxFee: hi,
                          }),
                          replace: true,
                        })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <PriceRangeFilter
                      label="Khoảng giá"
                      min={filterMinPrice}
                      max={filterMaxPrice}
                      onChange={(lo, hi) =>
                        navigate({
                          search: (prev) => ({
                            ...prev,
                            minPrice: lo,
                            maxPrice: hi,
                          }),
                          replace: true,
                        })
                      }
                    />
                  </div>
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!hasDropdownFilter}
                    onClick={() => {
                      setChassisSearch('')
                      setEngineSearch('')
                      navigate({
                        search: (prev) => ({
                          ...prev,
                          stock: undefined,
                          batch: undefined,
                          model: undefined,
                          color: undefined,
                          delivered: undefined,
                          invoiced: undefined,
                          priceType: undefined,
                          minPrice: undefined,
                          maxPrice: undefined,
                        }),
                        replace: true,
                      })
                    }}
                    className="h-8 text-xs text-slate-500"
                  >
                    Xóa lọc
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowFilters(false)}
                    className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                  >
                    Xong
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

        {/* Vehicles Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh Sách Chi Tiết Từng Chiếc Xe ({filtered.length} kết quả)
            </CardTitle>
            <div className="text-xs text-slate-500">
              Định danh duy nhất bằng <strong>Số Khung</strong>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50/70">
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead className="w-[180px]">Số Khung</TableHead>
                    <TableHead>Số Máy</TableHead>
                    <TableHead>Dòng xe / Màu</TableHead>
                    <TableHead>Lô Nhập</TableHead>
                    <TableHead className="text-right">Đơn Giá Nhập</TableHead>
                    <TableHead className="text-right">Giá Vốn Xe</TableHead>
                    <TableHead className="text-center">Trạng Thái</TableHead>
                    <TableHead className="text-center">Trạng Thái HĐ</TableHead>
                    <TableHead>Đơn Bán</TableHead>
                    {canManage && (
                      <TableHead className="text-center">Thao tác</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 11 : 10}
                        className="text-center py-8 text-slate-500"
                      >
                        Không tìm thấy chiếc xe nào phù hợp bộ lọc
                      </TableCell>
                    </TableRow>
                  ) : (
                    vehiclesPg.pageItems.map((v) => (
                      <TableRow key={v.id} className="hover:bg-slate-50/80">
                        <TableCell className="text-slate-500">
                          {v.id}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {v.chassisNumber}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {v.engineNumber}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">
                            {v.modelName}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            {v.colorHex && (
                              <span
                                className="size-2.5 rounded-full inline-block border border-slate-300"
                                style={{ backgroundColor: v.colorHex }}
                              />
                            )}
                            {v.colorName}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-900">
                          <Link
                            to="/batches/$batchId"
                            params={{ batchId: String(v.batchId) }}
                            preload="intent"
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            {batchLabel(v)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatVnd(v.importPrice)}
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatVnd(v.costPrice)}
                        </TableCell>
                        <TableCell className="text-center">
                          <DeliveryStatusBadge
                            isDelivered={v.isDelivered}
                            isInvoiced={v.isInvoiced}
                            deliveredAt={v.deliveredAt}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <InvoiceStatusBadge
                            isDelivered={v.isDelivered}
                            isInvoiced={v.isInvoiced}
                            invoicedAt={v.invoicedAt}
                          />
                        </TableCell>
                        <TableCell>
                          {v.salesOrderId ? (
                            <Link
                              to="/sales/$orderId"
                              params={{ orderId: String(v.salesOrderId) }}
                              className="font-medium text-emerald-700 hover:underline"
                            >
                              Xem phiếu bán
                            </Link>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-center whitespace-nowrap">
                            {v.salesOrderId ||
                            v.isDelivered ||
                            v.isInvoiced ? (
                              <span
                                className="text-xs text-slate-400 select-none cursor-not-allowed inline-block p-1"
                                title="Xe đã bán/giao/xuất hóa đơn — không thể sửa hoặc xóa"
                              >
                                —
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditVehicle(v)}
                                  disabled={
                                    isBusy(`vehicles:${v.id}`) ||
                                    deleteVehicle.isPending ||
                                    updateVehicle.isPending
                                  }
                                  className="size-7 text-slate-400 hover:text-emerald-700"
                                  aria-label={`Sửa xe ${v.chassisNumber}`}
                                  title={`Sửa xe ${v.chassisNumber}`}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteVehicle(v)}
                                  disabled={
                                    isBusy(`vehicles:${v.id}`) ||
                                    deleteVehicle.isPending ||
                                    updateVehicle.isPending
                                  }
                                  className="size-7 text-slate-400 hover:text-rose-600"
                                  aria-label={`Xóa xe ${v.chassisNumber}`}
                                  title={`Xóa xe ${v.chassisNumber}`}
                                >
                                  <BusyTrash
                                    busy={
                                      isBusy(`vehicles:${v.id}`) ||
                                      (deleteVehicle.isPending &&
                                        deleteVehicle.variables?.data
                                          .vehicleId === v.id)
                                    }
                                  />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination pagination={vehiclesPg} />
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <VehicleFormDialog
          open={Boolean(editVehicle)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditVehicle(null)
          }}
          title={
            editVehicle
              ? `Sửa Xe ${editVehicle.chassisNumber}`
              : 'Sửa Xe'
          }
          submitLabel="Lưu"
          pending={updateVehicle.isPending}
          initial={
            editVehicle
              ? {
                  modelId: editVehicle.modelId ?? 0,
                  colorId: editVehicle.colorId,
                  chassisNumber: editVehicle.chassisNumber,
                  engineNumber: editVehicle.engineNumber,
                  importPrice: editVehicle.importPrice,
                }
              : null
          }
          onSubmit={async (values) => {
            if (!editVehicle) return
            await updateVehicle.mutateAsync({
              data: {
                vehicleId: editVehicle.id,
                ...values,
              },
            })
          }}
        />
      )}
    </AppLayout>
  )
}
