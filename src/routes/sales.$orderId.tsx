import {
  formatErrorMessage,
  confirmDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { ArrowLeft, FileCheck, Truck, XCircle } from 'lucide-react'
import * as React from 'react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader } from '#/components/layout/StatCard.tsx'
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
import {
  TablePagination,
  usePagination,
} from '#/components/ui/table-pagination.tsx'
import { formatDate, formatVnd, todayIso } from '#/lib/business.ts'
import { currentUserQuery, salesOrderDetailQuery } from '#/lib/queries.ts'
import { hasPermission } from '#/lib/permissions.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import {
  cancelSalesOrderFn,
  recordDeliveryFn,
  recordInvoiceFn,
} from '#/server/fns/sales.ts'

export const Route = createFileRoute('/sales/$orderId')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'sales.view')
    return { user }
  },
  loader: async ({ context: { queryClient }, params }) => {
    const id = Number(params.orderId)
    if (!Number.isInteger(id)) throw redirect({ to: '/sales' })
    await queryClient.query(salesOrderDetailQuery(id))
  },
  errorComponent: OrderNotFound,
  component: SalesOrderPage,
})

function OrderNotFound() {
  const { user } = Route.useRouteContext()
  return (
    <AppLayout user={user}>
      <div className="py-16 text-center space-y-3">
        <p className="text-slate-600">Không tìm thấy phiếu bán này.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/sales">
            <ArrowLeft className="size-4" />
            Về danh sách phiếu bán
          </Link>
        </Button>
      </div>
    </AppLayout>
  )
}

function SalesOrderPage() {
  const { user } = Route.useRouteContext()
  const { orderId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(salesOrderDetailQuery(Number(orderId)))
  const { order, items } = data
  const itemsPg = usePagination(items)

  // Delivery / invoicing / cancelling change physical stock, invoiced stock,
  // receivables and the dashboard together, so refresh the whole cache.
  const onSettled = () => queryClient.invalidateQueries()
  const deliveryMutation = useMutation({
    mutationFn: recordDeliveryFn,
    onSuccess: onSettled,
  })
  const invoiceMutation = useMutation({
    mutationFn: recordInvoiceFn,
    onSuccess: onSettled,
  })
  const cancelMutation = useMutation({
    mutationFn: cancelSalesOrderFn,
    onSuccess: onSettled,
  })

  const [deliveryDialogOpen, setDeliveryDialogOpen] = React.useState(false)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = React.useState(false)
  const [selectedVehicles, setSelectedVehicles] = React.useState<number[]>([])
  const [deliveryDate, setDeliveryDate] = React.useState(todayIso())
  const [receiverName, setReceiverName] = React.useState('')
  const [transportInfo, setTransportInfo] = React.useState('')
  const [invoiceDate, setInvoiceDate] = React.useState(todayIso())
  const [invoiceNumber, setInvoiceNumber] = React.useState('')
  const [actionError, setActionError] = React.useState<string | null>(null)
  const actionLoading = deliveryMutation.isPending || invoiceMutation.isPending

  const canDeliver = hasPermission(user, 'sales.deliver')
  const canInvoice = hasPermission(user, 'sales.invoice')
  const canCancel = items.every((i) => !i.isDelivered && !i.isInvoiced)

  const openDeliveryModal = () => {
    // Only vehicles that have NOT been delivered yet
    setSelectedVehicles(
      items.filter((v) => !v.isDelivered).map((v) => v.vehicleId),
    )
    setDeliveryDate(todayIso())
    setReceiverName('')
    setTransportInfo('')
    setActionError(null)
    setDeliveryDialogOpen(true)
  }

  const openInvoiceModal = () => {
    // Only vehicles that have NOT been invoiced yet
    setSelectedVehicles(
      items.filter((v) => !v.isInvoiced).map((v) => v.vehicleId),
    )
    setInvoiceDate(todayIso())
    setInvoiceNumber('')
    setActionError(null)
    setInvoiceDialogOpen(true)
  }

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedVehicles.length === 0) return
    setActionError(null)
    try {
      await deliveryMutation.mutateAsync({
        data: {
          salesOrderId: order.id,
          vehicleIds: selectedVehicles,
          deliveryDate,
          receiverName,
          transportInfo,
        },
      })
      setDeliveryDialogOpen(false)
    } catch (err: unknown) {
      setActionError(formatErrorMessage(err, 'Lỗi khi ghi nhận giao xe'))
    }
  }

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedVehicles.length === 0) return
    setActionError(null)
    try {
      await invoiceMutation.mutateAsync({
        data: {
          salesOrderId: order.id,
          vehicleIds: selectedVehicles,
          invoiceDate,
          invoiceNumber: invoiceNumber || undefined,
        },
      })
      setInvoiceDialogOpen(false)
    } catch (err: unknown) {
      setActionError(formatErrorMessage(err, 'Lỗi khi lập hóa đơn'))
    }
  }

  const handleCancelOrder = async () => {
    if (
      !(await confirmDialog({
        title: 'Hủy phiếu bán xe này?',
        description: 'Các xe sẽ được trả lại trạng thái chưa bán.',
        confirmLabel: 'Hủy phiếu bán',
        cancelLabel: 'Giữ lại',
        destructive: true,
      }))
    )
      return
    try {
      await cancelMutation.mutateAsync({ data: { orderId: order.id } })
      await navigate({ to: '/sales' })
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể hủy phiếu bán')
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={
            <Link
              to="/sales"
              className="inline-flex items-center gap-1 hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Danh sách phiếu bán
            </Link>
          }
          title={`Phiếu bán #${order.id}`}
          description={
            <>
              Khách hàng: <strong>{order.customerName}</strong> · Điểm bán:{' '}
              <strong>{order.branchName ?? 'Trực tiếp KH mẹ'}</strong> · Ngày
              bán: {formatDate(order.orderDate)}
            </>
          }
          actions={
            <>
              {canDeliver && items.some((i) => !i.isDelivered) && (
                <Button size="sm" onClick={openDeliveryModal}>
                  <Truck className="size-4" />
                  Giao xe thực tế
                </Button>
              )}
              {canInvoice && items.some((i) => !i.isInvoiced) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={openInvoiceModal}
                >
                  <FileCheck className="size-4" />
                  Xuất hóa đơn nội bộ
                </Button>
              )}
              {canCancel && hasPermission(user, 'sales.create') && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  disabled={cancelMutation.isPending}
                  onClick={handleCancelOrder}
                >
                  <XCircle className="size-4" />
                  Hủy phiếu bán
                </Button>
              )}
            </>
          }
        />

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh sách xe trong phiếu ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Số Khung (VIN)</TableHead>
                    <TableHead>Dòng xe / Màu</TableHead>
                    <TableHead className="text-right">Đơn Giá Bán</TableHead>
                    <TableHead className="text-center">Kho Thực Tế</TableHead>
                    <TableHead className="text-center">Kho Hóa Đơn</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {itemsPg.pageItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium text-slate-900">
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
                      <TableCell className="text-right font-medium text-slate-900">
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
            <TablePagination pagination={itemsPg} />
          </CardContent>
        </Card>

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
                  className="h-11 text-sm px-4 rounded-lg"
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
                  className="h-11 text-sm px-4 rounded-lg"
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
                  className="h-11 text-sm px-4 rounded-lg"
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
                  className="h-8 text-xs font-semibold"
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
                  className="h-11 text-sm px-4 rounded-lg"
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
                  className="h-11 text-sm px-4 rounded-lg"
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
