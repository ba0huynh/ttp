import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft, Banknote, Plus, Store, Wallet } from 'lucide-react'
import * as React from 'react'

import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader, StatCard } from '#/components/layout/StatCard.tsx'
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

  // A branch changes the customer list, detail and receivables
  const saveBranch = useMutation({
    mutationFn: saveBranchFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const [newBranchOpen, setNewBranchOpen] = React.useState(false)
  const [branchCode, setBranchCode] = React.useState('')
  const [branchName, setBranchName] = React.useState('')
  const [branchTaxCode, setBranchTaxCode] = React.useState('')
  const [branchAddress, setBranchAddress] = React.useState('')
  const [branchPhone, setBranchPhone] = React.useState('')

  const totalSold = receivables.reduce((s, r) => s + r.sold, 0)
  const totalPaid = receivables.reduce((s, r) => s + r.paid, 0)

  const openNewBranch = () => {
    setBranchCode(`DB-${customer.id}-${branches.length + 1}`)
    setBranchName('')
    setBranchTaxCode('')
    setBranchAddress('')
    setBranchPhone('')
    setNewBranchOpen(true)
  }

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveBranch.mutateAsync({
        data: {
          customerId: customer.id,
          code: branchCode,
          name: branchName,
          taxCode: branchTaxCode,
          address: branchAddress,
          phone: branchPhone,
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
          description={<>Địa chỉ: {customer.address ?? '—'}</>}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Điểm bán trực thuộc"
            icon={Store}
            value={branches.length}
            unit="điểm bán"
          />
          <StatCard
            label="Tổng mua xe"
            icon={Banknote}
            tone="blue"
            value={formatVnd(totalSold)}
          />
          <StatCard
            label="Đã thanh toán"
            icon={Wallet}
            value={formatVnd(totalPaid)}
          />
          <StatCard
            label="Còn nợ"
            icon={Wallet}
            tone="rose"
            value={formatVnd(totalSold - totalPaid)}
          />
        </div>

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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Mã Điểm Bán *
                    </Label>
                    <Input
                      required
                      value={branchCode}
                      onChange={(e) => setBranchCode(e.target.value)}
                      className="h-8 text-xs bg-white font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold">
                      Tên Pháp Nhân Điểm Bán *
                    </Label>
                    <Input
                      required
                      placeholder="Showroom..."
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="h-8 text-xs bg-white font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Mã Số Thuế Điểm Bán
                    </Label>
                    <Input
                      placeholder="Mã số thuế chi nhánh..."
                      value={branchTaxCode}
                      onChange={(e) => setBranchTaxCode(e.target.value)}
                      className="h-8 text-xs bg-white font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold">
                      Địa Chỉ Giao Nhận Xe
                    </Label>
                    <Input
                      placeholder="Địa chỉ showroom nhận xe..."
                      value={branchAddress}
                      onChange={(e) => setBranchAddress(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
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
                    <TableHead>Mã Điểm Bán</TableHead>
                    <TableHead>Tên Pháp Nhân Điểm Bán</TableHead>
                    <TableHead>MST Điểm Bán</TableHead>
                    <TableHead>Địa Chỉ Nhận Xe</TableHead>
                    <TableHead>Số ĐT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {branches.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-6 text-slate-400"
                      >
                        Chưa có điểm bán trực thuộc. Đơn hàng sẽ ghi trực tiếp
                        cho Khách hàng Mẹ.
                      </TableCell>
                    </TableRow>
                  ) : (
                    branches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono font-bold text-slate-900">
                          {b.code}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800">
                          {b.name}
                        </TableCell>
                        <TableCell className="font-mono text-slate-600">
                          {b.taxCode ?? '—'}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {b.address ?? '—'}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {b.phone ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
                    receivables.map((r, idx) => (
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
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
