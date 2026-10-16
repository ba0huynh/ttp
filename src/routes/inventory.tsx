import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { z } from 'zod'

import { DualInventoryBadge } from '#/components/inventory/DualInventoryBadge.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
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
import { useUrlText } from '#/lib/use-url-text.ts'

const STOCK_FILTERS = [
  'all',
  'physical',
  'invoiced',
  'mismatch',
  'available',
] as const

export const Route = createFileRoute('/inventory')({
  // Filter and search live in the URL (?stock=mismatch&q=...) so a reload or a
  // shared link keeps them; defaults ("all", empty search) are left out
  validateSearch: z.object({
    stock: z.enum(STOCK_FILTERS).optional().catch(undefined),
    q: z.string().optional().catch(undefined),
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

  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()
  const filterStock = searchParams.stock ?? 'all'
  // The box filters instantly; the URL follows once typing pauses
  const [search, setSearch] = useUrlText(searchParams.q ?? '', (q) =>
    navigate({
      search: (prev) => ({ ...prev, q: q || undefined }),
      replace: true,
    }),
  )
  const setFilterStock = (stock: (typeof STOCK_FILTERS)[number]) =>
    navigate({
      search: (prev) => ({
        ...prev,
        stock: stock === 'all' ? undefined : stock,
      }),
      replace: true,
    })

  const filtered = vehicles.filter((v) => {
    const q = search.trim().toLowerCase()
    if (
      q &&
      !v.chassisNumber.toLowerCase().includes(q) &&
      !v.engineNumber.toLowerCase().includes(q) &&
      !v.modelName.toLowerCase().includes(q) &&
      !batchLabel(v).toLowerCase().includes(q)
    ) {
      return false
    }

    if (filterStock === 'physical') {
      return !v.isDelivered
    }
    if (filterStock === 'invoiced') {
      return !v.isInvoiced
    }
    if (filterStock === 'available') {
      return !v.salesOrderId
    }
    if (filterStock === 'mismatch') {
      // Mismatch between the two inventories
      return v.isDelivered !== v.isInvoiced
    }
    return true
  })
  const vehiclesPg = usePagination(filtered, `${search}|${filterStock}`)

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
        </div>

        {/* Filters bar */}
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Search input */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
                <Input
                  placeholder="Tìm theo số khung, số máy, dòng xe..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11 text-sm rounded-lg"
                />
              </div>

              {/* Stock filter tabs */}
              <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
                <Button
                  size="sm"
                  variant={filterStock === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterStock('all')}
                  className={`h-11 rounded-lg text-sm ${filterStock === 'all' ? 'bg-slate-900 text-white' : ''}`}
                >
                  Tất cả ({vehicles.length})
                </Button>
                <Button
                  size="sm"
                  variant={filterStock === 'physical' ? 'default' : 'outline'}
                  onClick={() => setFilterStock('physical')}
                  className={`h-11 rounded-lg text-sm ${filterStock === 'physical' ? 'bg-emerald-700 text-white' : ''}`}
                >
                  Tồn thực tế ({summary.physical})
                </Button>
                <Button
                  size="sm"
                  variant={filterStock === 'invoiced' ? 'default' : 'outline'}
                  onClick={() => setFilterStock('invoiced')}
                  className={`h-11 rounded-lg text-sm ${filterStock === 'invoiced' ? 'bg-blue-700 text-white' : ''}`}
                >
                  Tồn hóa đơn ({summary.invoiced})
                </Button>
                <Button
                  size="sm"
                  variant={filterStock === 'mismatch' ? 'default' : 'outline'}
                  onClick={() => setFilterStock('mismatch')}
                  className={`h-11 rounded-lg text-sm ${filterStock === 'mismatch' ? 'bg-amber-600 text-white' : ''}`}
                >
                  Xe đang lệch 2 kho (
                  {summary.invoicedNotDelivered + summary.deliveredNotInvoiced})
                </Button>
                <Button
                  size="sm"
                  variant={filterStock === 'available' ? 'default' : 'outline'}
                  onClick={() => setFilterStock('available')}
                  className={`h-11 rounded-lg text-sm ${filterStock === 'available' ? 'bg-teal-700 text-white' : ''}`}
                >
                  Chưa bán ({summary.unsold})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicles Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh Sách Chi Tiết Từng Chiếc Xe ({filtered.length} kết quả)
            </CardTitle>
            <div className="text-xs text-slate-500">
              Định danh duy nhất bằng <strong>Số Khung (VIN)</strong>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50/70">
                    <TableHead className="w-[180px]">Số Khung (VIN)</TableHead>
                    <TableHead>Số Máy</TableHead>
                    <TableHead>Dòng xe / Màu</TableHead>
                    <TableHead>Lô Nhập</TableHead>
                    <TableHead className="text-right">Đơn Giá Nhập</TableHead>
                    <TableHead className="text-right">Giá Vốn Xe</TableHead>
                    <TableHead className="text-center">
                      Kho Kép (2 Kho)
                    </TableHead>
                    <TableHead>Đơn Bán</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-slate-500"
                      >
                        Không tìm thấy chiếc xe nào phù hợp bộ lọc
                      </TableCell>
                    </TableRow>
                  ) : (
                    vehiclesPg.pageItems.map((v) => (
                      <TableRow key={v.id} className="hover:bg-slate-50/80">
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
                          {batchLabel(v)}
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatVnd(v.importPrice)}
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatVnd(v.costPrice)}
                        </TableCell>
                        <TableCell className="text-center">
                          <DualInventoryBadge
                            isDelivered={v.isDelivered}
                            isInvoiced={v.isInvoiced}
                            deliveredAt={v.deliveredAt}
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
    </AppLayout>
  )
}
