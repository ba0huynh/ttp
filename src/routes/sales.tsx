import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Eye, FileCheck, Plus, Truck, XCircle } from 'lucide-react'
import * as React from 'react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx'
import { formatDate, formatVnd, todayIso } from '#/lib/business.ts'
import { getCurrentUserFn } from '#/server/fns/auth.ts'
import {
  cancelSalesOrderFn,
  getSalesOrderDetailFn,
  listSalesOrdersFn,
  recordDeliveryFn,
  recordInvoiceFn,
} from '#/server/fns/sales.ts'

export const Route = createFileRoute('/sales')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async () => {
    const orders = await listSalesOrdersFn()
    return { orders }
  },
  component: SalesPage,
})

function SalesPage() {
  const { user } = Route.useRouteContext()
  const { orders } = Route.useLoaderData()

  const [selectedOrderId, setSelectedOrderId] = React.useState<number | null>(
    null,
  )
  const [orderDetail, setOrderDetail] = React.useState<any>(null)
  const [loadingDetail, setLoadingDetail] = React.useState(false)

  // Dialog action state
  const [deliveryDialogOpen, setDeliveryDialogOpen] = React.useState(false)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = React.useState(false)
  const [selectedVehicles, setSelectedVehicles] = React.useState<number[]>([])

  // Form states
  const [deliveryDate, setDeliveryDate] = React.useState(todayIso())
  const [receiverName, setReceiverName] = React.useState('')
  const [transportInfo, setTransportInfo] = React.useState('')
  const [invoiceDate, setInvoiceDate] = React.useState(todayIso())
  const [invoiceNumber, setInvoiceNumber] = React.useState('')
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [actionLoading, setActionLoading] = React.useState(false)

  const viewDetail = async (id: number) => {
    setSelectedOrderId(id)
    setLoadingDetail(true)
    try {
      const res = await getSalesOrderDetailFn({ data: { id } })
      setOrderDetail(res)
    } finally {
      setLoadingDetail(false)
    }
  }

  const openDeliveryModal = (vList: any[]) => {
    // Only select vehicles that have NOT been delivered yet
    const undelivered = vList
      .filter((v) => !v.isDelivered)
      .map((v) => v.vehicleId)
    setSelectedVehicles(undelivered)
    setDeliveryDate(todayIso())
    setReceiverName('')
    setTransportInfo('')
    setActionError(null)
    setDeliveryDialogOpen(true)
  }

  const openInvoiceModal = (vList: any[]) => {
    // Only select vehicles that have NOT been invoiced yet
    const uninvoiced = vList
      .filter((v) => !v.isInvoiced)
      .map((v) => v.vehicleId)
    setSelectedVehicles(uninvoiced)
    setInvoiceDate(todayIso())
    setInvoiceNumber('')
    setActionError(null)
    setInvoiceDialogOpen(true)
  }

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrderId || selectedVehicles.length === 0) return
    setActionLoading(true)
    setActionError(null)
    try {
      await recordDeliveryFn({
        data: {
          salesOrderId: selectedOrderId,
          vehicleIds: selectedVehicles,
          deliveryDate,
          receiverName,
          transportInfo,
        },
      })
      setDeliveryDialogOpen(false)
      await viewDetail(selectedOrderId)
      window.location.reload()
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Lỗi khi ghi nhận giao xe')
    } finally {
      setActionLoading(false)
    }
  }

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrderId || selectedVehicles.length === 0) return
    setActionLoading(true)
    setActionError(null)
    try {
      await recordInvoiceFn({
        data: {
          salesOrderId: selectedOrderId,
          vehicleIds: selectedVehicles,
          invoiceDate,
          invoiceNumber: invoiceNumber || undefined,
        },
      })
      setInvoiceDialogOpen(false)
      await viewDetail(selectedOrderId)
      window.location.reload()
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Lỗi khi lập hóa đơn')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelOrder = async (orderId: number) => {
    if (
      !confirm(
        'Bạn có chắc chắn muốn hủy phiếu bán xe này? Các xe sẽ được trả lại trạng thái chưa bán.',
      )
    )
      return
    try {
      await cancelSalesOrderFn({ data: { orderId } })
      window.location.reload()
    } catch (err: unknown) {
      alert((err as Error).message || 'Không thể hủy phiếu bán')
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Bán Hàng & Xuất Xe Sỉ
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Giao xe thực tế (giảm tồn kho vật lý) và Xuất hóa đơn nội bộ (giảm
              tồn kho hóa đơn) là <strong>2 nghiệp vụ độc lập</strong>.
            </p>
          </div>
          <Link to="/sales/new">
            <Button
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
            >
              <Plus className="size-4" />
              Lập Phiếu Bán Xe
            </Button>
          </Link>
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
                    <TableHead>Mã Phiếu</TableHead>
                    <TableHead>Ngày Bán</TableHead>
                    <TableHead>Khách Hàng Mẹ</TableHead>
                    <TableHead>Điểm Bán Nhận Xe</TableHead>
                    <TableHead className="text-right">Tổng Tiền</TableHead>
                    <TableHead className="text-center">Số Xe</TableHead>
                    <TableHead className="text-center">Kho Thực Tế</TableHead>
                    <TableHead className="text-center">Kho Hóa Đơn</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {orders.map((o) => (
                    <TableRow key={o.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-mono font-bold text-emerald-800">
                        {o.orderNumber}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {formatDate(o.orderDate)}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {o.customerName}
                      </TableCell>
                      <TableCell>
                        {o.branchName ? (
                          <span className="text-slate-700 font-medium">
                            {o.branchName}
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            Trực tiếp KH mẹ
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatVnd(o.totalAmount)}
                      </TableCell>
                      <TableCell className="text-center font-bold text-slate-800">
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
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-emerald-800 gap-1 font-medium"
                          onClick={() => viewDetail(o.id)}
                        >
                          <Eye className="size-3.5" />
                          Xử lý
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Order detail modal & Delivery / Invoice execution */}
        <Dialog
          open={selectedOrderId !== null}
          onOpenChange={(open) => !open && setSelectedOrderId(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
                <span>
                  Phiếu Bán Xe:{' '}
                  <span className="font-mono text-emerald-700">
                    {orderDetail?.order?.orderNumber}
                  </span>
                </span>
                <span className="text-base text-slate-900 font-bold">
                  {formatVnd(orderDetail?.order?.totalAmount)}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Khách hàng: <strong>{orderDetail?.order?.customerName}</strong>{' '}
                &bull; Điểm bán:{' '}
                <strong>
                  {orderDetail?.order?.branchName ?? 'Trực tiếp KH mẹ'}
                </strong>
              </DialogDescription>
            </DialogHeader>

            {loadingDetail ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Đang tải chi tiết phiếu bán...
              </div>
            ) : orderDetail ? (
              <div className="space-y-4 pt-2">
                {/* Quick actions */}
                <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-xs font-semibold text-slate-700 mr-auto">
                    Thao tác độc lập:
                  </div>

                  {orderDetail.items.some((i: any) => !i.isDelivered) && (
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
                      onClick={() => openDeliveryModal(orderDetail.items)}
                    >
                      <Truck className="size-3.5" />
                      Giao Xe Thực Tế
                    </Button>
                  )}

                  {orderDetail.items.some((i: any) => !i.isInvoiced) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-blue-400 text-blue-700 hover:bg-blue-50 gap-1.5"
                      onClick={() => openInvoiceModal(orderDetail.items)}
                    >
                      <FileCheck className="size-3.5" />
                      Xuất Hóa Đơn Nội Bộ
                    </Button>
                  )}

                  {orderDetail.items.every(
                    (i: any) => !i.isDelivered && !i.isInvoiced,
                  ) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-rose-600 hover:bg-rose-50 gap-1"
                      onClick={() => handleCancelOrder(orderDetail.order.id)}
                    >
                      <XCircle className="size-3.5" />
                      Hủy Phiếu Bán
                    </Button>
                  )}
                </div>

                {/* Vehicles list in order */}
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs bg-slate-50">
                        <TableHead>Số Khung (VIN)</TableHead>
                        <TableHead>Dòng xe / Màu</TableHead>
                        <TableHead className="text-right">
                          Đơn Giá Bán
                        </TableHead>
                        <TableHead className="text-center">
                          Kho Thực Tế
                        </TableHead>
                        <TableHead className="text-center">
                          Kho Hóa Đơn
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {orderDetail.items.map((i: any) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-mono font-bold text-slate-900">
                            {i.chassisNumber}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-900">
                              {i.modelName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {i.colorName}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-900">
                            {formatVnd(i.unitPrice)}
                          </TableCell>
                          <TableCell className="text-center">
                            {i.isDelivered ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px]"
                              >
                                Đã giao ({formatDate(i.deliveredAt)})
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-300 text-[11px]"
                              >
                                Còn trong kho thực tế
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {i.isInvoiced ? (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-300 text-[11px]"
                              >
                                Đã ra HĐ ({formatDate(i.invoicedAt)})
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-slate-100 text-slate-600 text-[11px]"
                              >
                                Chưa xuất HĐ
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Physical Vehicle Delivery Modal */}
        <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Truck className="size-4 text-emerald-600" />
                Lập Phiếu Giao Xe Thực Tế
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ghi nhận thời điểm xe rời kho vật lý giao cho tài xế/khách hàng.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleDeliverySubmit} className="space-y-3 pt-2">
              {actionError && (
                <Alert variant="destructive" className="text-xs py-2">
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Ngày Giao Hàng *
                </Label>
                <Input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Tên Người/Tài Xế Nhận Xe
                </Label>
                <Input
                  placeholder="Ví dụ: Anh Nam (Lái xe đại lý)"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Thông Tin Phương Tiện / Biển Số Xe Tải
                </Label>
                <Input
                  placeholder="Ví dụ: Xe lồng biển số 51C-123.45"
                  value={transportInfo}
                  onChange={(e) => setTransportInfo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="text-xs font-semibold text-slate-700 pt-2">
                Số lượng xe xuất kho thực tế:{' '}
                <strong>{selectedVehicles.length} chiếc</strong>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeliveryDialogOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {actionLoading ? 'Đang lưu...' : 'Xác Nhận Xuất Kho Giao Xe'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Internal Commercial Invoice Modal */}
        <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <FileCheck className="size-4 text-blue-600" />
                Lập Hóa Đơn Xuất Bán Nội Bộ
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ghi nhận giảm kho hóa đơn và phát sinh công nợ phải thu cho pháp
                nhân nhận xe.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleInvoiceSubmit} className="space-y-3 pt-2">
              {actionError && (
                <Alert variant="destructive" className="text-xs py-2">
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Ngày Xuất Hóa Đơn *
                </Label>
                <Input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Số Hóa Đơn (Tự sinh nếu để trống)
                </Label>
                <Input
                  placeholder="Ví dụ: HD-260120-001"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="text-xs font-semibold text-slate-700 pt-2">
                Số lượng xe lập hóa đơn:{' '}
                <strong>{selectedVehicles.length} chiếc</strong>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoiceDialogOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  size="sm"
                  className="h-8 text-xs bg-blue-700 hover:bg-blue-800 text-white font-semibold"
                >
                  {actionLoading ? 'Đang lưu...' : 'Xác Nhận Xuất Hóa Đơn'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
