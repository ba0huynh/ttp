import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Eye, Plus } from 'lucide-react'

import { Can } from '#/components/auth/Can.tsx'
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
import { currentUserQuery, salesOrdersQuery } from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'

export const Route = createFileRoute('/sales/')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'sales.view')
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.query(salesOrdersQuery())
  },
  component: SalesPage,
})

function SalesPage() {
  const { user } = Route.useRouteContext()
  const { data: orders } = useSuspenseQuery(salesOrdersQuery())
  const ordersPg = usePagination(orders)
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

        {/* Orders Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh Sách Phiếu Bán Xe ({orders.length})
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
                    <TableHead>Ngày Bán</TableHead>
                    <TableHead>Khách Hàng</TableHead>
                    <TableHead>Điểm Bán Nhận Xe</TableHead>
                    <TableHead className="text-right">Tổng Tiền</TableHead>
                    <TableHead className="text-center">Số Xe</TableHead>
                    <TableHead className="text-center">Kho Thực Tế</TableHead>
                    <TableHead className="text-center">Kho Hóa Đơn</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {ordersPg.pageItems.map((o) => (
                    <TableRow key={o.id} className="hover:bg-slate-50/80">
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
                            Trực tiếp KH mẹ
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900">
                        {formatVnd(o.totalAmount)}
                      </TableCell>
                      <TableCell className="text-center font-medium text-slate-900">
                        {o.vehicleCount} xe
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            o.deliveredCount === o.vehicleCount
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                          }`}
                        >
                          {o.deliveredCount === o.vehicleCount
                            ? 'Đã giao đủ'
                            : `Đã giao ${o.deliveredCount}/${o.vehicleCount}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            o.invoicedCount === o.vehicleCount
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {o.invoicedCount === o.vehicleCount
                            ? 'Đã lập HĐ'
                            : `Đã ra HĐ ${o.invoicedCount}/${o.vehicleCount}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-emerald-800 gap-1 font-medium"
                        >
                          <Link
                            to="/sales/$orderId"
                            params={{ orderId: String(o.id) }}
                            preload="intent"
                          >
                            <Eye className="size-3.5" />
                            Xử lý
                          </Link>
                        </Button>
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
    </AppLayout>
  )
}
