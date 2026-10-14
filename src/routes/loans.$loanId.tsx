import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  Percent,
} from 'lucide-react'
import * as React from 'react'

import { BankLabel } from '#/components/finance/BankLabel.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader, StatCard } from '#/components/layout/StatCard.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
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
import {
  currentUserQuery,
  loanDetailQuery,
  masterDataQuery,
} from '#/lib/queries.ts'
import { recordLoanPaymentFn } from '#/server/fns/finance.ts'

export const Route = createFileRoute('/loans/$loanId')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async ({ context: { queryClient }, params }) => {
    const id = Number(params.loanId)
    if (!Number.isInteger(id)) throw redirect({ to: '/loans' })
    await Promise.all([
      queryClient.query(loanDetailQuery(id)),
      queryClient.query(masterDataQuery()),
    ])
  },
  errorComponent: LoanNotFound,
  component: LoanDetailPage,
})

function LoanNotFound() {
  const { user } = Route.useRouteContext()
  return (
    <AppLayout user={user}>
      <div className="py-16 text-center space-y-3">
        <p className="text-slate-600">Không tìm thấy khế ước này.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/loans">
            <ArrowLeft className="size-4" />
            Về danh sách khế ước
          </Link>
        </Button>
      </div>
    </AppLayout>
  )
}

function LoanDetailPage() {
  const { user } = Route.useRouteContext()
  const { loanId } = Route.useParams()
  const id = Number(loanId)
  const { data: loanDetail } = useSuspenseQuery(loanDetailQuery(id))
  const { data: master } = useSuspenseQuery(masterDataQuery())
  const queryClient = useQueryClient()
  const repayLoan = useMutation({
    mutationFn: recordLoanPaymentFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  // Repayment form; the interest is pre-filled with what is currently due
  const [repayDate, setRepayDate] = React.useState(todayIso())
  const [repayPrincipal, setRepayPrincipal] = React.useState(0)
  const [repayInterest, setRepayInterest] = React.useState(
    loanDetail.interestDue > 0 ? loanDetail.interestDue : 0,
  )
  const [repayBankAccountId, setRepayBankAccountId] = React.useState<
    number | null
  >(master.bankAccounts[0]?.id ?? null)
  const [repayNote, setRepayNote] = React.useState('')
  const repaying = repayLoan.isPending

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await repayLoan.mutateAsync({
        data: {
          loanContractId: id,
          paymentDate: repayDate,
          principalAmount: repayPrincipal,
          interestAmount: repayInterest,
          companyBankAccountId: repayBankAccountId,
          note: repayNote,
        },
      })
      // Same cache as useSuspenseQuery above; re-fill the interest still due
      const fresh = await queryClient.query(loanDetailQuery(id))
      setRepayPrincipal(0)
      setRepayInterest(fresh.interestDue > 0 ? fresh.interestDue : 0)
      setRepayNote('')
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi ghi nhận trả nợ')
    }
  }

  const { loan } = loanDetail

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={
            <Link
              to="/loans"
              className="inline-flex items-center gap-1 hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Danh sách khế ước
            </Link>
          }
          title={`Khế ước ${loan.contractNumber}`}
          description={
            <>
              Lãi suất: <strong>{loan.interestRate}%/năm</strong> · Giải ngân:{' '}
              {formatDate(loan.disbursementDate)} · Đáo hạn:{' '}
              {formatDate(loan.maturityDate)}
            </>
          }
          actions={
            <Badge
              variant="outline"
              className={
                loan.status === 'settled'
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }
            >
              {loan.status === 'settled' ? 'Đã tất toán' : 'Đang hoạt động'}
            </Badge>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Hạn mức vay"
            icon={Banknote}
            tone="blue"
            value={formatVnd(loan.principalAmount)}
          />
          <StatCard
            label="Dư nợ gốc"
            icon={Landmark}
            tone="violet"
            value={formatVnd(loanDetail.outstanding)}
            hint={`Đã trả gốc ${formatVnd(loanDetail.principalPaid)}`}
          />
          <StatCard
            label="Tổng lãi phát sinh"
            icon={Percent}
            tone="amber"
            value={formatVnd(loanDetail.accruedInterest)}
            hint={`Đã trả lãi ${formatVnd(loanDetail.interestPaid)}`}
          />
          <StatCard
            label="Lãi còn phải trả"
            icon={CheckCircle2}
            value={formatVnd(Math.max(loanDetail.interestDue, 0))}
            hint={`Tính đến ${formatDate(loanDetail.asOf)}`}
          />
        </div>

        <div className="space-y-5">
          {/* 0. Import batches financed by this loan contract */}
          <div className="text-xs">
            <span className="font-bold text-slate-800">
              Lô xe được tài trợ:{' '}
            </span>
            {loanDetail.batches.length === 0 ? (
              <span className="text-slate-400">
                Chưa gắn lô nào (gắn tại trang Lô Xe → Xem chi tiết)
              </span>
            ) : (
              <span className="inline-flex flex-wrap gap-1.5 align-middle">
                {loanDetail.batches.map((b) => (
                  <Badge
                    key={b.id}
                    variant="outline"
                    className="font-mono text-[11px] bg-purple-50 text-purple-700 border-purple-200"
                  >
                    <Link
                      to="/batches/$batchId"
                      params={{ batchId: String(b.id) }}
                      className="hover:underline"
                    >
                      {b.batchCode} ({formatDate(b.importDate)})
                    </Link>
                  </Badge>
                ))}
              </span>
            )}
          </div>

          {/* 1. 365-day declining balance interest schedule */}
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4">
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                <span>
                  Bảng Tính Lãi Từng Đoạn Theo Dư Nợ Giảm Dần (Quy ước 365
                  ngày):
                </span>
                <span className="text-purple-900 font-bold">
                  Tổng lãi phát sinh: {formatVnd(loanDetail.accruedInterest)}
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
            </CardContent>
          </Card>

          {/* 2. Repayment history */}
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4">
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
                        <TableHead className="text-right">Tiền Gốc</TableHead>
                        <TableHead className="text-right">Tiền Lãi</TableHead>
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
            </CardContent>
          </Card>

          {/* 3. Record New Principal / Interest Repayment Form */}
          {loanDetail.outstanding > 0 && (
            <form
              onSubmit={handleRepaySubmit}
              className="p-4 bg-purple-50/60 border border-purple-200 rounded-lg space-y-3"
            >
              <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                <CreditCard className="size-4 text-purple-700" />
                Ghi Nhận Đợt Trả Nợ Gốc / Lãi Mới:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-xs">
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
                      repayBankAccountId ? String(repayBankAccountId) : 'none'
                    }
                    onValueChange={(val) =>
                      setRepayBankAccountId(val === 'none' ? null : Number(val))
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
                          <BankLabel
                            image={a.bankImage}
                            name={a.bankShortName}
                          >
                            {a.bankShortName} &bull; {a.accountNumber}
                          </BankLabel>
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
                    repaying || (repayPrincipal <= 0 && repayInterest <= 0)
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
      </div>
    </AppLayout>
  )
}
