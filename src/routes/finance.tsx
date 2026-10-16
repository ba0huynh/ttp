import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Pencil, Plus } from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import {
  confirmDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
import { useBusyKeys } from '#/lib/use-busy.ts'
import { BankAccountSelect } from '#/components/finance/BankAccountSelect.tsx'
import { BankLabel } from '#/components/finance/BankLabel.tsx'
import { Can } from '#/components/auth/Can.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Checkbox } from '#/components/ui/checkbox.tsx'
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
import { MoneyInput } from '#/components/ui/money-input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { Textarea } from '#/components/ui/textarea.tsx'
import {
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs.tsx'
import { formatDate, formatVnd, todayIso } from '#/lib/business.ts'
import {
  customerOptionsQuery,
  masterDataQuery,
  payablesQuery,
  paymentsQuery,
  receiptsQuery,
  receivablesQuery,
  currentUserQuery,
} from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import {
  createPaymentVoucherFn,
  createReceiptVoucherFn,
  deletePaymentVoucherFn,
  deleteReceiptVoucherFn,
  updatePaymentVoucherFn,
  updateReceiptVoucherFn,
} from '#/server/fns/finance.ts'

export const Route = createFileRoute('/finance')({
  // The active tab lives in the URL (?tab=...) so a reload stays on it
  validateSearch: z.object({
    tab: z
      .enum(['receivables', 'payables', 'receipts', 'payments'])
      .catch('receivables'),
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'finance.view')
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
    ])
  },
  component: FinancePage,
})

function FinancePage() {
  const { user } = Route.useRouteContext()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: receivables } = useSuspenseQuery(receivablesQuery())
  const { data: payables } = useSuspenseQuery(payablesQuery())
  const { data: receipts } = useSuspenseQuery(receiptsQuery())
  const { data: payments } = useSuspenseQuery(paymentsQuery())
  const receivablesPg = usePagination(receivables)
  const payablesPg = usePagination(payables)
  const receiptsPg = usePagination(receipts)
  const paymentsPg = usePagination(payments)
  const { data: customers } = useSuspenseQuery(customerOptionsQuery())
  const { data: master } = useSuspenseQuery(masterDataQuery())
  const queryClient = useQueryClient()
  // Phiếu thu/chi đổi công nợ, sao kê và dashboard nên làm mới toàn bộ cache
  // One mutation for both create and edit: an id means edit
  const createReceipt = useMutation({
    mutationFn: async (v: { id?: number } & Record<string, unknown>) => {
      if (v.id) await updateReceiptVoucherFn({ data: v as never })
      else await createReceiptVoucherFn({ data: v as never })
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const createPayment = useMutation({
    mutationFn: async (v: { id?: number } & Record<string, unknown>) => {
      if (v.id) await updatePaymentVoucherFn({ data: v as never })
      else await createPaymentVoucherFn({ data: v as never })
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const { isBusy, setBusy } = useBusyKeys()
  const [editReceiptId, setEditReceiptId] = React.useState<number | null>(null)
  const [editPaymentId, setEditPaymentId] = React.useState<number | null>(null)

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
  const [receiptStatement, setReceiptStatement] = React.useState(false)
  const [receiptAccountId, setReceiptAccountId] = React.useState<number | null>(
    master.bankAccounts.find((a) => a.isActive)?.id ?? null,
  )

  // Payment Voucher modal
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [paymentDate, setPaymentDate] = React.useState(todayIso())
  const [paymentSupplierId, setPaymentSupplierId] = React.useState<number>(
    master.suppliers[0]?.id ?? 1,
  )
  const [paymentAmount, setPaymentAmount] = React.useState(100_000_000)
  const [paymentAccountId, setPaymentAccountId] = React.useState<number | null>(
    master.bankAccounts.find((a) => a.isActive)?.id ?? null,
  )
  const [paymentDesc, setPaymentDesc] = React.useState('')
  const [paymentStatement, setPaymentStatement] = React.useState(false)

  const selectedCustomer = customers.find((c) => c.id === receiptCustomerId)
  const branchOptions = selectedCustomer?.branches ?? []

  const openEditReceipt = (r: (typeof receipts)[number]) => {
    setEditReceiptId(r.id)
    setReceiptDate(r.receiptDate)
    setReceiptCustomerId(r.customerId)
    setReceiptBranchId(r.branchId)
    setReceiptAmount(r.amount)
    setReceiptAccountId(r.companyBankAccountId)
    setReceiptOpen(true)
  }
  const openEditPayment = (p: (typeof payments)[number]) => {
    setEditPaymentId(p.id)
    setPaymentDate(p.paymentDate)
    setPaymentSupplierId(p.supplierId ?? 0)
    setPaymentAmount(p.amount)
    setPaymentAccountId(p.companyBankAccountId)
    setPaymentDesc(p.description ?? '')
    setPaymentOpen(true)
  }

  const deleteReceipt = useMutation({
    mutationFn: deleteReceiptVoucherFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const deletePayment = useMutation({
    mutationFn: deletePaymentVoucherFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const handleDeleteVoucher = async (
    kind: 'receipt' | 'payment',
    id: number,
    label: string,
  ) => {
    const ok = await confirmDialog({
      title: kind === 'receipt' ? 'Xóa phiếu thu này?' : 'Xóa phiếu chi này?',
      description: `${label}. Công nợ sẽ được tính lại.`,
      confirmLabel: 'Xóa',
      destructive: true,
    })
    if (!ok) return
    const key = `${kind}:${id}`
    setBusy(key, true)
    try {
      if (kind === 'receipt') await deleteReceipt.mutateAsync({ data: { id } })
      else await deletePayment.mutateAsync({ data: { id } })
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể xóa phiếu')
    } finally {
      setBusy(key, false)
    }
  }

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createReceipt.mutateAsync({
        id: editReceiptId ?? undefined,
        receiptDate,
        customerId: receiptCustomerId,
        branchId: receiptBranchId,
        amount: receiptAmount,
        companyBankAccountId: receiptAccountId,
        createStatementLine:
          !editReceiptId && !!receiptAccountId && receiptStatement,
      })
      setReceiptOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi tạo phiếu thu')
    }
  }

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createPayment.mutateAsync({
        id: editPaymentId ?? undefined,
        paymentDate,
        payeeType: 'supplier',
        supplierId: paymentSupplierId,
        amount: paymentAmount,
        companyBankAccountId: paymentAccountId,
        description: paymentDesc,
        createStatementLine:
          !editPaymentId && !!paymentAccountId && paymentStatement,
      })
      setPaymentOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi tạo phiếu chi')
    }
  }

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

          <Can permission="finance.manage">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setEditReceiptId(null)
                  setReceiptOpen(true)
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
              >
                <Plus className="size-4" />
                Lập Phiếu Thu Tiền
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditPaymentId(null)
                  setPaymentOpen(true)
                }}
                className="border-slate-300 text-slate-800 gap-1.5 shadow-xs"
              >
                <Plus className="size-4" />
                Lập Phiếu Chi
              </Button>
            </div>
          </Can>
        </div>

        {/* Tabbed interface */}
        <Tabs
          value={tab}
          onValueChange={(v) =>
            navigate({ search: { tab: v as typeof tab }, replace: true })
          }
          className="space-y-4"
        >
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
                  Ghi nhận nợ gắn liền với từng điểm bán
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Khách Hàng</TableHead>
                      <TableHead>Pháp Nhân Điểm Bán Chịu Nợ</TableHead>
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
                    {receivablesPg.pageItems.map((r, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/80">
                        <TableCell className="font-medium text-slate-900">
                          {r.customerName}
                        </TableCell>
                        <TableCell className="font-medium text-emerald-900">
                          {r.branchId ? r.entityName : 'Pháp nhân chính KH mẹ'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900">
                          {formatVnd(r.sold)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-800 font-medium">
                          {formatVnd(r.paid)}
                        </TableCell>
                        <TableCell className="text-right text-rose-900">
                          {formatVnd(r.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={receivablesPg} />
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
                    {payablesPg.pageItems.map((p) => (
                      <TableRow
                        key={p.supplierId}
                        className="hover:bg-slate-50/80"
                      >
                        <TableCell className="font-medium text-slate-900">
                          {p.supplierName}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900">
                          {formatVnd(p.purchased)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-800 font-medium">
                          {formatVnd(p.paid)}
                        </TableCell>
                        <TableCell className="text-right text-rose-900">
                          {formatVnd(p.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={payablesPg} />
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
                      <TableHead>Ngày Thu</TableHead>
                      <TableHead>Khách Hàng</TableHead>
                      <TableHead>Điểm Bán Thanh Toán</TableHead>
                      <TableHead className="text-right">Số Tiền Thu</TableHead>
                      <TableHead>Tài Khoản Nhận</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {receiptsPg.pageItems.map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/80">
                        <TableCell className="text-slate-500">
                          {formatDate(r.receiptDate)}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {r.customerName}
                        </TableCell>
                        <TableCell className="text-slate-900">
                          {r.branchName ?? 'Trực tiếp KH mẹ'}
                        </TableCell>
                        <TableCell className="text-right text-emerald-900">
                          {formatVnd(r.amount)}
                        </TableCell>
                        <TableCell className="text-slate-500 text-[11px]">
                          {r.accountNumber ? (
                            <BankLabel image={r.bankImage} name={r.bankName}>
                              {r.bankName} ({r.accountNumber})
                            </BankLabel>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <Can permission="finance.manage">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditReceipt(r)}
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                                title="Sửa"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isBusy(`receipt:${r.id}`)}
                                onClick={() =>
                                  handleDeleteVoucher(
                                    'receipt',
                                    r.id,
                                    `${r.customerName} — ${formatVnd(r.amount)}`,
                                  )
                                }
                                className="size-7 text-slate-400 hover:text-rose-600"
                                aria-label="Xóa"
                                title="Xóa"
                              >
                                <BusyTrash busy={isBusy(`receipt:${r.id}`)} />
                              </Button>
                            </div>
                          </Can>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={receiptsPg} />
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
                      <TableHead>Ngày Chi</TableHead>
                      <TableHead>Đối Tượng Nhận</TableHead>
                      <TableHead className="text-right">Số Tiền Chi</TableHead>
                      <TableHead>Nội Dung</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {paymentsPg.pageItems.map((p) => (
                      <TableRow key={p.id} className="hover:bg-slate-50/80">
                        <TableCell className="text-slate-500">
                          {formatDate(p.paymentDate)}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {p.supplierName ?? p.payeeName}
                        </TableCell>
                        <TableCell className="text-right text-rose-900">
                          {formatVnd(p.amount)}
                        </TableCell>
                        <TableCell className="text-slate-500 text-[11px]">
                          {p.description ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Can permission="finance.manage">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={p.payeeType !== 'supplier'}
                                onClick={() => openEditPayment(p)}
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                                title="Sửa"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isBusy(`payment:${p.id}`)}
                                onClick={() =>
                                  handleDeleteVoucher(
                                    'payment',
                                    p.id,
                                    `${p.supplierName ?? p.payeeName} — ${formatVnd(p.amount)}`,
                                  )
                                }
                                className="size-7 text-slate-400 hover:text-rose-600"
                                aria-label="Xóa"
                                title="Xóa"
                              >
                                <BusyTrash busy={isBusy(`payment:${p.id}`)} />
                              </Button>
                            </div>
                          </Can>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={paymentsPg} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Receipt Voucher Modal */}
        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {editReceiptId ? 'Sửa Phiếu Thu' : 'Lập Phiếu Thu Tiền Bán Xe'}
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
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Khách Hàng *</Label>
                <SearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  value={String(receiptCustomerId)}
                  onValueChange={(val) => {
                    setReceiptCustomerId(Number(val))
                    setReceiptBranchId(null)
                  }}
                >
                  {customers.map((c) => (
                    <SearchSelectItem
                      key={c.id}
                      value={String(c.id)}
                      className="text-xs"
                    >
                      {c.name}
                    </SearchSelectItem>
                  ))}
                </SearchSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Điểm Bán Thanh Toán (Công nợ trừ theo pháp nhân này)
                </Label>
                <SearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  placeholder="Chọn chi nhánh/điểm bán"
                  value={receiptBranchId ? String(receiptBranchId) : 'none'}
                  onValueChange={(val) =>
                    setReceiptBranchId(val === 'none' ? null : Number(val))
                  }
                >
                  <SearchSelectItem value="none" className="text-xs">
                    Trực tiếp KH mẹ
                  </SearchSelectItem>
                  {branchOptions.map((b) => (
                    <SearchSelectItem
                      key={b.id}
                      value={String(b.id)}
                      className="text-xs"
                    >
                      {b.name}
                    </SearchSelectItem>
                  ))}
                </SearchSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Số Tiền Thu (VNĐ) *
                </Label>
                <MoneyInput
                  required
                  value={receiptAmount}
                  onValueChange={setReceiptAmount}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Tài Khoản Nhận
                  </Label>
                  <BankAccountSelect
                    value={receiptAccountId}
                    onChange={setReceiptAccountId}
                    noneLabel="Không chọn (tiền mặt)"
                  />
                  {receiptAccountId && !editReceiptId && (
                    <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs text-slate-600">
                      <Checkbox
                        checked={receiptStatement}
                        onCheckedChange={(c) => setReceiptStatement(c === true)}
                        className="mt-0.5"
                      />
                      <span>
                        Tạo luôn dòng sao kê và khớp với phiếu thu này
                        <span className="block text-[11px] text-slate-400">
                          Dùng khi chưa nhập sao kê ngân hàng; nếu sau này nhập
                          sao kê, tránh tạo trùng.
                        </span>
                      </span>
                    </label>
                  )}
                </div>
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
                {editPaymentId ? 'Sửa Phiếu Chi' : 'Lập Phiếu Chi Tiền'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Chi trả tiền hàng cho nhà cung cấp
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
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Nhà Cung Cấp Thụ Hưởng *
                </Label>
                <SearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  value={String(paymentSupplierId)}
                  onValueChange={(val) => setPaymentSupplierId(Number(val))}
                >
                  {master.suppliers.map((s) => (
                    <SearchSelectItem
                      key={s.id}
                      value={String(s.id)}
                      className="text-xs"
                    >
                      {s.name}
                    </SearchSelectItem>
                  ))}
                </SearchSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Số Tiền Chi (VNĐ) *
                </Label>
                <MoneyInput
                  required
                  value={paymentAmount}
                  onValueChange={setPaymentAmount}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tài Khoản Chi</Label>
                <BankAccountSelect
                  value={paymentAccountId}
                  onChange={setPaymentAccountId}
                  noneLabel="Không chọn (tiền mặt)"
                />
                {paymentAccountId && !editPaymentId && (
                  <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs text-slate-600">
                    <Checkbox
                      checked={paymentStatement}
                      onCheckedChange={(c) => setPaymentStatement(c === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Tạo luôn dòng sao kê và khớp với phiếu chi này
                      <span className="block text-[11px] text-slate-400">
                        Dùng khi chưa nhập sao kê ngân hàng; nếu sau này nhập
                        sao kê, tránh tạo trùng.
                      </span>
                    </span>
                  </label>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nội Dung Chi</Label>
                <Textarea
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  placeholder="Thanh toán đợt 1 tiền hàng..."
                  maxLength={255}
                  rows={2}
                  className="h-11 min-h-16 text-sm px-4 rounded-lg"
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
