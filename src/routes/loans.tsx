import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  Calculator,
  CheckCircle2,
  CreditCard,
  Landmark,
  Plus,
} from 'lucide-react'
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
import { formatDate, formatVnd, todayIso } from '#/lib/business.ts'
import { getCurrentUserFn } from '#/server/fns/auth.ts'
import {
  getLoanDetailFn,
  listLoansFn,
  recordLoanPaymentFn,
  saveLoanContractFn,
} from '#/server/fns/finance.ts'
import { getMasterDataFn } from '#/server/fns/master-data.ts'

export const Route = createFileRoute('/loans')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async () => {
    const [loans, master] = await Promise.all([
      listLoansFn(),
      getMasterDataFn(),
    ])
    return { loans, master }
  },
  component: LoansPage,
})

function LoansPage() {
  const { user } = Route.useRouteContext()
  const { loans, master } = Route.useLoaderData()

  // New loan contract modal
  const [newLoanOpen, setNewLoanOpen] = React.useState(false)
  const [contractNumber, setContractNumber] = React.useState(
    `KU-${todayIso().slice(0, 4)}-VCB-01`,
  )
  const [bankId, setBankId] = React.useState<number>(master.banks[0]?.id ?? 1)
  const [principalAmount, setPrincipalAmount] = React.useState(2_000_000_000)
  const [interestRate, setInterestRate] = React.useState(8.5)
  const [disbursementDate, setDisbursementDate] = React.useState(todayIso())
  const [maturityDate, setMaturityDate] = React.useState('2026-12-31')
  const [note, setNote] = React.useState('')
  const [savingLoan, setSavingLoan] = React.useState(false)

  // Loan details & Repayment modal
  const [selectedLoanId, setSelectedLoanId] = React.useState<number | null>(
    null,
  )
  const [loanDetail, setLoanDetail] = React.useState<any>(null)
  const [loadingDetail, setLoadingDetail] = React.useState(false)

  // Repayment form
  const [repayDate, setRepayDate] = React.useState(todayIso())
  const [repayPrincipal, setRepayPrincipal] = React.useState(0)
  const [repayInterest, setRepayInterest] = React.useState(0)
  const [repayBankAccountId, setRepayBankAccountId] = React.useState<
    number | null
  >(master.bankAccounts[0]?.id ?? null)
  const [repayNote, setRepayNote] = React.useState('')
  const [repaying, setRepaying] = React.useState(false)

  const viewDetail = async (id: number) => {
    setSelectedLoanId(id)
    setLoadingDetail(true)
    try {
      const res = await getLoanDetailFn({ data: { id } })
      setLoanDetail(res)
      setRepayInterest(res.interestDue > 0 ? res.interestDue : 0)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingLoan(true)
    try {
      await saveLoanContractFn({
        data: {
          contractNumber,
          bankId,
          principalAmount,
          interestRate,
          disbursementDate,
          maturityDate,
          note,
        },
      })
      setNewLoanOpen(false)
      window.location.reload()
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi tạo khế ước vay')
    } finally {
      setSavingLoan(false)
    }
  }

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLoanId) return
    setRepaying(true)
    try {
      await recordLoanPaymentFn({
        data: {
          loanContractId: selectedLoanId,
          paymentDate: repayDate,
          principalAmount: repayPrincipal,
          interestAmount: repayInterest,
          companyBankAccountId: repayBankAccountId,
          note: repayNote,
        },
      })
      await viewDetail(selectedLoanId)
      window.location.reload()
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi ghi nhận trả nợ')
    } finally {
      setRepaying(false)
    }
  }

  const totalPrincipal = loans.reduce((s, l) => s + l.principalAmount, 0)
  const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0)
  const totalRepaid = loans.reduce((s, l) => s + l.principalPaid, 0)

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Khế Ước Vay Vốn Ngân Hàng
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Tính lãi theo{' '}
              <strong>dư nợ giảm dần (quy ước 365 ngày/năm)</strong>, chia đoạn
              chính xác theo từng lần trả gốc thực tế.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setNewLoanOpen(true)}
            className="bg-purple-700 hover:bg-purple-800 text-white gap-1.5 shadow-xs"
          >
            <Plus className="size-4" />
            Tạo Khế Ước Mới
          </Button>
        </div>

        {/* 3 Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-slate-500 font-medium">
                Tổng Tiền Đã Vay Giải Ngân
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {formatVnd(totalPrincipal)}
              </div>
              <div className="text-[11px] text-slate-500">
                {loans.length} khế ước tín dụng
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50/40">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-purple-800 font-medium flex items-center gap-1">
                <Landmark className="size-3.5" />
                Dư Nợ Gốc Hiện Tại
              </div>
              <div className="text-2xl font-black text-purple-950 mt-1">
                {formatVnd(totalOutstanding)}
              </div>
              <div className="text-[11px] text-purple-700">
                Đang chịu lãi hàng ngày
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-emerald-800 font-medium flex items-center gap-1">
                <CheckCircle2 className="size-3.5" />
                Gốc Đã Trả Ngân Hàng
              </div>
              <div className="text-2xl font-black text-emerald-950 mt-1">
                {formatVnd(totalRepaid)}
              </div>
              <div className="text-[11px] text-emerald-700">
                Giảm trừ dư nợ thành công
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loan Contracts Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh Sách Khế Ước Vay Ngân Hàng ({loans.length})
            </CardTitle>
            <div className="text-xs text-slate-500">
              Quy ước 365 ngày &bull; Dư nợ giảm dần
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50/70">
                    <TableHead>Số Khế Ước</TableHead>
                    <TableHead>Ngân Hàng</TableHead>
                    <TableHead className="text-right">Hạn Mức Vay</TableHead>
                    <TableHead className="text-center">Lãi Suất</TableHead>
                    <TableHead>Ngày Giải Ngân</TableHead>
                    <TableHead>Ngày Đáo Hạn</TableHead>
                    <TableHead className="text-right">Gốc Đã Trả</TableHead>
                    <TableHead className="text-right">Dư Nợ Còn Lại</TableHead>
                    <TableHead className="text-center">Trạng Thái</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {loans.map((l) => (
                    <TableRow key={l.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-mono font-bold text-purple-900">
                        {l.contractNumber}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">
                        {l.bankShortName}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatVnd(l.principalAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="font-medium text-[11px]"
                        >
                          {l.interestRate}%/năm
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {formatDate(l.disbursementDate)}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {formatDate(l.maturityDate)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-800 font-medium">
                        {formatVnd(l.principalPaid)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-purple-900">
                        {formatVnd(l.outstanding)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            l.status === 'settled'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }
                        >
                          {l.status === 'settled'
                            ? 'Đã tất toán'
                            : 'Đang hoạt động'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-purple-800 gap-1 font-medium"
                          onClick={() => viewDetail(l.id)}
                        >
                          <Calculator className="size-3.5" />
                          Tính lãi & Trả nợ
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Create New Loan Contract Modal */}
        <Dialog open={newLoanOpen} onOpenChange={setNewLoanOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Tạo Khế Ước Vay Ngân Hàng Mới
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ghi nhận hợp đồng tín dụng tài trợ nhập khẩu lô xe
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateLoan} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Số Khế Ước / Hợp Đồng Tín Dụng *
                </Label>
                <Input
                  required
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Ngân Hàng Thương Mại *
                </Label>
                <Select
                  value={String(bankId)}
                  onValueChange={(val) => setBankId(Number(val))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {master.banks.map((b) => (
                      <SelectItem
                        key={b.id}
                        value={String(b.id)}
                        className="text-xs"
                      >
                        {b.shortName} — {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Số Tiền Vay (VNĐ) *
                  </Label>
                  <Input
                    type="number"
                    min="1000000"
                    step="10000000"
                    required
                    value={principalAmount}
                    onChange={(e) =>
                      setPrincipalAmount(Number(e.target.value) || 0)
                    }
                    className="h-8 text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Lãi Suất (%/năm) *
                  </Label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    required
                    value={interestRate}
                    onChange={(e) =>
                      setInterestRate(Number(e.target.value) || 0)
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Ngày Giải Ngân *
                  </Label>
                  <Input
                    type="date"
                    required
                    value={disbursementDate}
                    onChange={(e) => setDisbursementDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Ngày Đáo Hạn *
                  </Label>
                  <Input
                    type="date"
                    required
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ghi Chú</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Mục đích vay vốn..."
                  className="h-8 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewLoanOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={savingLoan}
                  size="sm"
                  className="h-8 text-xs bg-purple-700 hover:bg-purple-800 text-white font-semibold"
                >
                  {savingLoan ? 'Đang lưu...' : 'Lưu Khế Ước'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Loan Details & Repayment Modal & 365-day segment interest schedule */}
        <Dialog
          open={selectedLoanId !== null}
          onOpenChange={(open) => !open && setSelectedLoanId(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
                <span>
                  Khế Ước:{' '}
                  <span className="font-mono text-purple-800">
                    {loanDetail?.loan?.contractNumber}
                  </span>
                </span>
                <span className="text-sm font-semibold text-slate-600">
                  Lãi suất: {loanDetail?.loan?.interestRate}%/năm &bull; Dư nợ:{' '}
                  {formatVnd(loanDetail?.outstanding)}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Giải ngân: {formatDate(loanDetail?.loan?.disbursementDate)}{' '}
                &bull; Đáo hạn: {formatDate(loanDetail?.loan?.maturityDate)}
              </DialogDescription>
            </DialogHeader>

            {loadingDetail ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Đang tính toán dư nợ và lãi vay...
              </div>
            ) : loanDetail ? (
              <div className="space-y-5 pt-2">
                {/* 1. 365-day declining balance interest schedule */}
                <div>
                  <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                    <span>
                      Bảng Tính Lãi Từng Đoạn Theo Dư Nợ Giảm Dần (Quy ước 365
                      ngày):
                    </span>
                    <span className="text-purple-900 font-bold">
                      Tổng lãi phát sinh:{' '}
                      {formatVnd(loanDetail.accruedInterest)}
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs bg-slate-50">
                          <TableHead>Từ Ngày</TableHead>
                          <TableHead>Đến Ngày</TableHead>
                          <TableHead className="text-center">Số Ngày</TableHead>
                          <TableHead className="text-right">
                            Dư Nợ Đoạn Này
                          </TableHead>
                          <TableHead className="text-right">
                            Lãi Phát Sinh
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs font-mono">
                        {loanDetail.segments.map((seg: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>{formatDate(seg.from)}</TableCell>
                            <TableCell>{formatDate(seg.to)}</TableCell>
                            <TableCell className="text-center">
                              {seg.days} ngày
                            </TableCell>
                            <TableCell className="text-right font-medium text-slate-700">
                              {formatVnd(seg.outstanding)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-purple-900">
                              {formatVnd(seg.interest)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* 2. Repayment history */}
                <div>
                  <div className="text-xs font-bold text-slate-800 mb-2">
                    Lịch Sử Các Đợt Đã Trả Nợ (Gốc:{' '}
                    {formatVnd(loanDetail.principalPaid)} &bull; Lãi:{' '}
                    {formatVnd(loanDetail.interestPaid)}):
                  </div>
                  {loanDetail.repayments.length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-2">
                      Chưa có đợt thanh toán nào.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs bg-slate-50">
                            <TableHead>Ngày Trả</TableHead>
                            <TableHead className="text-right">
                              Tiền Gốc
                            </TableHead>
                            <TableHead className="text-right">
                              Tiền Lãi
                            </TableHead>
                            <TableHead className="text-right">
                              Tổng Thanh Toán
                            </TableHead>
                            <TableHead>Ghi Chú</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {loanDetail.repayments.map((r: any) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">
                                {formatDate(r.paymentDate)}
                              </TableCell>
                              <TableCell className="text-right text-emerald-800 font-bold">
                                {formatVnd(r.principalAmount)}
                              </TableCell>
                              <TableCell className="text-right text-purple-800 font-bold">
                                {formatVnd(r.interestAmount)}
                              </TableCell>
                              <TableCell className="text-right font-black text-slate-900">
                                {formatVnd(
                                  Number(r.principalAmount) +
                                    Number(r.interestAmount),
                                )}
                              </TableCell>
                              <TableCell className="text-slate-500">
                                {r.note ?? '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* 3. Record New Principal / Interest Repayment Form */}
                {loanDetail.outstanding > 0 && (
                  <form
                    onSubmit={handleRepaySubmit}
                    className="p-3 bg-purple-50/60 border border-purple-200 rounded-lg space-y-3"
                  >
                    <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <CreditCard className="size-4 text-purple-700" />
                      Ghi Nhận Đợt Trả Nợ Gốc / Lãi Mới:
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">
                          Ngày Thanh Toán *
                        </Label>
                        <Input
                          type="date"
                          required
                          value={repayDate}
                          onChange={(e) => setRepayDate(e.target.value)}
                          className="h-8 text-xs bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">
                          Trả Nợ Gốc (VNĐ)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="1000000"
                          value={repayPrincipal}
                          onChange={(e) =>
                            setRepayPrincipal(Number(e.target.value) || 0)
                          }
                          className="h-8 text-xs bg-white font-bold text-emerald-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">
                          Trả Nợ Lãi (VNĐ)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="10000"
                          value={repayInterest}
                          onChange={(e) =>
                            setRepayInterest(Number(e.target.value) || 0)
                          }
                          className="h-8 text-xs bg-white font-bold text-purple-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">
                          Tài Khoản Chi Tiền
                        </Label>
                        <Select
                          value={
                            repayBankAccountId
                              ? String(repayBankAccountId)
                              : 'none'
                          }
                          onValueChange={(val) =>
                            setRepayBankAccountId(
                              val === 'none' ? null : Number(val),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-xs bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {master.bankAccounts.map((a) => (
                              <SelectItem
                                key={a.id}
                                value={String(a.id)}
                                className="text-xs"
                              >
                                {a.bankShortName} &bull; {a.accountNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Input
                        placeholder="Nội dung/ghi chú chuyển khoản..."
                        value={repayNote}
                        onChange={(e) => setRepayNote(e.target.value)}
                        className="h-8 text-xs bg-white max-w-md mr-2"
                      />
                      <Button
                        type="submit"
                        disabled={
                          repaying ||
                          (repayPrincipal <= 0 && repayInterest <= 0)
                        }
                        size="sm"
                        className="h-8 text-xs bg-purple-700 hover:bg-purple-800 text-white font-semibold shrink-0"
                      >
                        {repaying ? 'Đang lưu...' : 'Xác Nhận Trả Nợ'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
