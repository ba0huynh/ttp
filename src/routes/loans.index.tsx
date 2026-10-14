import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Calculator, CheckCircle2, Landmark, Plus } from 'lucide-react'
import * as React from 'react'

import { BankLabel } from '#/components/finance/BankLabel.tsx'
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
import {
  currentUserQuery,
  loansQuery,
  masterDataQuery,
} from '#/lib/queries.ts'
import { saveLoanContractFn } from '#/server/fns/finance.ts'

export const Route = createFileRoute('/loans/')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.query(loansQuery()),
      queryClient.query(masterDataQuery()),
    ])
  },
  component: LoansPage,
})

function LoansPage() {
  const { user } = Route.useRouteContext()
  const { data: loans } = useSuspenseQuery(loansQuery())
  const { data: master } = useSuspenseQuery(masterDataQuery())
  const queryClient = useQueryClient()
  const saveLoan = useMutation({
    mutationFn: saveLoanContractFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })

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
  const savingLoan = saveLoan.isPending

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveLoan.mutateAsync({
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
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi tạo khế ước vay')
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
                        <Link
                          to="/loans/$loanId"
                          params={{ loanId: String(l.id) }}
                          className="hover:underline"
                        >
                          {l.contractNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">
                        <BankLabel image={l.bankImage} name={l.bankShortName}>
                          {l.bankShortName}
                        </BankLabel>
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
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-purple-800 gap-1 font-medium"
                        >
                          <Link
                            to="/loans/$loanId"
                            params={{ loanId: String(l.id) }}
                          >
                            <Calculator className="size-3.5" />
                            Tính lãi & Trả nợ
                          </Link>
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
                        <BankLabel image={b.image} name={b.shortName}>
                          {b.shortName} — {b.name}
                        </BankLabel>
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
      </div>
    </AppLayout>
  )
}
