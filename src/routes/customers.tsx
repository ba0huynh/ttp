import { createFileRoute, redirect } from '@tanstack/react-router'
import { Eye, Plus, Store } from 'lucide-react'
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
import { formatVnd } from '#/lib/business.ts'
import { getCurrentUserFn } from '#/server/fns/auth.ts'
import {
  getCustomerDetailFn,
  listCustomersFn,
  saveBranchFn,
  saveCustomerFn,
} from '#/server/fns/customers.ts'

export const Route = createFileRoute('/customers')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async () => {
    const customers = await listCustomersFn()
    return { customers }
  },
  component: CustomersPage,
})

function CustomersPage() {
  const { user } = Route.useRouteContext()
  const { customers } = Route.useLoaderData()

  // Modal Tạo Khách hàng mẹ
  const [newCustOpen, setNewCustOpen] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [taxCode, setTaxCode] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [contactPerson, setContactPerson] = React.useState('')
  const [savingCust, setSavingCust] = React.useState(false)

  // Modal Chi tiết & Thêm điểm bán
  const [selectedCustId, setSelectedCustId] = React.useState<number | null>(
    null,
  )
  const [custDetail, setCustDetail] = React.useState<any>(null)
  const [loadingDetail, setLoadingDetail] = React.useState(false)

  // Form Thêm Điểm bán
  const [newBranchOpen, setNewBranchOpen] = React.useState(false)
  const [branchCode, setBranchCode] = React.useState('')
  const [branchName, setBranchName] = React.useState('')
  const [branchTaxCode, setBranchTaxCode] = React.useState('')
  const [branchAddress, setBranchAddress] = React.useState('')
  const [branchPhone, setBranchPhone] = React.useState('')
  const [savingBranch, setSavingBranch] = React.useState(false)

  const viewDetail = async (id: number) => {
    setSelectedCustId(id)
    setLoadingDetail(true)
    try {
      const res = await getCustomerDetailFn({ data: { id } })
      setCustDetail(res)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingCust(true)
    try {
      await saveCustomerFn({
        data: {
          code,
          name,
          taxCode,
          phone,
          address,
          contactPerson,
        },
      })
      setNewCustOpen(false)
      window.location.reload()
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi tạo khách hàng')
    } finally {
      setSavingCust(false)
    }
  }

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustId) return
    setSavingBranch(true)
    try {
      await saveBranchFn({
        data: {
          customerId: selectedCustId,
          code: branchCode,
          name: branchName,
          taxCode: branchTaxCode,
          address: branchAddress,
          phone: branchPhone,
          isActive: true,
        },
      })
      setNewBranchOpen(false)
      await viewDetail(selectedCustId)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi tạo điểm bán')
    } finally {
      setSavingBranch(false)
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
          <Button
            size="sm"
            onClick={() => {
              setCode(`KH-${Math.floor(Math.random() * 9000 + 1000)}`)
              setName('')
              setTaxCode('')
              setPhone('')
              setAddress('')
              setContactPerson('')
              setNewCustOpen(true)
            }}
            className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
          >
            <Plus className="size-4" />
            Thêm Khách Hàng Mẹ
          </Button>
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
                    <TableHead>Mã KH</TableHead>
                    <TableHead>Tên Doanh Nghiệp (Khách Mẹ)</TableHead>
                    <TableHead>MST</TableHead>
                    <TableHead className="text-center">
                      Số Điểm Bán Con
                    </TableHead>
                    <TableHead>Điện Thoại / Liên Hệ</TableHead>
                    <TableHead className="text-right">Doanh Thu Mua</TableHead>
                    <TableHead className="text-right">Tổng Dư Nợ</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {customers.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-mono font-bold text-slate-900">
                        {c.code}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900">{c.name}</div>
                        {c.address && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {c.address}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-slate-600">
                        {c.taxCode ?? '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold"
                        >
                          {c.branchCount} điểm bán
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-700">
                          {c.phone ?? '—'}
                        </div>
                        {c.contactPerson && (
                          <div className="text-[11px] text-slate-400">
                            {c.contactPerson}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatVnd(c.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-black text-rose-900">
                        {formatVnd(c.balance)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-emerald-800 gap-1 font-medium"
                          onClick={() => viewDetail(c.id)}
                        >
                          <Eye className="size-3.5" />
                          Điểm bán & Công nợ
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Modal Thêm Khách Hàng Mẹ */}
        <Dialog open={newCustOpen} onOpenChange={setNewCustOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Thêm Khách Hàng Mẹ Mới
              </DialogTitle>
              <DialogDescription className="text-xs">
                Doanh nghiệp đối tác ký hợp đồng khung mua xe sỉ
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateCustomer} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Mã Khách Hàng *</Label>
                <Input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Tên Doanh Nghiệp (Khách Mẹ) *
                </Label>
                <Input
                  required
                  placeholder="CÔNG TY TNHH..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mã Số Thuế</Label>
                  <Input
                    placeholder="031..."
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Số Điện Thoại</Label>
                  <Input
                    placeholder="090..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Địa Chỉ Trụ Sở</Label>
                <Input
                  placeholder="Địa chỉ trụ sở chính..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Người Đại Diện / Liên Hệ
                </Label>
                <Input
                  placeholder="Họ tên người liên hệ..."
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
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
                  disabled={savingCust}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {savingCust ? 'Đang lưu...' : 'Lưu Khách Hàng'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Quản lý Điểm bán & Công nợ của Khách mẹ */}
        <Dialog
          open={selectedCustId !== null}
          onOpenChange={(open) => !open && setSelectedCustId(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
                <span>{custDetail?.customer?.name}</span>
                <span className="font-mono text-xs text-slate-500">
                  {custDetail?.customer?.code}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                MST: {custDetail?.customer?.taxCode ?? '—'} &bull; Địa chỉ:{' '}
                {custDetail?.customer?.address ?? '—'}
              </DialogDescription>
            </DialogHeader>

            {loadingDetail ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Đang tải thông tin chi nhánh...
              </div>
            ) : custDetail ? (
              <div className="space-y-5 pt-2">
                {/* 1. Danh sách điểm bán trực thuộc */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Store className="size-4 text-emerald-700" />
                      Các Điểm Bán / Showroom Trực Thuộc (
                      {custDetail.branches.length}):
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setBranchCode(
                          `DB-${custDetail.customer.code}-${custDetail.branches.length + 1}`,
                        )
                        setBranchName('')
                        setBranchTaxCode(
                          custDetail.customer.taxCode
                            ? `${custDetail.customer.taxCode}-00${custDetail.branches.length + 1}`
                            : '',
                        )
                        setBranchAddress('')
                        setBranchPhone('')
                        setNewBranchOpen(true)
                      }}
                      className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                    >
                      <Plus className="size-3.5" />
                      Thêm điểm bán mới
                    </Button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs bg-slate-50">
                          <TableHead>Mã Điểm Bán</TableHead>
                          <TableHead>Tên Pháp Nhân Điểm Bán</TableHead>
                          <TableHead>MST Điểm Bán</TableHead>
                          <TableHead>Địa Chỉ Nhận Xe</TableHead>
                          <TableHead>Số ĐT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {custDetail.branches.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center py-4 text-slate-400"
                            >
                              Chưa có điểm bán trực thuộc. Đơn hàng sẽ ghi trực
                              tiếp cho Khách hàng Mẹ.
                            </TableCell>
                          </TableRow>
                        ) : (
                          custDetail.branches.map((b: any) => (
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
                </div>

                {/* 2. Form Thêm điểm bán mới (inline toggle) */}
                {newBranchOpen && (
                  <form
                    onSubmit={handleCreateBranch}
                    className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-2"
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
                        disabled={savingBranch}
                        size="sm"
                        className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                      >
                        {savingBranch ? 'Đang lưu...' : 'Lưu Điểm Bán'}
                      </Button>
                    </div>
                  </form>
                )}

                {/* 3. Tình hình công nợ theo từng điểm bán */}
                <div>
                  <div className="text-xs font-bold text-slate-800 mb-2">
                    Công Nợ Ghi Nhận Theo Từng Pháp Nhân Điểm Bán:
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs bg-slate-50">
                          <TableHead>Pháp Nhân Điểm Bán</TableHead>
                          <TableHead className="text-right">
                            Tổng Mua Xe
                          </TableHead>
                          <TableHead className="text-right">
                            Đã Thanh Toán
                          </TableHead>
                          <TableHead className="text-right">Còn Nợ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {custDetail.receivables.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center py-4 text-slate-400"
                            >
                              Chưa có phát sinh công nợ mua xe.
                            </TableCell>
                          </TableRow>
                        ) : (
                          custDetail.receivables.map((r: any, idx: number) => (
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
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
