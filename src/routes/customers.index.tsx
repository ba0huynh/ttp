import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Eye, Plus } from 'lucide-react'
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
import { saveCustomerFn } from '#/server/fns/customers.ts'

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

  // Mọi thay đổi khách hàng/điểm bán ảnh hưởng danh sách, chi tiết và công nợ
  const saveCustomer = useMutation({
    mutationFn: saveCustomerFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveCustomer.mutateAsync({
        data: {
          name,
        },
      })
      setNewCustOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi tạo khách hàng')
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Khách Hàng Mẹ & Điểm Bán Trực Thuộc
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Doanh thu hợp nhất quy về <strong>Khách hàng Mẹ</strong> &bull;
              Hóa đơn và Công nợ ghi theo <strong>Pháp nhân Điểm bán</strong>{' '}
              nhận xe.
            </p>
          </div>
          <Can permission="customers.manage">
            <Button
              size="sm"
              onClick={() => {
                setName('')
                setNewCustOpen(true)
              }}
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
            >
              <Plus className="size-4" />
              Thêm Khách Hàng Mẹ
            </Button>
          </Can>
        </div>

        {/* Customers Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh Sách Khách Hàng Đối Tác ({customers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50/70">
                    <TableHead>Tên Doanh Nghiệp (Khách Mẹ)</TableHead>
                    <TableHead className="text-center">
                      Số Điểm Bán Con
                    </TableHead>
                    <TableHead className="text-right">Còn Nợ</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {customersPg.pageItems.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <div className="font-bold text-slate-900">{c.name}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold"
                        >
                          {c.branchCount} điểm bán
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-black text-rose-900">
                        {formatVnd(c.balance)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-emerald-800 gap-1 font-medium"
                        >
                          <Link
                            to="/customers/$customerId"
                            params={{ customerId: String(c.id) }}
                            preload="intent"
                          >
                            <Eye className="size-3.5" />
                            Chi tiết
                          </Link>
                        </Button>
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
                Thêm Khách Hàng Mẹ Mới
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateCustomer} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Tên Doanh Nghiệp (Khách Mẹ) *
                </Label>
                <Input
                  required
                  placeholder="CÔNG TY TNHH..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs"
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
