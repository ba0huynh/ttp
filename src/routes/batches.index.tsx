import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Eye, PackagePlus } from 'lucide-react'

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
import { batchesQuery, currentUserQuery } from '#/lib/queries.ts'
import { deleteBatchFn } from '#/server/fns/batches.ts'
import { confirmDelete, reportDeleteFailure } from '#/lib/usage.ts'
import { useBusyKeys } from '#/lib/use-busy.ts'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import { requirePagePermission } from '#/lib/route-guard.ts'

export const Route = createFileRoute('/batches/')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'batches.view')
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.query(batchesQuery())
  },
  component: BatchesPage,
})

function BatchesPage() {
  const { user } = Route.useRouteContext()
  const { data: batches } = useSuspenseQuery(batchesQuery())
  const batchesPg = usePagination(batches)
  const queryClient = useQueryClient()
  const { isBusy, setBusy } = useBusyKeys()

  const deleteBatch = useMutation({
    mutationFn: deleteBatchFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const handleDelete = async (b: { id: number; importDate: string }) => {
    const key = `batches:${b.id}`
    const name = `Lô nhập ${formatDate(b.importDate)}`
    const ok = await confirmDelete(
      { entity: 'batches', id: b.id, name },
      {
        title: `Xóa "${name}"?`,
        description:
          'Toàn bộ xe và chi phí của lô cũng bị xóa. Không thể hoàn tác.',
      },
      (checking) => setBusy(key, checking),
    )
    if (!ok) return
    setBusy(key, true)
    try {
      await deleteBatch.mutateAsync({ data: { id: b.id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity: 'batches', id: b.id, name },
        'Không thể xóa lô nhập',
      )
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
              Quản Lý Lô Xe Nhập Khẩu
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Nhập lô tự động bổ chi phí lô (thuế, hải quan, vận chuyển) vào
              từng xe để tính <strong>Giá vốn chính xác</strong>.
            </p>
          </div>
          <Can permission="batches.manage">
            <Link to="/batches/new">
              <Button
                size="sm"
                className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
              >
                <PackagePlus className="size-4" />
                Nhập Lô Xe Mới
              </Button>
            </Link>
          </Can>
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
                  {batchesPg.pageItems.map((b) => (
                    <TableRow key={b.id} className="hover:bg-slate-50/80">
                      <TableCell className="text-slate-500">
                        {formatDate(b.importDate)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {b.supplierName}
                      </TableCell>
                      <TableCell>
                        {b.loanContractNumber ? (
                          <Badge
                            variant="outline"
                            className="text-[11px] bg-purple-50 text-purple-700 border-purple-200"
                          >
                            {b.loanContractNumber}
                          </Badge>
                        ) : (
                          <span className="text-slate-500">Vốn tự có</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium text-slate-900">
                        {b.vehicleCount} xe
                      </TableCell>
                      <TableCell className="text-right text-slate-900">
                        {formatVnd(b.totalImport)}
                      </TableCell>
                      <TableCell className="text-right text-slate-500 font-medium">
                        +{formatVnd(b.totalExpense)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900">
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
                      <TableCell className="text-center whitespace-nowrap">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="size-7 text-slate-400 hover:text-emerald-700"
                        >
                          <Link
                            to="/batches/$batchId"
                            params={{ batchId: String(b.id) }}
                            preload="intent"
                            aria-label="Xem chi tiết"
                            title="Xem chi tiết"
                          >
                            <Eye className="size-3.5" />
                          </Link>
                        </Button>
                        <Can permission="batches.manage">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(b)}
                            disabled={isBusy(`batches:${b.id}`)}
                            className="size-7 text-slate-400 hover:text-rose-600"
                            aria-label="Xóa"
                            title="Xóa"
                          >
                            <BusyTrash busy={isBusy(`batches:${b.id}`)} />
                          </Button>
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination pagination={batchesPg} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
