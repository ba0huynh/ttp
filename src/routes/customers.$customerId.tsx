import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft, Plus, Store } from 'lucide-react'
import * as React from 'react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader } from '#/components/layout/StatCard.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
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
import { currentUserQuery, customerDetailQuery } from '#/lib/queries.ts'
import { saveBranchFn } from '#/server/fns/customers.ts'

export const Route = createFileRoute('/customers/$customerId')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async ({ context: { queryClient }, params }) => {
    const id = Number(params.customerId)
    if (!Number.isInteger(id)) throw redirect({ to: '/customers' })
    await queryClient.query(customerDetailQuery(id))
  },
  errorComponent: CustomerNotFound,
  component: CustomerDetailPage,
})

function CustomerNotFound() {
  const { user } = Route.useRouteContext()
  return (
    <AppLayout user={user}>
      <div className="py-16 text-center space-y-3">
        <p className="text-slate-600">Không tìm thấy khách hàng này.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/customers">
            <ArrowLeft className="size-4" />
            Về danh sách khách hàng
          </Link>
        </Button>
      </div>
    </AppLayout>
  )
}

function CustomerDetailPage() {
  const { user } = Route.useRouteContext()
  const { customerId } = Route.useParams()
  const { data } = useSuspenseQuery(customerDetailQuery(Number(customerId)))
  const queryClient = useQueryClient()
  const { customer, branches, receivables } = data
  const branchesPg = usePagination(branches)
  const receivablesPg = usePagination(receivables)

  // A branch changes the customer list, detail and receivables
  const saveBranch = useMutation({
    mutationFn: saveBranchFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const [newBranchOpen, setNewBranchOpen] = React.useState(false)
  const [branchName, setBranchName] = React.useState('')

  const openNewBranch = () => {
    setBranchName('')
    setNewBranchOpen(true)
  }

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveBranch.mutateAsync({
        data: {
          customerId: customer.id,
          name: branchName,
          isActive: true,
        },
      })
      setNewBranchOpen(false)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi tạo điểm bán')
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={
            <Link
              to="/customers"
              className="inline-flex items-center gap-1 hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Danh sách khách hàng
            </Link>
          }
          title={customer.name}
        />

        {/* 1. Affiliated branches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Store className="size-4 text-emerald-700" />
              Các Điểm Bán / Showroom Trực Thuộc ({branches.length})
            </CardTitle>
            <Button size="sm" onClick={openNewBranch} className="h-8 text-xs">
              <Plus className="size-3.5" />
              Thêm điểm bán mới
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {newBranchOpen && (
              <form
                onSubmit={handleCreateBranch}
                className="m-4 p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-2"
              >
                <div className="text-xs font-bold text-emerald-950">
                  Nhập Thông Tin Điểm Bán Trực Thuộc Mới:
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Tên Điểm Bán *
                  </Label>
                  <Input
                    required
                    placeholder="Showroom..."
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="h-8 text-xs bg-white font-semibold"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewBranchOpen(false)}
                    className="h-7 text-xs"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveBranch.isPending}
                    size="sm"
                    className="h-7 text-xs font-semibold"
                  >
                    {saveBranch.isPending ? 'Đang lưu...' : 'Lưu Điểm Bán'}
                  </Button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên Điểm Bán</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {branches.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={1}
                        className="text-center py-6 text-slate-400"
                      >
                        Chưa có điểm bán trực thuộc. Đơn hàng sẽ ghi trực tiếp
                        cho Khách hàng Mẹ.
                      </TableCell>
                    </TableRow>
                  ) : (
                    branchesPg.pageItems.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-semibold text-slate-800">
                          {b.name}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination pagination={branchesPg} />
          </CardContent>
        </Card>

        {/* 2. Debt by branch legal entity */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm font-bold text-slate-800">
              Công Nợ Ghi Nhận Theo Từng Pháp Nhân Điểm Bán
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pháp Nhân Điểm Bán</TableHead>
                    <TableHead className="text-right">Tổng Mua Xe</TableHead>
                    <TableHead className="text-right">Đã Thanh Toán</TableHead>
                    <TableHead className="text-right">Còn Nợ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {receivables.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-6 text-slate-400"
                      >
                        Chưa có phát sinh công nợ mua xe.
                      </TableCell>
                    </TableRow>
                  ) : (
                    receivablesPg.pageItems.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold text-slate-900">
                          {r.entityName}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatVnd(r.sold)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-800 font-medium">
                          {formatVnd(r.paid)}
                        </TableCell>
                        <TableCell className="text-right font-black text-rose-900">
                          {formatVnd(r.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination pagination={receivablesPg} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
