import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  Loader2,
  PackagePlus,
  SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { showErrorDialog } from '#/components/ui/confirm-dialog.tsx'
import * as React from 'react'
import { z } from 'zod'

import { Can } from '#/components/auth/Can.tsx'
import { SupplierLink } from '#/components/suppliers/SupplierDetailDialog.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Badge } from '#/components/ui/badge.tsx'
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
import { PriceRangeFilter } from '#/components/ui/price-range-filter.tsx'
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
  TablePagination,
  usePagination,
} from '#/components/ui/table-pagination.tsx'
import { formatDate, formatVnd } from '#/lib/business.ts'
import {
  batchesQuery,
  currentUserQuery,
  masterDataQuery,
} from '#/lib/queries.ts'
import { deleteBatchFn } from '#/server/fns/batches.ts'
import { confirmDelete, reportDeleteFailure } from '#/lib/usage.ts'
import { useBusyKeys } from '#/lib/use-busy.ts'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import { requirePagePermission } from '#/lib/route-guard.ts'

const NO_SUPPLIER = '__none__'

const SORT_KEYS = ['date', 'supplier', 'loan', 'vehicles', 'import', 'fee', 'cost'] as const
type SortKey = (typeof SORT_KEYS)[number]
const SORT_LABELS: Record<SortKey, string> = {
  date: 'Ngày nhập',
  supplier: 'Nhà cung cấp',
  loan: 'Khế ước vay',
  vehicles: 'Số xe',
  import: 'Tiền hàng',
  fee: 'Chi phí lô',
  cost: 'Tổng giá vốn lô',
}
const SORT_VALUE: Record<
  SortKey,
  (b: {
    importDate: string
    supplierName: string | null
    loanContractNumber: string | null
    vehicleCount: number
    totalImport: number
    totalExpense: number
    totalCost: number
  }) => number | string
> = {
  date: (b) => String(b.importDate),
  supplier: (b) => b.supplierName ?? '',
  loan: (b) => b.loanContractNumber ?? '',
  vehicles: (b) => b.vehicleCount,
  import: (b) => b.totalImport,
  fee: (b) => b.totalExpense,
  cost: (b) => b.totalCost,
}

export const Route = createFileRoute('/batches/')({
  // Filters live in the URL so a reload or shared link keeps them
  validateSearch: z.object({
    supplier: z.array(z.string()).optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    base: z.enum(['import_price', 'cost_price']).optional().catch(undefined),
    minCost: z.number().optional().catch(undefined),
    maxCost: z.number().optional().catch(undefined),
    feeTypes: z.array(z.number().int()).optional().catch(undefined),
    minFee: z.number().optional().catch(undefined),
    maxFee: z.number().optional().catch(undefined),
    sort: z.enum(SORT_KEYS).optional().catch(undefined),
    dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'batches.view')
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.query(batchesQuery()),
      queryClient.query(masterDataQuery()),
    ])
  },
  component: BatchesPage,
})

function BatchesPage() {
  const { user } = Route.useRouteContext()
  const { data: batches } = useSuspenseQuery(batchesQuery())
  const { data: masterData } = useSuspenseQuery(masterDataQuery())
  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()
  const [showFilters, setShowFilters] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const {
    supplier,
    from,
    to,
    base,
    minCost,
    maxCost,
    feeTypes,
    minFee,
    maxFee,
    sort,
    dir,
  } = searchParams
  const setFilter = (
    key:
      | 'supplier'
      | 'from'
      | 'to'
      | 'base'
      | 'minCost'
      | 'maxCost'
      | 'feeTypes'
      | 'dir',
    value: string | number | string[] | number[] | undefined,
  ) =>
    navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: true })

  // Every supplier / fee type in the master data, not only those already used
  const supplierOptions = [
    ...new Set([
      ...masterData.suppliers.map((s) => s.name),
      ...batches.flatMap((b) => (b.supplierName ? [b.supplierName] : [])),
    ]),
  ]
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .concat(batches.some((b) => !b.supplierName) ? [NO_SUPPLIER] : [])
  const activeFilterCount = [
    Boolean(supplier?.length),
    Boolean(from || to),
    base !== undefined,
    minCost !== undefined || maxCost !== undefined,
    Boolean(feeTypes?.length) || minFee !== undefined || maxFee !== undefined,
  ].filter(Boolean).length

  const feeTypeOptions = masterData.expenseTypes.map(
    (t) => [t.id, t.name] as const,
  )

  const filtered = batches.filter((b) => {
    if (
      supplier?.length &&
      !supplier.includes(b.supplierName || NO_SUPPLIER)
    )
      return false
    const date = String(b.importDate).slice(0, 10)
    if (from && date < from) return false
    if (to && date > to) return false
    if (base && b.pricingBase !== base) return false
    if (minCost !== undefined && b.totalCost < minCost) return false
    if (maxCost !== undefined && b.totalCost > maxCost) return false
    // With fee types picked, the batch must have one of them and the range
    // applies to the sum of just those types; otherwise to the whole batch fee
    let fee = b.totalExpense
    if (feeTypes?.length) {
      const matching = b.expenses.filter((e) =>
        feeTypes.includes(e.expenseTypeId),
      )
      if (matching.length === 0) return false
      fee = matching.reduce((s, e) => s + e.amount, 0)
    }
    if (minFee !== undefined && fee < minFee) return false
    if (maxFee !== undefined && fee > maxFee) return false
    return true
  })
  // No sort chosen keeps the server order (newest first)
  const sorted = sort
    ? [...filtered].sort((a, b) => {
        const va = SORT_VALUE[sort](a)
        const vb = SORT_VALUE[sort](b)
        const cmp =
          typeof va === 'string' || typeof vb === 'string'
            ? String(va).localeCompare(String(vb), 'vi')
            : va - vb
        return dir === 'asc' ? cmp : -cmp
      })
    : filtered
  const handleExportExcel = async () => {
    if (exporting || sorted.length === 0) return
    setExporting(true)
    try {
      const { downloadBatchesExcel } = await import('#/lib/list-excel.ts')
      downloadBatchesExcel(sorted, batches.length)
      toast.success(`Đã xuất ${sorted.length} lô xe ra file Excel`)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể xuất Excel')
    } finally {
      setExporting(false)
    }
  }
  const batchesPg = usePagination(
    sorted,
    `${supplier}|${from}|${to}|${base}|${minCost}|${maxCost}|${feeTypes?.join()}|${minFee}|${maxFee}|${sort}|${dir}`,
  )

  // Header click: ascending, then descending, then back to the default order
  const toggleSort = (key: SortKey) => {
    const next =
      sort !== key
        ? { sort: key, dir: 'asc' as const }
        : dir === 'asc'
          ? { sort: key, dir: 'desc' as const }
          : { sort: undefined, dir: undefined }
    navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })
  }
  const sortHead = (key: SortKey, label: string, align: string) => (
    <TableHead className={align}>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1 font-[inherit] uppercase hover:text-slate-900 ${sort === key ? 'text-emerald-800' : ''}`}
      >
        {label}
        {sort !== key ? (
          <ArrowUpDown className="size-3 opacity-40" />
        ) : dir === 'asc' ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )}
      </button>
    </TableHead>
  )
  const queryClient = useQueryClient()
  const { isBusy, setBusy } = useBusyKeys()

  const deleteBatch = useMutation({
    mutationFn: deleteBatchFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const handleDelete = async (b: { id: number; importDate: string }) => {
    const key = `batches:${b.id}`
    const name = `Lô nhập ${formatDate(b.importDate)}`
    const ok = await confirmDelete(
      { entity: 'batches', id: b.id, name },
      {
        title: `Xóa "${name}"?`,
        description:
          'Toàn bộ xe và chi phí của lô cũng bị xóa. Không thể hoàn tác.',
      },
      (checking) => setBusy(key, checking),
    )
    if (!ok) return
    setBusy(key, true)
    try {
      await deleteBatch.mutateAsync({ data: { id: b.id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity: 'batches', id: b.id, name },
        'Không thể xóa lô nhập',
      )
    } finally {
      setBusy(key, false)
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Quản Lý Lô Xe Nhập Khẩu
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Nhập lô tự động bổ chi phí lô (thuế, hải quan, vận chuyển) vào
              từng xe để tính <strong>Giá vốn chính xác</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFilters(true)}
              aria-haspopup="dialog"
              className={`gap-1.5 ${activeFilterCount > 0 ? 'border-emerald-600 text-emerald-800' : ''}`}
            >
              <SlidersHorizontal className="size-4" />
              Bộ lọc
              {activeFilterCount > 0 && (
                <span className="ml-0.5 rounded-full bg-emerald-700 text-white text-[11px] px-1.5">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleExportExcel()}
              disabled={exporting || sorted.length === 0}
              title={`Xuất ${sorted.length} lô theo bộ lọc hiện tại`}
              className="gap-1.5"
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </Button>
            <Can permission="batches.manage">
              <Link to="/batches/new">
                <Button
                  size="sm"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
                >
                  <PackagePlus className="size-4" />
                  Nhập Lô Xe Mới
                </Button>
              </Link>
            </Can>
          </div>
        </div>

        {/* Batches Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh Sách Lô Xe Nhập Khẩu ({filtered.length})
            </CardTitle>
            <div className="text-xs text-slate-500">
              Cài giá bán theo Lô &bull; Không có phiếu nhập kho riêng
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50/70">
<TableHead className="w-12 text-center">STT</TableHead>
                    {sortHead('date', 'Ngày Nhập', '')}
                    {sortHead('supplier', 'Nhà Cung Cấp', '')}
                    {sortHead('loan', 'Khế Ước Vay', '')}
                    {sortHead('vehicles', 'Số Xe', 'text-center')}
                    {sortHead('import', 'Tiền Hàng', 'text-right')}
                    {sortHead('fee', 'Chi Phí Lô', 'text-right')}
                    {sortHead('cost', 'Tổng Giá Vốn Lô', 'text-right')}
                    <TableHead className="text-center">
                      Cách Định Giá Bán
                    </TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {batchesPg.pageItems.map((b, rowIdx) => (
                    <TableRow key={b.id} className="hover:bg-slate-50/80">
<TableCell className="text-center text-muted-foreground">{batchesPg.pageSize * (batchesPg.page - 1) + rowIdx + 1}</TableCell>
                      <TableCell className="text-slate-500">
                        {formatDate(b.importDate)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {b.supplierId && b.supplierName ? (
                          <SupplierLink supplierId={b.supplierId} className="hover:text-emerald-700 hover:underline">
                            {b.supplierName}
                          </SupplierLink>
                        ) : (
                          b.supplierName
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {b.loanContractId && b.loanContractNumber ? (
                          <Link
                            to="/loans/$loanId"
                            params={{ loanId: String(b.loanContractId) }}
                            className="text-purple-900 hover:underline"
                          >
                            {b.loanContractNumber}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium text-slate-900">
                        {b.vehicleCount} xe
                      </TableCell>
                      <TableCell className="text-right text-slate-900">
                        {formatVnd(b.totalImport)}
                      </TableCell>
                      <TableCell className="text-right text-slate-500 font-medium">
                        +{formatVnd(b.totalExpense)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900">
                        {formatVnd(b.totalCost)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-medium"
                        >
                          {b.pricingBase === 'cost_price'
                            ? 'Trên Giá Vốn'
                            : 'Trên Giá Nhập Đã VAT'}{' '}
                          {b.pricingMethod === 'percent'
                            ? `+${b.pricingValue}%`
                            : `+${formatVnd(b.pricingValue)}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="size-7 text-slate-400 hover:text-emerald-700"
                        >
                          <Link
                            to="/batches/$batchId"
                            params={{ batchId: String(b.id) }}
                            preload="intent"
                            aria-label="Xem chi tiết"
                            title="Xem chi tiết"
                          >
                            <Eye className="size-3.5" />
                          </Link>
                        </Button>
                        <Can permission="batches.manage">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(b)}
                            disabled={isBusy(`batches:${b.id}`)}
                            className="size-7 text-slate-400 hover:text-rose-600"
                            aria-label="Xóa"
                            title="Xóa"
                          >
                            <BusyTrash busy={isBusy(`batches:${b.id}`)} />
                          </Button>
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination pagination={batchesPg} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Bộ Lọc Lô Nhập
            </DialogTitle>
            <DialogDescription className="text-xs">
              Kết quả được lọc ngay khi thay đổi ({filtered.length} lô phù hợp)
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Sắp xếp theo</Label>
              <SearchSelect
                className="h-11 w-full text-sm rounded-lg"
                placeholder="Mặc định (mới nhất trước)"
                value={sort ?? 'default'}
                onValueChange={(val) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      sort: val === 'default' ? undefined : (val as SortKey),
                      dir: val === 'default' ? undefined : (prev.dir ?? 'desc'),
                    }),
                    replace: true,
                  })
                }
              >
                <SearchSelectItem value="default">
                  Mặc định (mới nhất trước)
                </SearchSelectItem>
                {SORT_KEYS.map((k) => (
                  <SearchSelectItem key={k} value={k}>
                    {SORT_LABELS[k]}
                  </SearchSelectItem>
                ))}
              </SearchSelect>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Thứ tự</Label>
              <SearchSelect
                className="h-11 w-full text-sm rounded-lg"
                value={dir ?? 'desc'}
                disabled={!sort}
                onValueChange={(val) =>
                  setFilter('dir', val)
                }
              >
                <SearchSelectItem value="asc">
                  Tăng dần (A → Z, thấp → cao, cũ → mới)
                </SearchSelectItem>
                <SearchSelectItem value="desc">
                  Giảm dần (Z → A, cao → thấp, mới → cũ)
                </SearchSelectItem>
              </SearchSelect>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Nhà cung cấp</Label>
              <MultiSearchSelect
                className="h-11 w-full text-sm rounded-lg"
                placeholder="Tất cả nhà cung cấp"
                values={supplier ?? []}
                onValuesChange={(vals) =>
                  setFilter('supplier', vals.length ? vals : undefined)
                }
              >
                {supplierOptions.map((name) => (
                  <SearchSelectItem key={name} value={name}>
                    {name === NO_SUPPLIER ? '(Không có nhà cung cấp)' : name}
                  </SearchSelectItem>
                ))}
              </MultiSearchSelect>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ngày nhập từ</Label>
              <Input
                type="date"
                value={from ?? ''}
                onChange={(e) => setFilter('from', e.target.value || undefined)}
                className="h-11 text-sm px-4 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ngày nhập đến</Label>
              <Input
                type="date"
                value={to ?? ''}
                onChange={(e) => setFilter('to', e.target.value || undefined)}
                className="h-11 text-sm px-4 rounded-lg"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Cách định giá bán</Label>
              <SearchSelect
                className="h-11 w-full text-sm rounded-lg"
                value={base ?? 'all'}
                onValueChange={(val) =>
                  setFilter('base', val === 'all' ? undefined : val)
                }
              >
                <SearchSelectItem value="all">
                  Tất cả
                </SearchSelectItem>
                <SearchSelectItem value="import_price">
                  Trên Giá Nhập Đã VAT
                </SearchSelectItem>
                <SearchSelectItem value="cost_price">
                  Trên Giá Vốn
                </SearchSelectItem>
              </SearchSelect>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Loại chi phí</Label>
              <MultiSearchSelect
                className="h-11 w-full text-sm rounded-lg"
                placeholder="Tất cả loại chi phí"
                values={(feeTypes ?? []).map(String)}
                onValuesChange={(vals) =>
                  setFilter('feeTypes', vals.length ? vals.map(Number) : undefined)
                }
              >
                {feeTypeOptions.map(([id, name]) => (
                  <SearchSelectItem
                    key={id}
                    value={String(id)}
                   
                  >
                    {name}
                  </SearchSelectItem>
                ))}
              </MultiSearchSelect>
            </div>
            <div className="sm:col-span-2">
              <PriceRangeFilter
                label={
                  feeTypes?.length
                    ? 'Số tiền chi phí (tổng các loại đã chọn)'
                    : 'Số tiền chi phí lô (tổng tất cả loại)'
                }
                min={minFee}
                max={maxFee}
                onChange={(lo, hi) =>
                  navigate({
                    search: (prev) => ({ ...prev, minFee: lo, maxFee: hi }),
                    replace: true,
                  })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <PriceRangeFilter
                label="Tổng giá vốn lô"
                min={minCost}
                max={maxCost}
                onChange={(lo, hi) =>
                  navigate({
                    search: (prev) => ({ ...prev, minCost: lo, maxCost: hi }),
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
              disabled={activeFilterCount === 0}
              onClick={() => navigate({ search: () => ({}), replace: true })}
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
    </AppLayout>
  )
}
