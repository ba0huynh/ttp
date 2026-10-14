import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { AlertCircle, Package, Search, Warehouse } from 'lucide-react'
import * as React from 'react'

import { DualInventoryBadge } from '#/components/inventory/DualInventoryBadge.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Badge } from '#/components/ui/badge.tsx'
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
import { formatVnd } from '#/lib/business.ts'
import { getCurrentUserFn } from '#/server/fns/auth.ts'
import {
  getInventorySummaryFn,
  listVehiclesFn,
} from '#/server/fns/inventory.ts'

export const Route = createFileRoute('/inventory')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async () => {
    const [summary, vehicles] = await Promise.all([
      getInventorySummaryFn(),
      listVehiclesFn({ data: { stock: 'all' } }),
    ])
    return { summary, vehicles }
  },
  component: InventoryPage,
})

function InventoryPage() {
  const { user } = Route.useRouteContext()
  const { summary, vehicles } = Route.useLoaderData()

  const [search, setSearch] = React.useState('')
  const [filterStock, setFilterStock] = React.useState<
    'all' | 'physical' | 'invoiced' | 'mismatch' | 'available'
  >('all')

  const filtered = vehicles.filter((v) => {
    const q = search.trim().toLowerCase()
    if (
      q &&
      !v.chassisNumber.toLowerCase().includes(q) &&
      !v.engineNumber.toLowerCase().includes(q) &&
      !v.modelName.toLowerCase().includes(q) &&
      !v.batchCode.toLowerCase().includes(q)
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
      // Có lệch giữa 2 kho
      return v.isDelivered !== v.isInvoiced
    }
    return true
  })

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
          <Link to="/batches/new">
            <Button
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
            >
              <Package className="size-4" />
              Nhập Lô Mới
            </Button>
          </Link>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-slate-200">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-slate-500 font-medium">
                Tổng xe trong hệ thống
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {summary.total}
              </div>
              <div className="text-[11px] text-slate-500">
                Đã nhập khẩu vào kho
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-emerald-800 font-medium flex items-center gap-1">
                <Warehouse className="size-3.5" />
                Tồn Kho Thực Tế
              </div>
              <div className="text-2xl font-black text-emerald-950 mt-1">
                {summary.physical}{' '}
                <span className="text-xs font-normal">xe</span>
              </div>
              <div className="text-[11px] text-emerald-700 truncate">
                Trị giá: {formatVnd(summary.physicalValue)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-blue-800 font-medium flex items-center gap-1">
                <Package className="size-3.5" />
                Tồn Kho Hóa Đơn
              </div>
              <div className="text-2xl font-black text-blue-950 mt-1">
                {summary.invoiced}{' '}
                <span className="text-xs font-normal">xe</span>
              </div>
              <div className="text-[11px] text-blue-700 truncate">
                Trị giá: {formatVnd(summary.invoicedValue)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/40">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-amber-800 font-medium flex items-center gap-1">
                <AlertCircle className="size-3.5" />
                Lệch 2 Kho Bình Thường
              </div>
              <div className="text-2xl font-black text-amber-950 mt-1">
                {summary.invoicedNotDelivered + summary.deliveredNotInvoiced}{' '}
                <span className="text-xs font-normal">xe</span>
              </div>
              <div className="text-[11px] text-amber-700">
                {summary.invoicedNotDelivered} chờ giao &bull;{' '}
                {summary.deliveredNotInvoiced} chờ HĐ
              </div>
            </CardContent>
          </Card>
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
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Stock filter tabs */}
              <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
                <Button
                  size="sm"
                  variant={filterStock === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterStock('all')}
                  className={`h-8 text-xs ${filterStock === 'all' ? 'bg-slate-900 text-white' : ''}`}
                >
                  Tất cả ({vehicles.length})
                </Button>
                <Button
                  size="sm"
                  variant={filterStock === 'physical' ? 'default' : 'outline'}
                  onClick={() => setFilterStock('physical')}
                  className={`h-8 text-xs ${filterStock === 'physical' ? 'bg-emerald-700 text-white' : ''}`}
                >
                  Tồn thực tế ({summary.physical})
                </Button>
                <Button
                  size="sm"
                  variant={filterStock === 'invoiced' ? 'default' : 'outline'}
                  onClick={() => setFilterStock('invoiced')}
                  className={`h-8 text-xs ${filterStock === 'invoiced' ? 'bg-blue-700 text-white' : ''}`}
                >
                  Tồn hóa đơn ({summary.invoiced})
                </Button>
                <Button
                  size="sm"
                  variant={filterStock === 'mismatch' ? 'default' : 'outline'}
                  onClick={() => setFilterStock('mismatch')}
                  className={`h-8 text-xs ${filterStock === 'mismatch' ? 'bg-amber-600 text-white' : ''}`}
                >
                  Xe đang lệch 2 kho (
                  {summary.invoicedNotDelivered + summary.deliveredNotInvoiced})
                </Button>
                <Button
                  size="sm"
                  variant={filterStock === 'available' ? 'default' : 'outline'}
                  onClick={() => setFilterStock('available')}
                  className={`h-8 text-xs ${filterStock === 'available' ? 'bg-teal-700 text-white' : ''}`}
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
                    <TableHead className="text-right">CP Phân Bổ</TableHead>
                    <TableHead className="text-right">Giá Vốn Xe</TableHead>
                    <TableHead className="text-right">Giá Bán Lô</TableHead>
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
                        colSpan={10}
                        className="text-center py-8 text-slate-400"
                      >
                        Không tìm thấy chiếc xe nào phù hợp bộ lọc
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((v) => (
                      <TableRow key={v.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-mono font-bold text-slate-900">
                          {v.chassisNumber}
                        </TableCell>
                        <TableCell className="font-mono text-slate-600">
                          {v.engineNumber}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900">
                            {v.modelName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            {v.colorHex && (
                              <span
                                className="size-2.5 rounded-full inline-block border border-slate-300"
                                style={{ backgroundColor: v.colorHex }}
                              />
                            )}
                            {v.colorName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px]"
                          >
                            {v.batchCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-600">
                          {formatVnd(v.importPrice)}
                        </TableCell>
                        <TableCell className="text-right text-slate-500">
                          +{formatVnd(v.allocatedExpense)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          {formatVnd(v.costPrice)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-800">
                          {formatVnd(v.sellingPrice)}
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
                          {v.orderNumber ? (
                            <Link
                              to="/sales"
                              className="font-mono font-bold text-emerald-700 hover:underline"
                            >
                              {v.orderNumber}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
