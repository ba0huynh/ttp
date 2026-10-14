import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Clock,
  FileText,
  Landmark,
  PackagePlus,
  Plus,
  Warehouse,
} from 'lucide-react'

import { DualInventoryBadge } from '#/components/inventory/DualInventoryBadge.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardDescription,
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
import { formatDate, formatVnd } from '#/lib/business.ts'
import { getCurrentUserFn } from '#/server/fns/auth.ts'
import {
  inventorySummaryQuery,
  loansQuery,
  salesOrdersQuery,
  vehiclesQuery,
} from '#/lib/queries.ts'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.query(inventorySummaryQuery()),
      queryClient.query(salesOrdersQuery()),
      queryClient.query(loansQuery()),
      queryClient.query(vehiclesQuery()),
    ])
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = Route.useRouteContext()
  const { data: inv } = useSuspenseQuery(inventorySummaryQuery())
  const { data: orders } = useSuspenseQuery(salesOrdersQuery())
  const { data: loans } = useSuspenseQuery(loansQuery())
  const { data: recentVehicles } = useSuspenseQuery(vehiclesQuery())

  const totalLoanBalance = loans.reduce((s, l) => s + l.outstanding, 0)
  const totalSalesRevenue = orders.reduce((s, o) => s + o.totalAmount, 0)

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 rounded-2xl shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-700/80 font-medium">
                Kính chào, {user.fullName}
              </span>
              <span className="text-xs text-emerald-200">
                &bull; Vai trò: {user.role.toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Bàn Làm Việc — Tổng Quan Hoạt Động
            </h1>
            <p className="text-xs text-emerald-100 max-w-xl">
              Cập nhật dòng tiền, tồn kho 2 lớp (Thực tế vs Hóa đơn) và khế ước
              vay ngân hàng thời gian thực.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link to="/batches/new">
              <Button
                size="sm"
                className="bg-white text-emerald-950 hover:bg-emerald-50 font-semibold shadow-xs"
              >
                <PackagePlus className="size-4 mr-1.5" />
                Nhập Lô Xe Mới
              </Button>
            </Link>
            <Link to="/sales/new">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs border border-emerald-500"
              >
                <Plus className="size-4 mr-1.5" />
                Lập Phiếu Bán Xe
              </Button>
            </Link>
          </div>
        </div>

        {/* DUAL INDEPENDENT INVENTORY ALERTS (Core Business Rule) */}
        {(inv.invoicedNotDelivered > 0 || inv.deliveredNotInvoiced > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inv.invoicedNotDelivered > 0 && (
              <Alert className="bg-amber-50/90 border-amber-300 text-amber-900">
                <AlertCircle className="size-5 text-amber-600" />
                <AlertTitle className="font-bold text-amber-900 flex items-center justify-between">
                  <span>
                    Kho hóa đơn đã xuất — Xe còn tại kho (
                    {inv.invoicedNotDelivered} xe)
                  </span>
                  <Link to="/inventory">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-amber-800 p-0 h-auto text-xs font-semibold underline"
                    >
                      Chi tiết &rarr;
                    </Button>
                  </Link>
                </AlertTitle>
                <AlertDescription className="text-xs text-amber-700 mt-1">
                  Có <strong>{inv.invoicedNotDelivered} xe</strong> đã xuất hóa
                  đơn nội bộ (để khách làm hồ sơ/thủ tục vay) nhưng xe vật lý
                  vẫn gửi lưu kho Trường Thịnh Phát chờ phương tiện vận chuyển
                  tới nhận.
                </AlertDescription>
              </Alert>
            )}

            {inv.deliveredNotInvoiced > 0 && (
              <Alert className="bg-sky-50/90 border-sky-300 text-sky-900">
                <Clock className="size-5 text-sky-600" />
                <AlertTitle className="font-bold text-sky-900 flex items-center justify-between">
                  <span>
                    Đã giao xe vật lý — Chưa lập hóa đơn (
                    {inv.deliveredNotInvoiced} xe)
                  </span>
                  <Link to="/inventory">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-sky-800 p-0 h-auto text-xs font-semibold underline"
                    >
                      Chi tiết &rarr;
                    </Button>
                  </Link>
                </AlertTitle>
                <AlertDescription className="text-xs text-sky-700 mt-1">
                  Có <strong>{inv.deliveredNotInvoiced} xe</strong> đã bàn giao
                  chở đi cho đại lý nhưng kế toán chưa lập hóa đơn chứng từ xuất
                  bán.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* KPI Cards: Dual Inventory & Finance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Physical Stock */}
          <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
                Tồn Kho Thực Tế
              </CardTitle>
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                <Warehouse className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-slate-900">
                {inv.physical}{' '}
                <span className="text-sm font-normal text-slate-500">
                  chiếc
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Trị giá vốn: <strong>{formatVnd(inv.physicalValue)}</strong>
              </p>
            </CardContent>
          </Card>

          {/* 2. Invoiced Stock */}
          <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
                Tồn Theo Hóa Đơn
              </CardTitle>
              <div className="p-2 rounded-lg bg-blue-100 text-blue-800">
                <FileText className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-slate-900">
                {inv.invoiced}{' '}
                <span className="text-sm font-normal text-slate-500">
                  chiếc
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Trị giá hóa đơn: <strong>{formatVnd(inv.invoicedValue)}</strong>
              </p>
            </CardContent>
          </Card>

          {/* 3. Bank Loan Debt */}
          <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
                Dư Nợ Vay Khế Ước
              </CardTitle>
              <div className="p-2 rounded-lg bg-purple-100 text-purple-800">
                <Landmark className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-purple-950">
                {formatVnd(totalLoanBalance)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Gồm{' '}
                <strong>
                  {loans.filter((l) => l.status === 'active').length}
                </strong>{' '}
                khế ước đang hoạt động
              </p>
            </CardContent>
          </Card>

          {/* 4. Total Wholesale Revenue */}
          <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
                Tổng Đơn Bán Sỉ
              </CardTitle>
              <div className="p-2 rounded-lg bg-teal-100 text-teal-800">
                <Banknote className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-slate-900">
                {formatVnd(totalSalesRevenue)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                <strong>{orders.length}</strong> phiếu bán xe đã xác nhận
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2-Column Section: Newly Imported Vehicles & Recent Wholesale Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Vehicles in warehouse & Dual Inventory status */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Xe Mới Nhập & Trạng Thái 2 Kho
                </CardTitle>
                <CardDescription className="text-xs">
                  Xem nhanh trạng thái xuất kho và hóa đơn từng chiếc xe
                </CardDescription>
              </div>
              <Link to="/inventory">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-emerald-800 gap-1"
                >
                  Xem tất cả ({inv.total}) <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/50">
                      <TableHead>Số Khung (VIN)</TableHead>
                      <TableHead>Dòng xe / Màu</TableHead>
                      <TableHead className="text-right">Giá Vốn</TableHead>
                      <TableHead className="text-center">Kho Kép</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {recentVehicles.slice(0, 6).map((v) => (
                      <TableRow key={v.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-mono font-bold text-slate-900">
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
                        <TableCell className="text-right font-medium text-slate-700">
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Recent Wholesale Orders */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Đơn Bán Sỉ Gần Đây
                </CardTitle>
                <CardDescription className="text-xs">
                  Theo dõi tiến độ giao xe vật lý và lập hóa đơn
                </CardDescription>
              </div>
              <Link to="/sales">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-emerald-800 gap-1"
                >
                  Xem tất cả ({orders.length}){' '}
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/50">
                      <TableHead>Mã Phiếu</TableHead>
                      <TableHead>Khách Hàng & Điểm Bán</TableHead>
                      <TableHead className="text-right">Tổng Tiền</TableHead>
                      <TableHead className="text-center">Tiến Độ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {orders.slice(0, 6).map((o) => (
                      <TableRow key={o.id} className="hover:bg-slate-50/80">
                        <TableCell>
                          <Link
                            to="/sales"
                            className="font-mono font-bold text-emerald-700 hover:underline"
                          >
                            {o.orderNumber}
                          </Link>
                          <div className="text-[11px] text-slate-500">
                            {formatDate(o.orderDate)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900 truncate max-w-[180px]">
                            {o.customerName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {o.branchName
                              ? `ĐB: ${o.branchName}`
                              : 'Khách hàng mẹ'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          {formatVnd(o.totalAmount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col gap-1 items-center">
                            <span className="text-[11px] font-medium text-slate-600">
                              Xe: {o.vehicleCount}
                            </span>
                            <div className="flex items-center gap-1 text-[10px]">
                              <Badge
                                variant="outline"
                                className={`py-0 px-1 ${
                                  o.deliveredCount === o.vehicleCount
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-slate-50 text-slate-600'
                                }`}
                              >
                                Giao {o.deliveredCount}/{o.vehicleCount}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`py-0 px-1 ${
                                  o.invoicedCount === o.vehicleCount
                                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                                    : 'bg-slate-50 text-slate-600'
                                }`}
                              >
                                HĐ {o.invoicedCount}/{o.vehicleCount}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
