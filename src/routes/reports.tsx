import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import * as React from 'react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardDescription,
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
import { EXPENSE_TYPE_LABELS, formatVnd } from '#/lib/business.ts'
import {
  defaultReportRange,
  reportsQuery,
  currentUserQuery,
} from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'

export const Route = createFileRoute('/reports')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'reports.view')
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    const { from, to } = defaultReportRange()
    await queryClient.query(reportsQuery(from, to))
  },
  component: ReportsPage,
})

function ReportsPage() {
  const { user } = Route.useRouteContext()
  const [range] = React.useState(defaultReportRange)
  const [from, setFrom] = React.useState(range.from)
  const [to, setTo] = React.useState(range.to)
  // Khoảng ngày đã áp dụng; đổi trong transition để giữ nguyên báo cáo cũ
  // trên màn hình trong lúc tải báo cáo mới.
  const [applied, setApplied] = React.useState(range)
  const [loading, startTransition] = React.useTransition()
  const { data: report } = useSuspenseQuery(
    reportsQuery(applied.from, applied.to),
  )
  const customerRevenuePg = usePagination(
    report.revenueByCustomer,
    `${applied.from}|${applied.to}`,
  )
  const modelRevenuePg = usePagination(
    report.revenueByModel,
    `${applied.from}|${applied.to}`,
  )

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(() => setApplied({ from, to }))
  }

  const totalRevenue = report.revenueByCustomer.reduce(
    (s, c) => s + c.revenue,
    0,
  )
  const totalCost = report.revenueByCustomer.reduce((s, c) => s + c.cost, 0)
  const grossProfit = totalRevenue - totalCost
  const marginPercent =
    totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0'

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Báo Cáo & Phân Tích Kinh Doanh
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Doanh thu quy về <strong>Khách hàng Mẹ</strong> &bull; Lợi nhuận
              tính trên Giá vốn đã phân bổ chi phí đầy đủ.
            </p>
          </div>

          {/* Date range filter form */}
          <form onSubmit={handleFilter} className="flex items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 text-xs w-36"
            />
            <span className="text-xs text-slate-400">&rarr;</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 text-xs w-36"
            />
            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
            >
              {loading ? 'Đang lọc...' : 'Áp Dụng'}
            </Button>
          </form>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
                Tổng Doanh Thu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-slate-900">
                {formatVnd(totalRevenue)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Đã chốt xác nhận bán hàng
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-emerald-900 uppercase">
                Lợi Nhuận Gộp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-emerald-950">
                {formatVnd(grossProfit)}
              </div>
              <p className="text-xs text-emerald-700 mt-1">
                Biên lợi nhuận gộp: <strong>{marginPercent}%</strong>
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-purple-900 uppercase">
                Lãi Vay Đã Chi Trả
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-purple-950">
                {formatVnd(report.interestPaid)}
              </div>
              <p className="text-xs text-purple-700 mt-1">
                Tính theo 365 ngày/năm
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-blue-900 uppercase">
                Trị Giá Tồn Kho Thực Tế
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-blue-950">
                {formatVnd(report.inventory.physicalValue)}
              </div>
              <p className="text-xs text-blue-700 mt-1">
                {report.inventory.physical} chiếc xe trong kho
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2 Tables: Revenue by Parent Customer & By Motorcycle Model */}
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
          {/* Table 1: Revenue aggregated to Parent Customer */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800">
                1. Doanh Thu Quy Về Khách Hàng Mẹ
              </CardTitle>
              <CardDescription className="text-xs">
                Quy tắc nghiệp vụ: Tổng hợp toàn bộ điểm bán con về Pháp nhân
                Khách mẹ
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50">
                    <TableHead>Khách Hàng Mẹ</TableHead>
                    <TableHead className="text-center">Số Xe</TableHead>
                    <TableHead className="text-right">Doanh Thu</TableHead>
                    <TableHead className="text-right">Lợi Nhuận</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {customerRevenuePg.pageItems.map((c) => (
                    <TableRow
                      key={c.customerId}
                      className="hover:bg-slate-50/80"
                    >
                      <TableCell className="font-semibold text-slate-900">
                        {c.customerName}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {c.vehicles} xe
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatVnd(c.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-800">
                        {formatVnd(c.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination pagination={customerRevenuePg} />
            </CardContent>
          </Card>

          {/* Table 2: Revenue & Gross Profit by Model */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800">
                2. Doanh Thu & Lợi Nhuận Theo Dòng Xe
              </CardTitle>
              <CardDescription className="text-xs">
                So sánh hiệu quả kinh doanh từng mẫu xe máy nhập khẩu
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50">
                    <TableHead>Dòng Xe</TableHead>
                    <TableHead className="text-center">Đã Bán</TableHead>
                    <TableHead className="text-right">Doanh Thu</TableHead>
                    <TableHead className="text-right">Lợi Nhuận Gộp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {modelRevenuePg.pageItems.map((m, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/80">
                      <TableCell className="font-semibold text-slate-900">
                        {m.modelName}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {m.vehicles} xe
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatVnd(m.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-800">
                        {formatVnd(m.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination pagination={modelRevenuePg} />
            </CardContent>
          </Card>
        </div>

        {/* Table 3: Import expenses breakdown by type */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800">
              3. Cơ Cấu Chi Phí Nhập Khẩu Lô Xe
            </CardTitle>
            <CardDescription className="text-xs">
              Các khoản chi phí cấu thành giá vốn xe (Thuế, cước tàu, lưu kho,
              hải quan)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs bg-slate-50">
                  <TableHead>Khoản Mục Chi Phí</TableHead>
                  <TableHead className="text-right">
                    Tổng Số Tiền Đã Chi
                  </TableHead>
                  <TableHead className="text-right">Tỉ Trọng Chi Phí</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {(() => {
                  const totalExp = report.expensesByType.reduce(
                    (s, e) => s + e.total,
                    0,
                  )
                  return report.expensesByType.map((e, idx) => {
                    const pct =
                      totalExp > 0
                        ? ((e.total / totalExp) * 100).toFixed(1)
                        : '0'
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold text-slate-900">
                          {EXPENSE_TYPE_LABELS[e.expenseType] ?? e.expenseType}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          {formatVnd(e.total)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-slate-600">
                          {pct}%
                        </TableCell>
                      </TableRow>
                    )
                  })
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
