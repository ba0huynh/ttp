import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Eye, PackagePlus } from 'lucide-react'
import * as React from 'react'

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
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
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
import { getBatchDetailFn, listBatchesFn } from '#/server/fns/batches.ts'

export const Route = createFileRoute('/batches')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async () => {
    const batches = await listBatchesFn()
    return { batches }
  },
  component: BatchesPage,
})

function BatchesPage() {
  const { user } = Route.useRouteContext()
  const { batches } = Route.useLoaderData()

  const [selectedBatchId, setSelectedBatchId] = React.useState<number | null>(
    null,
  )
  const [detailData, setDetailData] = React.useState<any>(null)
  const [loadingDetail, setLoadingDetail] = React.useState(false)

  const viewDetail = async (id: number) => {
    setSelectedBatchId(id)
    setLoadingDetail(true)
    try {
      const res = await getBatchDetailFn({ data: { id } })
      setDetailData(res)
    } finally {
      setLoadingDetail(false)
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
          <Link to="/batches/new">
            <Button
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
            >
              <PackagePlus className="size-4" />
              Nhập Lô Xe Mới
            </Button>
          </Link>
        </div>

        {/* Batches Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh Sách Lô Xe Nhập Khẩu ({batches.length})
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
                    <TableHead>Mã Lô</TableHead>
                    <TableHead>Ngày Nhập</TableHead>
                    <TableHead>Nhà Cung Cấp</TableHead>
                    <TableHead>Khế Ước Vay</TableHead>
                    <TableHead className="text-center">Số Xe</TableHead>
                    <TableHead className="text-right">Tiền Hàng</TableHead>
                    <TableHead className="text-right">Chi Phí Lô</TableHead>
                    <TableHead className="text-right">
                      Tổng Giá Vốn Lô
                    </TableHead>
                    <TableHead className="text-center">
                      Cách Định Giá Bán
                    </TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {batches.map((b) => (
                    <TableRow key={b.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-mono font-bold text-slate-900">
                        {b.batchCode}
                        {b.customsDeclarationNo && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            TK: {b.customsDeclarationNo}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {formatDate(b.importDate)}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">
                        {b.supplierName}
                      </TableCell>
                      <TableCell>
                        {b.loanContractNumber ? (
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px] bg-purple-50 text-purple-700 border-purple-200"
                          >
                            {b.loanContractNumber}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">Vốn tự có</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold text-slate-900">
                        {b.vehicleCount} xe
                      </TableCell>
                      <TableCell className="text-right text-slate-700">
                        {formatVnd(b.totalImport)}
                      </TableCell>
                      <TableCell className="text-right text-slate-600 font-medium">
                        +{formatVnd(b.totalExpense)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatVnd(b.totalCost)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-medium"
                        >
                          {b.pricingBase === 'cost_price'
                            ? 'Trên Giá Vốn'
                            : 'Trên Giá Nhập'}{' '}
                          {b.pricingMethod === 'percent'
                            ? `+${b.pricingValue}%`
                            : `+${formatVnd(b.pricingValue)}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-emerald-800 gap-1"
                          onClick={() => viewDetail(b.id)}
                        >
                          <Eye className="size-3.5" />
                          Xem chi tiết
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Modal xem chi tiết lô */}
        <Dialog
          open={selectedBatchId !== null}
          onOpenChange={(open) => !open && setSelectedBatchId(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Chi Tiết Lô Xe:</span>
                <span className="font-mono text-emerald-700">
                  {detailData?.batch?.batchCode}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Nhà cung cấp: <strong>{detailData?.batch?.supplierName}</strong>{' '}
                &bull; Ngày nhập: {formatDate(detailData?.batch?.importDate)}
              </DialogDescription>
            </DialogHeader>

            {loadingDetail ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Đang tải dữ liệu lô...
              </div>
            ) : detailData ? (
              <div className="space-y-4 pt-2">
                {/* Chi phí lô */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800">
                    Khoản Chi Phí Lô ({detailData.expenses.length} khoản chi):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {detailData.expenses.map((e: any) => (
                      <div
                        key={e.id}
                        className="p-2 bg-white rounded border border-slate-200"
                      >
                        <div className="text-[11px] text-slate-500 capitalize">
                          {e.expenseType.replace('_', ' ')}
                        </div>
                        <div className="font-bold text-slate-900">
                          {formatVnd(e.amount)}
                        </div>
                        {e.description && (
                          <div className="text-[10px] text-slate-400 truncate">
                            {e.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Danh sách xe trong lô */}
                <div>
                  <div className="text-xs font-bold text-slate-800 mb-2">
                    Danh Sách Xe Trong Lô & Phân Bổ Giá Vốn (
                    {detailData.vehicles.length} chiếc):
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs bg-slate-50">
                          <TableHead>Số Khung (VIN)</TableHead>
                          <TableHead>Số Máy</TableHead>
                          <TableHead>Dòng xe / Màu</TableHead>
                          <TableHead className="text-right">
                            Đơn Giá Nhập
                          </TableHead>
                          <TableHead className="text-right">
                            CP Phân Bổ
                          </TableHead>
                          <TableHead className="text-right">
                            Giá Vốn Xe
                          </TableHead>
                          <TableHead className="text-right">
                            Giá Bán Áp Dụng
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {detailData.vehicles.map((v: any) => (
                          <TableRow key={v.id}>
                            <TableCell className="font-mono font-bold">
                              {v.chassisNumber}
                            </TableCell>
                            <TableCell className="font-mono text-slate-500">
                              {v.engineNumber}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-900">
                                {v.modelName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {v.colorName}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
