import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react'
import * as React from 'react'

import { BankLabel } from '#/components/finance/BankLabel.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs.tsx'
import { formatDate, formatVnd, todayIso } from '#/lib/business.ts'
import {
  batchesQuery,
  customerOptionsQuery,
  masterDataQuery,
  payablesQuery,
  paymentsQuery,
  receiptsQuery,
  receivablesQuery,
  currentUserQuery,
} from '#/lib/queries.ts'
import {
  createPaymentVoucherFn,
  createReceiptVoucherFn,
} from '#/server/fns/finance.ts'

export const Route = createFileRoute('/finance')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.query(receivablesQuery()),
      queryClient.query(payablesQuery()),
      queryClient.query(receiptsQuery()),
      queryClient.query(paymentsQuery()),
      queryClient.query(customerOptionsQuery()),
      queryClient.query(masterDataQuery()),
      queryClient.query(batchesQuery()),
    ])
  },
  component: FinancePage,
})

function FinancePage() {
  const { user } = Route.useRouteContext()
  const { data: receivables } = useSuspenseQuery(receivablesQuery())
  const { data: payables } = useSuspenseQuery(payablesQuery())
  const { data: receipts } = useSuspenseQuery(receiptsQuery())
  const { data: payments } = useSuspenseQuery(paymentsQuery())
  const { data: customers } = useSuspenseQuery(customerOptionsQuery())
  const { data: master } = useSuspenseQuery(masterDataQuery())
  const { data: batches } = useSuspenseQuery(batchesQuery())
  const queryClient = useQueryClient()
  // Phiếu thu/chi đổi công nợ, sao kê và dashboard nên làm mới toàn bộ cache
  const createReceipt = useMutation({
    mutationFn: createReceiptVoucherFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const createPayment = useMutation({
    mutationFn: createPaymentVoucherFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  // Receipt Voucher modal
  const [receiptOpen, setReceiptOpen] = React.useState(false)
  const [receiptDate, setReceiptDate] = React.useState(todayIso())
  const [receiptCustomerId, setReceiptCustomerId] = React.useState<number>(
    customers[0]?.id ?? 1,
  )
  const [receiptBranchId, setReceiptBranchId] = React.useState<number | null>(
    null,
  )
  const [receiptAmount, setReceiptAmount] = React.useState(50_000_000)
  const [receiptMethod, setReceiptMethod] = React.useState<
    'cash' | 'bank_transfer'
  >('bank_transfer')
  const [receiptAccountId, setReceiptAccountId] = React.useState<number | null>(
    master.bankAccounts[0]?.id ?? null,
  )
  const [receiptNote, setReceiptNote] = React.useState('')

  // Payment Voucher modal
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [paymentDate, setPaymentDate] = React.useState(todayIso())
  const [paymentSupplierId, setPaymentSupplierId] = React.useState<number>(
    master.suppliers[0]?.id ?? 1,
  )
  const [paymentBatchId, setPaymentBatchId] = React.useState<number | null>(
    batches[0]?.id ?? null,
  )
  const [paymentAmount, setPaymentAmount] = React.useState(100_000_000)
  const [paymentMethod, setPaymentMethod] = React.useState<
    'cash' | 'bank_transfer'
  >('bank_transfer')
  const [paymentAccountId, setPaymentAccountId] = React.useState<number | null>(
    master.bankAccounts[0]?.id ?? null,
  )
  const [paymentDesc, setPaymentDesc] = React.useState('')

  const selectedCustomer = customers.find((c) => c.id === receiptCustomerId)
  const branchOptions = selectedCustomer?.branches ?? []

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createReceipt.mutateAsync({
        data: {
          receiptDate,
          customerId: receiptCustomerId,
          branchId: receiptBranchId,
          amount: receiptAmount,
          method: receiptMethod,
          companyBankAccountId: receiptAccountId,
          note: receiptNote,
        },
      })
      setReceiptOpen(false)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi tạo phiếu thu')
    }
  }

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createPayment.mutateAsync({
        data: {
          paymentDate,
          payeeType: 'supplier',
          supplierId: paymentSupplierId,
          batchId: paymentBatchId,
          amount: paymentAmount,
          method: paymentMethod,
          companyBankAccountId: paymentAccountId,
          description: paymentDesc,
        },
      })
      setPaymentOpen(false)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi tạo phiếu chi')
    }
  }

  const totalReceivable = receivables.reduce((s, r) => s + r.balance, 0)
  const totalPayable = payables.reduce((s, p) => s + p.balance, 0)

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Quản Lý Thu Chi & Công Nợ
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Công nợ phải thu (AR) theo từng{' '}
              <strong>Pháp nhân điểm bán nhận xe</strong> &bull; Công nợ phải
              trả (AP) theo Nhà cung cấp lô hàng.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setReceiptOpen(true)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
            >
              <Plus className="size-4" />
              Lập Phiếu Thu Tiền
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPaymentOpen(true)}
              className="border-slate-300 text-slate-800 gap-1.5 shadow-xs"
            >
              <Plus className="size-4" />
              Lập Phiếu Chi
            </Button>
          </div>
        </div>

        {/* 2 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-emerald-900 uppercase">
                Tổng Công Nợ Phải Thu (Khách nợ)
              </CardTitle>
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                <ArrowDownLeft className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-emerald-950">
                {formatVnd(totalReceivable)}
              </div>
              <p className="text-xs text-emerald-700 mt-1">
                Gồm {receivables.length} pháp nhân đại lý/điểm bán nhận xe
              </p>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-rose-50/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-rose-900 uppercase">
                Tổng Công Nợ Phải Trả (Nợ nhà cung cấp)
              </CardTitle>
              <div className="p-2 rounded-lg bg-rose-100 text-rose-800">
                <ArrowUpRight className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-rose-950">
                {formatVnd(totalPayable)}
              </div>
              <p className="text-xs text-rose-700 mt-1">
                Gồm {payables.length} nhà cung cấp xe nhập khẩu
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed interface */}
        <Tabs defaultValue="receivables" className="space-y-4">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="receivables" className="text-xs font-semibold">
              Công Nợ Phải Thu ({receivables.length})
            </TabsTrigger>
            <TabsTrigger value="payables" className="text-xs font-semibold">
              Công Nợ Phải Trả ({payables.length})
            </TabsTrigger>
            <TabsTrigger value="receipts" className="text-xs font-semibold">
              Lịch Sử Phiếu Thu ({receipts.length})
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-xs font-semibold">
              Lịch Sử Phiếu Chi ({payments.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Accounts Receivable */}
          <TabsContent value="receivables">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Công Nợ Phải Thu Theo Pháp Nhân Nhận Xe
                </CardTitle>
                <CardDescription className="text-xs">
                  Ghi nhận nợ gắn liền với từng Showroom/Điểm bán trực thuộc
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Khách Hàng Mẹ</TableHead>
                      <TableHead>Pháp Nhân Điểm Bán Chịu Nợ</TableHead>
                      <TableHead>Mã Số Thuế</TableHead>
                      <TableHead className="text-right">Tổng Mua Xe</TableHead>
                      <TableHead className="text-right">
                        Đã Thanh Toán
                      </TableHead>
                      <TableHead className="text-right">
                        Dư Nợ Còn Lại
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {receivables.map((r, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/80">
                        <TableCell className="font-semibold text-slate-900">
                          {r.customerName}
                        </TableCell>
                        <TableCell className="font-medium text-emerald-900">
                          {r.branchId ? r.entityName : 'Pháp nhân chính KH mẹ'}
                        </TableCell>
                        <TableCell className="font-mono text-slate-500">
                          {r.taxCode ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-700">
                          {formatVnd(r.sold)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-800 font-medium">
                          {formatVnd(r.paid)}
                        </TableCell>
                        <TableCell className="text-right font-black text-rose-900">
                          {formatVnd(r.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Accounts Payable */}
          <TabsContent value="payables">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Công Nợ Phải Trả Cho Nhà Cung Cấp Xe
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Nhà Cung Cấp</TableHead>
                      <TableHead className="text-center">Số Lô Xe</TableHead>
                      <TableHead className="text-right">
                        Tổng Tiền Hàng
                      </TableHead>
                      <TableHead className="text-right">
                        Đã Thanh Toán
                      </TableHead>
                      <TableHead className="text-right">Còn Nợ NCC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {payables.map((p) => (
                      <TableRow
                        key={p.supplierId}
                        className="hover:bg-slate-50/80"
                      >
                        <TableCell className="font-bold text-slate-900">
                          {p.supplierName}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {p.batches} lô
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-700">
                          {formatVnd(p.purchased)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-800 font-medium">
                          {formatVnd(p.paid)}
                        </TableCell>
                        <TableCell className="text-right font-black text-rose-900">
                          {formatVnd(p.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Receipt Vouchers */}
          <TabsContent value="receipts">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Lịch Sử Phiếu Thu Tiền Bán Xe ({receipts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Số Phiếu Thu</TableHead>
                      <TableHead>Ngày Thu</TableHead>
                      <TableHead>Khách Hàng</TableHead>
                      <TableHead>Điểm Bán Thanh Toán</TableHead>
                      <TableHead className="text-right">Số Tiền Thu</TableHead>
                      <TableHead>Hình Thức</TableHead>
                      <TableHead>Tài Khoản Nhận</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {receipts.map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-mono font-bold text-emerald-900">
                          {r.voucherNumber}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {formatDate(r.receiptDate)}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">
                          {r.customerName}
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {r.branchName ?? 'Trực tiếp KH mẹ'}
                        </TableCell>
                        <TableCell className="text-right font-black text-emerald-900">
                          {formatVnd(r.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px]">
                            {r.method === 'bank_transfer'
                              ? 'Chuyển khoản'
                              : 'Tiền mặt'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 font-mono text-[11px]">
                          {r.accountNumber ? (
                            <BankLabel
                              image={r.bankImage}
                              name={r.bankShortName}
                            >
                              {r.bankShortName} ({r.accountNumber})
                            </BankLabel>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Payment Vouchers */}
          <TabsContent value="payments">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Lịch Sử Phiếu Chi ({payments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Số Phiếu Chi</TableHead>
                      <TableHead>Ngày Chi</TableHead>
                      <TableHead>Đối Tượng Nhận</TableHead>
                      <TableHead>Lô Xe Liên Quan</TableHead>
                      <TableHead className="text-right">Số Tiền Chi</TableHead>
                      <TableHead>Nội Dung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {payments.map((p) => (
                      <TableRow key={p.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-mono font-bold text-slate-900">
                          {p.voucherNumber}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {formatDate(p.paymentDate)}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">
                          {p.supplierName ?? p.payeeName}
                        </TableCell>
                        <TableCell>
                          {p.batchCode ? (
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px]"
                            >
                              {p.batchCode}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right font-black text-rose-900">
                          {formatVnd(p.amount)}
                        </TableCell>
                        <TableCell className="text-slate-500 text-[11px]">
                          {p.description ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Receipt Voucher Modal */}
        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Lập Phiếu Thu Tiền Bán Xe
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ghi nhận khách hàng hoặc điểm bán thanh toán công nợ
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateReceipt} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ngày Thu Tiền *</Label>
                <Input
                  type="date"
                  required
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Khách Hàng Mẹ *</Label>
                <Select
                  value={String(receiptCustomerId)}
                  onValueChange={(val) => {
                    setReceiptCustomerId(Number(val))
                    setReceiptBranchId(null)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem
                        key={c.id}
                        value={String(c.id)}
                        className="text-xs"
                      >
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Điểm Bán Thanh Toán (Công nợ trừ theo pháp nhân này)
                </Label>
                <Select
                  value={receiptBranchId ? String(receiptBranchId) : 'none'}
                  onValueChange={(val) =>
                    setReceiptBranchId(val === 'none' ? null : Number(val))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Chọn chi nhánh/điểm bán" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      Trực tiếp KH mẹ
                    </SelectItem>
                    {branchOptions.map((b) => (
                      <SelectItem
                        key={b.id}
                        value={String(b.id)}
                        className="text-xs"
                      >
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Số Tiền Thu (VNĐ) *
                </Label>
                <Input
                  type="number"
                  min="1000"
                  step="500000"
                  required
                  value={receiptAmount}
                  onChange={(e) =>
                    setReceiptAmount(Number(e.target.value) || 0)
                  }
                  className="h-8 text-xs font-bold text-emerald-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Hình Thức</Label>
                  <Select
                    value={receiptMethod}
                    onValueChange={(val: any) => setReceiptMethod(val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer" className="text-xs">
                        Chuyển khoản
                      </SelectItem>
                      <SelectItem value="cash" className="text-xs">
                        Tiền mặt
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Tài Khoản Nhận
                  </Label>
                  <Select
                    value={receiptAccountId ? String(receiptAccountId) : 'none'}
                    onValueChange={(val) =>
                      setReceiptAccountId(val === 'none' ? null : Number(val))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {master.bankAccounts.map((a) => (
                        <SelectItem
                          key={a.id}
                          value={String(a.id)}
                          className="text-xs"
                        >
                          <BankLabel image={a.bankImage} name={a.bankShortName}>
                            {a.bankShortName} ({a.accountNumber})
                          </BankLabel>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ghi Chú</Label>
                <Input
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  placeholder="Thanh toán đợt 1..."
                  className="h-8 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReceiptOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={createReceipt.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {createReceipt.isPending ? 'Đang lưu...' : 'Lưu Phiếu Thu'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Payment Voucher Modal */}
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Lập Phiếu Chi Tiền
              </DialogTitle>
              <DialogDescription className="text-xs">
                Chi trả tiền hàng cho nhà cung cấp hoặc thanh toán chi phí lô xe
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreatePayment} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ngày Chi Tiền *</Label>
                <Input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Nhà Cung Cấp Thụ Hưởng *
                </Label>
                <Select
                  value={String(paymentSupplierId)}
                  onValueChange={(val) => setPaymentSupplierId(Number(val))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {master.suppliers.map((s) => (
                      <SelectItem
                        key={s.id}
                        value={String(s.id)}
                        className="text-xs"
                      >
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Lô Xe Liên Quan (nếu có)
                </Label>
                <Select
                  value={paymentBatchId ? String(paymentBatchId) : 'none'}
                  onValueChange={(val) =>
                    setPaymentBatchId(val === 'none' ? null : Number(val))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      Không gắn lô cụ thể
                    </SelectItem>
                    {batches.map((b) => (
                      <SelectItem
                        key={b.id}
                        value={String(b.id)}
                        className="text-xs"
                      >
                        {b.batchCode} &bull; {b.supplierName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Số Tiền Chi (VNĐ) *
                </Label>
                <Input
                  type="number"
                  min="1000"
                  step="500000"
                  required
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(Number(e.target.value) || 0)
                  }
                  className="h-8 text-xs font-bold text-rose-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Hình Thức Chi</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(val: 'cash' | 'bank_transfer') =>
                      setPaymentMethod(val)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer" className="text-xs">
                        Chuyển khoản
                      </SelectItem>
                      <SelectItem value="cash" className="text-xs">
                        Tiền mặt
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {paymentMethod === 'bank_transfer' && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Tài Khoản Chi
                    </Label>
                    <Select
                      value={
                        paymentAccountId ? String(paymentAccountId) : 'none'
                      }
                      onValueChange={(val) =>
                        setPaymentAccountId(val === 'none' ? null : Number(val))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {master.bankAccounts.map((b) => (
                          <SelectItem
                            key={b.id}
                            value={String(b.id)}
                            className="text-xs"
                          >
                            <BankLabel
                              image={b.bankImage}
                              name={b.bankShortName}
                            >
                              {b.bankShortName} &bull; {b.accountNumber}
                            </BankLabel>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nội Dung Chi</Label>
                <Input
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  placeholder="Thanh toán đợt 1 tiền hàng..."
                  className="h-8 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={createPayment.isPending}
                  size="sm"
                  className="h-8 text-xs bg-rose-700 hover:bg-rose-800 text-white font-semibold"
                >
                  {createPayment.isPending ? 'Đang lưu...' : 'Lưu Phiếu Chi'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
