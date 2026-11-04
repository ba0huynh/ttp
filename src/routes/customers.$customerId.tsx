import { Can } from '#/components/auth/Can.tsx'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import { confirmDelete, reportDeleteFailure } from '#/lib/usage.ts'
import { useBusyKeys } from '#/lib/use-busy.ts'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Plus, Store } from 'lucide-react'
import * as React from 'react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader } from '#/components/layout/StatCard.tsx'
import {
  alertDialog,
  confirmDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
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
import { Textarea } from '#/components/ui/textarea.tsx'
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
import { requirePagePermission } from '#/lib/route-guard.ts'
import { deleteBranchFn, saveBranchFn } from '#/server/fns/customers.ts'

export const Route = createFileRoute('/customers/$customerId')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'customers.view')
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
  const [branchAddress, setBranchAddress] = React.useState('')
  const [branchId, setBranchId] = React.useState<number | null>(null)
  const { isBusy, setBusy } = useBusyKeys()

  const openNewBranch = () => {
    setBranchId(null)
    setBranchName('')
    setBranchAddress('')
    setNewBranchOpen(true)
  }

  const openEditBranch = (b: {
    id: number
    name: string
    address: string | null
  }) => {
    setBranchId(b.id)
    setBranchName(b.name)
    setBranchAddress(b.address ?? '')
    setNewBranchOpen(true)
  }

  const deleteBranch = useMutation({
    mutationFn: deleteBranchFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const handleDeleteBranch = async (b: { id: number; name: string }) => {
    const key = `branches:${b.id}`
    const ok = await confirmDelete(
      { entity: 'branches', id: b.id, name: b.name },
      {
        title: `Xóa điểm bán "${b.name}"?`,
        description: 'Hành động này không thể hoàn tác.',
      },
      (checking) => setBusy(key, checking),
    )
    if (!ok) return
    setBusy(key, true)
    try {
      await deleteBranch.mutateAsync({ data: { id: b.id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity: 'branches', id: b.id, name: b.name },
        'Không thể xóa điểm bán',
      )
    } finally {
      setBusy(key, false)
    }
  }

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = branchName.trim().replace(/\s+/g, ' ').normalize('NFC')
    if (!cleanName) {
      await alertDialog(
        'Tên điểm bán không được để trống hoặc chỉ chứa khoảng trắng',
      )
      return
    }
    const isDup = branches.some(
      (b) =>
        b.name.trim().replace(/\s+/g, ' ').normalize('NFC').toLowerCase() ===
          cleanName.toLowerCase() &&
        b.id !== (branchId ?? undefined),
    )
    if (isDup) {
      const ok = await confirmDialog({
        title: 'Cảnh Báo Trùng Tên Điểm Bán',
        description: `Điểm bán "${cleanName}" đã tồn tại cho khách hàng này. Bạn có chắc chắn muốn tiếp tục lưu không?`,
        confirmLabel: 'Tiếp tục lưu',
        cancelLabel: 'Kiểm tra lại',
      })
      if (!ok) return
    }
    try {
      await saveBranch.mutateAsync({
        data: {
          id: branchId ?? undefined,
          customerId: customer.id,
          name: cleanName,
          address: branchAddress.trim() || null,
          isActive: true,
        },
      })
      setNewBranchOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu điểm bán')
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
              Danh Sách Điểm Bán ({branches.length})
            </CardTitle>
            <Button size="sm" onClick={openNewBranch} className="h-8 text-xs">
              <Plus className="size-3.5" />
              Thêm Điểm Bán
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên Điểm Bán</TableHead>
                    <TableHead>Địa Chỉ</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {branches.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center py-6 text-slate-500"
                      >
                        Chưa có điểm bán. Đơn hàng sẽ ghi trực tiếp cho khách
                        hàng.
                      </TableCell>
                    </TableRow>
                  ) : (
                    branchesPg.pageItems.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium text-slate-900">
                          {b.name}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {b.address}
                        </TableCell>
                        <TableCell>
                          <Can permission="customers.manage">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditBranch(b)}
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                                title="Sửa"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteBranch(b)}
                                disabled={isBusy(`branches:${b.id}`)}
                                className="size-7 text-slate-400 hover:text-rose-600"
                                aria-label="Xóa"
                                title="Xóa"
                              >
                                <BusyTrash busy={isBusy(`branches:${b.id}`)} />
                              </Button>
                            </div>
                          </Can>
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
              Công Nợ Theo Điểm Bán
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Điểm Bán</TableHead>
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
                        className="text-center py-6 text-slate-500"
                      >
                        Chưa có phát sinh công nợ mua xe.
                      </TableCell>
                    </TableRow>
                  ) : (
                    receivablesPg.pageItems.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-slate-900">
                          {r.entityName}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatVnd(r.sold)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-800 font-medium">
                          {formatVnd(r.paid)}
                        </TableCell>
                        <TableCell className="text-right text-rose-900">
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

        {/* Add / edit branch */}
        <Dialog open={newBranchOpen} onOpenChange={setNewBranchOpen}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {branchId ? 'Sửa Điểm Bán' : 'Thêm Điểm Bán Mới'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateBranch} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tên Điểm Bán *</Label>
                <Input
                  required
                  placeholder="Showroom..."
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Địa Chỉ</Label>
                <Textarea
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  rows={2}
                  className="min-h-24 rounded-lg px-4 py-3 text-sm"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewBranchOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={saveBranch.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveBranch.isPending ? 'Đang lưu...' : 'Lưu Điểm Bán'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
