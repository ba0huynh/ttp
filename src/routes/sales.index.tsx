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
  Eye,
  Pencil,
  Plus,
  SlidersHorizontal,
} from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

import { Can } from '#/components/auth/Can.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import {
  SalesDeliveryBadge,
  SalesInvoiceBadge,
} from '#/components/sales/SalesWarehouseBadges.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
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
  currentUserQuery,
  customerOptionsQuery,
  salesOrdersQuery,
} from '#/lib/queries.ts'
import { cancelSalesOrderFn, updateSalesOrderFn } from '#/server/fns/sales.ts'
import {
  confirmDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import { useBusyKeys } from '#/lib/use-busy.ts'
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
import { requirePagePermission } from '#/lib/route-guard.ts'

const PROGRESS = ['none', 'partial', 'full'] as const
type Progress = (typeof PROGRESS)[number]
const DIRECT_BRANCH = 'none'

const SORT_KEYS = ['date', 'customer', 'branch', 'amount', 'vehicles'] as const
type SortKey = (typeof SORT_KEYS)[number]
const SORT_LABELS: Record<SortKey, string> = {
  date: 'Ngày bán',
  customer: 'Khách hàng',
  branch: 'Điểm bán nhận xe',
  amount: 'Tổng tiền đã VAT',
  vehicles: 'Số xe',
}
const SORT_VALUE: Record<
  SortKey,
  (o: {
    orderDate: string
    customerName: string
    branchName: string | null
    totalAmount: number
    totalBeforeVat: number
    minVatRate: number
    maxVatRate: number
    vehicleCount: number
  }) => number | string
> = {
  date: (o) => String(o.orderDate),
  customer: (o) => o.customerName,
  branch: (o) => o.branchName ?? '',
  amount: (o) => o.totalAmount,
  vehicles: (o) => o.vehicleCount,
}

/** How many of an order's vehicles have been delivered / invoiced */
function progressOf(done: number, total: number): Progress {
  if (total > 0 && done === total) return 'full'
  return done === 0 ? 'none' : 'partial'
}

export const Route = createFileRoute('/sales/')({
  // Filters live in the URL so a reload or shared link keeps them
  validateSearch: z.object({
    customer: z.array(z.number().int()).optional().catch(undefined),
    branch: z.array(z.string()).optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    delivery: z.array(z.enum(PROGRESS)).optional().catch(undefined),
    invoice: z.array(z.enum(PROGRESS)).optional().catch(undefined),
    minAmount: z.number().optional().catch(undefined),
    maxAmount: z.number().optional().catch(undefined),
    sort: z.enum(SORT_KEYS).optional().catch(undefined),
    dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'sales.view')
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.query(salesOrdersQuery()),
      queryClient.query(customerOptionsQuery()),
    ])
  },
  component: SalesPage,
})

function SalesPage() {
  const { user } = Route.useRouteContext()
  const { data: orders } = useSuspenseQuery(salesOrdersQuery())
  const { data: customers } = useSuspenseQuery(customerOptionsQuery())

  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()
  const [showFilters, setShowFilters] = React.useState(false)
  const {
    customer,
    branch,
    from,
    to,
    delivery,
    invoice,
    minAmount,
    maxAmount,
    sort,
    dir,
  } = searchParams
  const setFilter = (
    key:
      | 'customer'
      | 'branch'
      | 'from'
      | 'to'
      | 'delivery'
      | 'invoice'
      | 'dir',
    value: string | string[] | number[] | undefined,
  ) =>
    navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: true })

  // Every customer / receiving branch, not only those already on an order
  const customerOptions = customers.map((c) => [c.id, c.name] as const)
  const branchOptions = [
    [DIRECT_BRANCH, 'Trực tiếp'] as const,
    ...customers.flatMap((c) =>
      c.branches.map((b) => [String(b.id), `${b.name} (${c.name})`] as const),
    ),
  ]
  const progressLabels: Record<Progress, [string, string]> = {
    none: ['Chưa giao', 'Chưa ra HĐ'],
    partial: ['Giao một phần', 'Ra HĐ một phần'],
    full: ['Đã giao đủ', 'Đã lập HĐ đủ'],
  }

  const activeFilterCount = [
    Boolean(customer?.length),
    Boolean(branch?.length),
    Boolean(from || to),
    Boolean(delivery?.length),
    Boolean(invoice?.length),
    minAmount !== undefined || maxAmount !== undefined,
  ].filter(Boolean).length

  const filtered = orders.filter((o) => {
    if (customer?.length && !customer.includes(o.customerId)) return false
    if (
      branch?.length &&
      !branch.includes(o.branchId ? String(o.branchId) : DIRECT_BRANCH)
    )
      return false
    const date = String(o.orderDate).slice(0, 10)
    if (from && date < from) return false
    if (to && date > to) return false
    if (
      delivery?.length &&
      !delivery.includes(progressOf(o.deliveredCount, o.vehicleCount))
    )
      return false
    if (
      invoice?.length &&
      !invoice.includes(progressOf(o.invoicedCount, o.vehicleCount))
    )
      return false
    if (minAmount !== undefined && o.totalAmount < minAmount) return false
    if (maxAmount !== undefined && o.totalAmount > maxAmount) return false
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
  const ordersPg = usePagination(
    sorted,
    `${customer?.join()}|${branch?.join()}|${from}|${to}|${delivery?.join()}|${invoice?.join()}|${minAmount}|${maxAmount}|${sort}|${dir}`,
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

  const updateOrder = useMutation({
    mutationFn: updateSalesOrderFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const cancelOrder = useMutation({
    mutationFn: cancelSalesOrderFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  // Edit header: date, customer, branch (only while nothing was delivered / invoiced)
  const [edit, setEdit] = React.useState<{
    id: number
    date: string
    customerId: number
    branchId: number | null
  } | null>(null)
  const editBranches =
    customers.find((c) => c.id === edit?.customerId)?.branches ?? []

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    try {
      await updateOrder.mutateAsync({
        data: {
          orderId: edit.id,
          orderDate: edit.date,
          customerId: edit.customerId,
          branchId: edit.branchId,
        },
      })
      setEdit(null)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi sửa phiếu bán')
    }
  }

  const handleCancel = async (o: { id: number; customerName: string }) => {
    const ok = await confirmDialog({
      title: 'Hủy phiếu bán xe này?',
      description: `${o.customerName}. Các xe sẽ được trả lại trạng thái chưa bán.`,
      confirmLabel: 'Hủy phiếu bán',
      cancelLabel: 'Giữ lại',
      destructive: true,
    })
    if (!ok) return
    const key = `order:${o.id}`
    setBusy(key, true)
    try {
      await cancelOrder.mutateAsync({ data: { orderId: o.id } })
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể hủy phiếu bán')
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
              Bán Hàng
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Giao xe thực tế (giảm tồn kho vật lý) và Xuất hóa đơn nội bộ (giảm
              tồn kho hóa đơn) là <strong>2 nghiệp vụ độc lập</strong>.
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
            <Can permission="sales.create">
              <Link to="/sales/new">
                <Button
                  size="sm"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
                >
                  <Plus className="size-4" />
                  Lập Phiếu Bán Xe
                </Button>
              </Link>
            </Can>
          </div>
        </div>

        {/* Orders Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh Sách Phiếu Bán Xe ({filtered.length})
            </CardTitle>
            <div className="text-xs text-slate-500">
              Chặn bán trùng số khung tuyệt đối
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50/70">
<TableHead className="w-12 text-center">STT</TableHead>
                    {sortHead('date', 'Ngày Bán', '')}
                    {sortHead('customer', 'Khách Hàng', '')}
                    {sortHead('branch', 'Điểm Bán Nhận Xe', '')}
                    <TableHead className="text-right">
                      Tổng Tiền Chưa VAT
                    </TableHead>
                    <TableHead className="text-center">% VAT</TableHead>
                    {sortHead('amount', 'Tổng Tiền Đã VAT', 'text-right')}
                    {sortHead('vehicles', 'Số Xe', 'text-center')}
                    <TableHead className="text-center">Kho Thực Tế</TableHead>
                    <TableHead className="text-center">Kho Hóa Đơn</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {ordersPg.pageItems.map((o, rowIdx) => (
                    <TableRow key={o.id} className="hover:bg-slate-50/80">
<TableCell className="text-center text-muted-foreground">{ordersPg.pageSize * (ordersPg.page - 1) + rowIdx + 1}</TableCell>
                      <TableCell className="text-slate-500">
                        {formatDate(o.orderDate)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {o.customerName}
                      </TableCell>
                      <TableCell>
                        {o.branchName ? (
                          <span className="text-slate-900 font-medium">
                            {o.branchName}
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            Trực tiếp
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-slate-900">
                        {formatVnd(o.totalBeforeVat)}
                      </TableCell>
                      <TableCell className="text-center text-slate-500">
                        {/* Rates are per vehicle: show a range when they differ */}
                        {o.minVatRate === o.maxVatRate
                          ? `${o.minVatRate}%`
                          : `${o.minVatRate}–${o.maxVatRate}%`}
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900">
                        {formatVnd(o.totalAmount)}
                      </TableCell>
                      <TableCell className="text-center font-medium text-slate-900">
                        {o.vehicleCount} xe
                      </TableCell>
                      <TableCell className="text-center">
                        <SalesDeliveryBadge
                          deliveredCount={o.deliveredCount}
                          vehicleCount={o.vehicleCount}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <SalesInvoiceBadge
                          invoicedCount={o.invoicedCount}
                          vehicleCount={o.vehicleCount}
                        />
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="size-7 text-slate-400 hover:text-emerald-700"
                        >
                          <Link
                            to="/sales/$orderId"
                            params={{ orderId: String(o.id) }}
                            preload="intent"
                            aria-label="Xử lý phiếu bán"
                            title="Xử lý phiếu bán"
                          >
                            <Eye className="size-3.5" />
                          </Link>
                        </Button>
                        <Can permission="sales.create">
                          {o.status !== 'cancelled' &&
                            o.deliveredCount === 0 &&
                            o.invoicedCount === 0 && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setEdit({
                                      id: o.id,
                                      date: o.orderDate,
                                      customerId: o.customerId,
                                      branchId: o.branchId,
                                    })
                                  }
                                  className="size-7 text-slate-400 hover:text-emerald-700"
                                  aria-label="Sửa"
                                  title="Sửa phiếu bán"
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isBusy(`order:${o.id}`)}
                                  onClick={() => handleCancel(o)}
                                  className="size-7 text-slate-400 hover:text-rose-600"
                                  aria-label="Hủy phiếu bán"
                                  title="Hủy phiếu bán"
                                >
                                  <BusyTrash busy={isBusy(`order:${o.id}`)} />
                                </Button>
                              </>
                            )}
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination pagination={ordersPg} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Bộ Lọc Phiếu Bán
            </DialogTitle>
            <DialogDescription className="text-xs">
              Kết quả được lọc ngay khi thay đổi ({filtered.length} phiếu phù
              hợp)
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
                onValueChange={(val) => setFilter('dir', val)}
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
              <Label className="text-xs font-semibold">Khách hàng</Label>
              <MultiSearchSelect
                className="h-11 w-full text-sm rounded-lg"
                placeholder="Tất cả khách hàng"
                values={(customer ?? []).map(String)}
                onValuesChange={(vals) =>
                  setFilter('customer', vals.length ? vals.map(Number) : undefined)
                }
              >
                {customerOptions.map(([id, name]) => (
                  <SearchSelectItem
                    key={id}
                    value={String(id)}
                   
                  >
                    {name}
                  </SearchSelectItem>
                ))}
              </MultiSearchSelect>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Điểm bán nhận xe</Label>
              <MultiSearchSelect
                className="h-11 w-full text-sm rounded-lg"
                placeholder="Tất cả điểm bán"
                values={branch ?? []}
                onValuesChange={(vals) =>
                  setFilter('branch', vals.length ? vals : undefined)
                }
              >
                {branchOptions.map(([id, name]) => (
                  <SearchSelectItem key={id} value={id}>
                    {name}
                  </SearchSelectItem>
                ))}
              </MultiSearchSelect>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ngày bán từ</Label>
              <Input
                type="date"
                value={from ?? ''}
                onChange={(e) => setFilter('from', e.target.value || undefined)}
                className="h-11 text-sm px-4 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ngày bán đến</Label>
              <Input
                type="date"
                value={to ?? ''}
                onChange={(e) => setFilter('to', e.target.value || undefined)}
                className="h-11 text-sm px-4 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Kho thực tế (giao xe)</Label>
              <MultiSearchSelect
                className="h-11 w-full text-sm rounded-lg"
                placeholder="Tất cả"
                values={delivery ?? []}
                onValuesChange={(vals) =>
                  setFilter('delivery', vals.length ? vals : undefined)
                }
              >
                {PROGRESS.map((p) => (
                  <SearchSelectItem key={p} value={p}>
                    {progressLabels[p][0]}
                  </SearchSelectItem>
                ))}
              </MultiSearchSelect>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Kho hóa đơn</Label>
              <MultiSearchSelect
                className="h-11 w-full text-sm rounded-lg"
                placeholder="Tất cả"
                values={invoice ?? []}
                onValuesChange={(vals) =>
                  setFilter('invoice', vals.length ? vals : undefined)
                }
              >
                {PROGRESS.map((p) => (
                  <SearchSelectItem key={p} value={p}>
                    {progressLabels[p][1]}
                  </SearchSelectItem>
                ))}
              </MultiSearchSelect>
            </div>
            <div className="sm:col-span-2">
              <PriceRangeFilter
                label="Tổng tiền đã VAT"
                min={minAmount}
                max={maxAmount}
                onChange={(lo, hi) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      minAmount: lo,
                      maxAmount: hi,
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

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Sửa Phiếu Bán Xe
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <form onSubmit={handleSave} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Ngày Lập Phiếu *
                </Label>
                <Input
                  type="date"
                  required
                  value={edit.date}
                  onChange={(e) => setEdit({ ...edit, date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Khách Hàng *</Label>
                <SearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  value={String(edit.customerId)}
                  onValueChange={(v) =>
                    setEdit({ ...edit, customerId: Number(v), branchId: null })
                  }
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
                  Điểm Bán Nhận Xe
                </Label>
                <SearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  value={edit.branchId ? String(edit.branchId) : 'none'}
                  onValueChange={(v) =>
                    setEdit({
                      ...edit,
                      branchId: v === 'none' ? null : Number(v),
                    })
                  }
                >
                  <SearchSelectItem value="none">
                    Trực tiếp khách hàng (không qua điểm bán)
                  </SearchSelectItem>
                  {editBranches.map((b) => (
                    <SearchSelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SearchSelectItem>
                  ))}
                </SearchSelect>
              </div>
              <p className="text-[11px] text-slate-500">
                Danh sách xe và giá không đổi ở đây: muốn đổi xe, hãy hủy phiếu
                và lập lại.
              </p>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEdit(null)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={updateOrder.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {updateOrder.isPending ? 'Đang lưu...' : 'Lưu'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
