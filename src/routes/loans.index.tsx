import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Calculator, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'

import { BankLabel } from '#/components/finance/BankLabel.tsx'
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
import { DecimalInput } from '#/components/ui/decimal-input.tsx'
import { Input } from '#/components/ui/input.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import { Label } from '#/components/ui/label.tsx'
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
  addMonthsIso,
  estimateLoanTermInterest,
  formatDate,
  formatVnd,
  todayIso,
} from '#/lib/business.ts'
import { currentUserQuery, loansQuery, masterDataQuery } from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import { confirmDelete, reportDeleteFailure } from '#/lib/usage.ts'
import {
  deleteLoanContractFn,
  saveLoanContractFn,
} from '#/server/fns/finance.ts'

/** Selectable loan terms: 1 to 200 months */
const TERM_OPTIONS = Array.from({ length: 200 }, (_, i) => i + 1)

export const Route = createFileRoute('/loans/')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'loans.view')
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
  const loansPg = usePagination(loans)
  const { data: master } = useSuspenseQuery(masterDataQuery())
  const queryClient = useQueryClient()
  const deleteLoan = useMutation({
    mutationFn: deleteLoanContractFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
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
  const [termMonths, setTermMonths] = React.useState(12)
  // What the user typed so far, shown live under the form
  const estimate = estimateLoanTermInterest(
    principalAmount,
    interestRate,
    termMonths,
  )
  const savingLoan = saveLoan.isPending

  const handleDelete = async (l: { id: number; contractNumber: string }) => {
    // Used loans show what uses them; unused ones ask for confirmation
    const ok = await confirmDelete(
      { entity: 'loans', id: l.id, name: l.contractNumber },
      {
        title: `Xóa khế ước ${l.contractNumber}?`,
        description: 'Hành động này không thể hoàn tác.',
      },
    )
    if (!ok) return
    try {
      await deleteLoan.mutateAsync({ data: { id: l.id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity: 'loans', id: l.id, name: l.contractNumber },
        'Không thể xóa khế ước',
      )
    }
  }

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
          termMonths,
        },
      })
      setNewLoanOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi tạo khế ước vay')
    }
  }

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
          <Can permission="loans.manage">
            <Button
              size="sm"
              onClick={() => setNewLoanOpen(true)}
              className="bg-purple-700 hover:bg-purple-800 text-white gap-1.5 shadow-xs"
            >
              <Plus className="size-4" />
              Tạo Khế Ước Mới
            </Button>
          </Can>
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
                    <TableHead className="text-center">Lãi Suất</TableHead>
                    <TableHead className="text-center">Kỳ Hạn</TableHead>
                    <TableHead className="text-right">Gốc Đã Trả</TableHead>
                    <TableHead className="text-right">Dư Nợ Còn Lại</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {loansPg.pageItems.map((l) => (
                    <TableRow key={l.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-medium text-purple-900">
                        <Link
                          to="/loans/$loanId"
                          params={{ loanId: String(l.id) }}
                          className="hover:underline"
                        >
                          {l.contractNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        <BankLabel image={l.bankImage} name={l.bankName}>
                          {l.bankName}
                        </BankLabel>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="font-medium text-[11px]"
                        >
                          {l.interestRate}%/năm
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-slate-900">
                        {l.termMonths} tháng
                      </TableCell>
                      <TableCell className="text-right text-emerald-800 font-medium">
                        {formatVnd(l.principalPaid)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-purple-900">
                        {formatVnd(l.outstanding)}
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
                        <Can permission="loans.manage">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(l)}
                            className="size-7 text-slate-400 hover:text-rose-600"
                            aria-label="Xóa khế ước"
                            title="Xóa khế ước"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination pagination={loansPg} />
          </CardContent>
        </Card>

        {/* Create New Loan Contract Modal */}
        <Dialog open={newLoanOpen} onOpenChange={setNewLoanOpen}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Tạo Khế Ước Vay Ngân Hàng Mới
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateLoan} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Khế Ước Vay *</Label>
                <Input
                  required
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Ngân Hàng Thương Mại *
                </Label>
                <SearchSelect
                  className="h-8 w-full text-xs"
                  value={String(bankId)}
                  onValueChange={(val) => setBankId(Number(val))}
                >
                  {master.banks.map((b) => (
                    <SearchSelectItem
                      key={b.id}
                      value={String(b.id)}
                      keywords={`${b.code ?? ''} ${b.shortName ?? ''}`}
                      className="text-xs"
                    >
                      <BankLabel image={b.image} name={b.name}>
                        {b.name}
                      </BankLabel>
                    </SearchSelectItem>
                  ))}
                </SearchSelect>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Số Tiền Vay (VNĐ) *
                  </Label>
                  <MoneyInput
                    required
                    value={principalAmount}
                    onValueChange={setPrincipalAmount}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Lãi Suất (%/năm) *
                  </Label>
                  <DecimalInput
                    maxDecimals={3}
                    required
                    value={interestRate}
                    onValueChange={setInterestRate}
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
                  <Label className="text-xs font-semibold">Kỳ Hạn Vay *</Label>
                  <SearchSelect
                    value={String(termMonths)}
                    onValueChange={(v) => setTermMonths(Number(v))}
                    className="h-8 w-full text-xs"
                    placeholder="Chọn kỳ hạn"
                  >
                    {TERM_OPTIONS.map((n) => (
                      <SearchSelectItem
                        key={n}
                        value={String(n)}
                        className="text-xs"
                      >
                        {n} tháng
                      </SearchSelectItem>
                    ))}
                  </SearchSelect>
                </div>
              </div>

              <div className="space-y-1 rounded-md border border-purple-200 bg-purple-50/60 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Lãi ước tính mỗi tháng</span>
                  <span className="font-medium text-purple-900">
                    {formatVnd(estimate.monthly)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">
                    Tổng lãi cả kỳ hạn ({termMonths} tháng)
                  </span>
                  <span className="font-medium text-purple-900">
                    {formatVnd(estimate.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Đáo hạn dự kiến</span>
                  <span className="font-medium text-slate-900">
                    {formatDate(addMonthsIso(disbursementDate, termMonths))}
                  </span>
                </div>
                <p className="pt-1 text-[11px] text-slate-500">
                  Ước tính theo lãi đơn trên toàn bộ gốc. Lãi thực tế tính theo
                  dư nợ giảm dần ở trang chi tiết khế ước.
                </p>
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
