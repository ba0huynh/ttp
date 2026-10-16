import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import { confirmDelete, reportDeleteFailure } from '#/lib/usage.ts'
import { useBusyKeys } from '#/lib/use-busy.ts'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Eye, Pencil, Plus } from 'lucide-react'
import * as React from 'react'

import { Can } from '#/components/auth/Can.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { showErrorDialog } from '#/components/ui/confirm-dialog.tsx'
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
import { formatVnd } from '#/lib/business.ts'
import { customersQuery, currentUserQuery } from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import { deleteCustomerFn, saveCustomerFn } from '#/server/fns/customers.ts'

export const Route = createFileRoute('/customers/')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'customers.view')
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.query(customersQuery())
  },
  component: CustomersPage,
})

function CustomersPage() {
  const { user } = Route.useRouteContext()
  const { data: customers } = useSuspenseQuery(customersQuery())
  const customersPg = usePagination(customers)
  const queryClient = useQueryClient()

  // Create Parent Customer Modal
  const [newCustOpen, setNewCustOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [editId, setEditId] = React.useState<number | null>(null)
  const { isBusy, setBusy } = useBusyKeys()

  // Mọi thay đổi khách hàng/điểm bán ảnh hưởng danh sách, chi tiết và công nợ
  const saveCustomer = useMutation({
    mutationFn: saveCustomerFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const deleteCustomer = useMutation({
    mutationFn: deleteCustomerFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const handleDelete = async (c: { id: number; name: string }) => {
    const key = `customers:${c.id}`
    const ok = await confirmDelete(
      { entity: 'customers', id: c.id, name: c.name },
      {
        title: `Xóa khách hàng "${c.name}"?`,
        description:
          'Các điểm bán của khách hàng cũng bị xóa. Không thể hoàn tác.',
      },
      (checking) => setBusy(key, checking),
    )
    if (!ok) return
    setBusy(key, true)
    try {
      await deleteCustomer.mutateAsync({ data: { id: c.id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity: 'customers', id: c.id, name: c.name },
        'Không thể xóa khách hàng',
      )
    } finally {
      setBusy(key, false)
    }
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveCustomer.mutateAsync({
        data: {
          id: editId ?? undefined,
          name,
        },
      })
      setNewCustOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu khách hàng')
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Khách Hàng & Điểm Bán
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Doanh thu tính theo <strong>khách hàng</strong> &bull; Hóa đơn và
              công nợ ghi theo <strong>điểm bán</strong> nhận xe.
            </p>
          </div>
          <Can permission="customers.manage">
            <Button
              size="sm"
              onClick={() => {
                setEditId(null)
                setName('')
                setNewCustOpen(true)
              }}
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
            >
              <Plus className="size-4" />
              Thêm Khách Hàng
            </Button>
          </Can>
        </div>

        {/* Customers Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh Sách Khách Hàng ({customers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50/70">
                    <TableHead>Tên Khách Hàng</TableHead>
                    <TableHead className="text-center">Số Điểm Bán</TableHead>
                    <TableHead className="text-right">Còn Nợ</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {customersPg.pageItems.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {c.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold"
                        >
                          {c.branchCount} điểm bán
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-rose-900">
                        {formatVnd(c.balance)}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="size-7 text-slate-400 hover:text-emerald-700"
                        >
                          <Link
                            to="/customers/$customerId"
                            params={{ customerId: String(c.id) }}
                            preload="intent"
                            aria-label="Xem chi tiết"
                            title="Xem chi tiết"
                          >
                            <Eye className="size-3.5" />
                          </Link>
                        </Button>
                        <Can permission="customers.manage">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditId(c.id)
                              setName(c.name)
                              setNewCustOpen(true)
                            }}
                            className="size-7 text-slate-400 hover:text-emerald-700"
                            aria-label="Sửa"
                            title="Sửa"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(c)}
                            disabled={isBusy(`customers:${c.id}`)}
                            className="size-7 text-slate-400 hover:text-rose-600"
                            aria-label="Xóa"
                            title="Xóa"
                          >
                            <BusyTrash busy={isBusy(`customers:${c.id}`)} />
                          </Button>
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination pagination={customersPg} />
          </CardContent>
        </Card>

        {/* Add Parent Customer Modal */}
        <Dialog open={newCustOpen} onOpenChange={setNewCustOpen}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {editId ? 'Sửa Khách Hàng' : 'Thêm Khách Hàng Mới'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateCustomer} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Tên Khách Hàng *
                </Label>
                <Input
                  required
                  placeholder="CÔNG TY TNHH..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewCustOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={saveCustomer.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveCustomer.isPending ? 'Đang lưu...' : 'Lưu Khách Hàng'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
