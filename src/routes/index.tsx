import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
  ArrowRight,
  Banknote,
  FileText,
  Landmark,
  Warehouse,
} from 'lucide-react'

import {
  DeliveryStatusBadge,
  InvoiceStatusBadge,
} from '#/components/inventory/DualInventoryBadge.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader, StatCard } from '#/components/layout/StatCard.tsx'
import {
  SalesDeliveryBadge,
  SalesInvoiceBadge,
} from '#/components/sales/SalesWarehouseBadges.tsx'
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
import {
  inventorySummaryQuery,
  loansQuery,
  salesOrdersQuery,
  vehiclesQuery,
  currentUserQuery,
} from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) {
      throw redirect({ to: '/login' })
    }
    requirePagePermission(user, 'dashboard.view')
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
        <PageHeader
          eyebrow={`Xin chào, ${user.fullName} · ${user.roleName}`}
          title="Tổng quan"
          description="Dòng tiền, tồn kho 2 lớp (thực tế và hóa đơn) và dư nợ khế ước vay — cập nhật theo thời gian thực."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Tồn kho thực tế"
            icon={Warehouse}
            tone="jade"
            value={inv.physical}
            unit="chiếc"
            hint={
              <>
                Trị giá vốn{' '}
                <strong className="text-slate-700">
                  {formatVnd(inv.physicalValue)}
                </strong>
              </>
            }
          />
          <StatCard
            label="Tồn theo hóa đơn"
            icon={FileText}
            tone="blue"
            value={inv.invoiced}
            unit="chiếc"
            hint={
              <>
                Trị giá vốn{' '}
                <strong className="text-slate-700">
                  {formatVnd(inv.invoicedValue)}
                </strong>
              </>
            }
          />
          <StatCard
            label="Dư nợ vay khế ước"
            icon={Landmark}
            tone="violet"
            value={formatVnd(totalLoanBalance)}
            hint={
              <>
                <strong className="text-slate-700">
                  {loans.filter((l) => l.status === 'active').length}
                </strong>{' '}
                khế ước đang hoạt động
              </>
            }
          />
          <StatCard
            label="Tổng đơn bán"
            icon={Banknote}
            tone="amber"
            value={formatVnd(totalSalesRevenue)}
            hint={
              <>
                <strong className="text-slate-700">{orders.length}</strong>{' '}
                phiếu bán xe đã xác nhận
              </>
            }
          />
        </div>

        {/* 2-Column Section: Newly Imported Vehicles & Recent Wholesale Orders */}
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
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
                      <TableHead>Số Khung</TableHead>
                      <TableHead>Dòng xe / Màu</TableHead>
                      <TableHead className="text-right">Giá Vốn</TableHead>
                      <TableHead className="text-center">Trạng Thái</TableHead>
                      <TableHead className="text-center">Trạng Thái HĐ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {recentVehicles.slice(0, 6).map((v) => (
                      <TableRow key={v.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-medium text-slate-900">
                          {v.chassisNumber}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">
                            {v.modelName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            {v.colorHex && (
                              <span
                                className="size-2.5 rounded-full border border-slate-300 inline-block shrink-0"
                                style={{ backgroundColor: v.colorHex }}
                              />
                            )}
                            {v.colorName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900">
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
                  Đơn Bán Gần Đây
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
                      <TableHead>Ngày Bán</TableHead>
                      <TableHead>Khách Hàng & Điểm Bán</TableHead>
                      <TableHead className="text-right">Tổng Tiền</TableHead>
                      <TableHead className="text-center">Kho Thực Tế</TableHead>
                      <TableHead className="text-center">Kho Hóa Đơn</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {orders.slice(0, 6).map((o) => (
                      <TableRow key={o.id} className="hover:bg-slate-50/80">
                        <TableCell>
                          <Link
                            to="/sales/$orderId"
                            params={{ orderId: String(o.id) }}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            {formatDate(o.orderDate)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900 truncate max-w-[180px]">
                            {o.customerName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {o.branchName
                              ? `ĐB: ${o.branchName}`
                              : 'Trực tiếp'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900">
                          {formatVnd(o.totalAmount)}
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
