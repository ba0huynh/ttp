import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Eye, Pencil, Plus } from 'lucide-react'
import * as React from 'react'

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
import { requirePagePermission } from '#/lib/route-guard.ts'

export const Route = createFileRoute('/sales/')({
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
  const ordersPg = usePagination(orders)
  const { data: customers } = useSuspenseQuery(customerOptionsQuery())
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
