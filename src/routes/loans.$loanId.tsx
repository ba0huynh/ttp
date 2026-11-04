import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  Plus,
  X,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { BankAccountSelect } from '#/components/finance/BankAccountSelect.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader } from '#/components/layout/StatCard.tsx'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import { confirmDialog, showErrorDialog } from '#/components/ui/confirm-dialog.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
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
  calculateLoanInterest,
  expandInterestByDay,
  formatDate,
  formatVnd,
  todayIso,
} from '#/lib/business.ts'
import {
  currentUserQuery,
  loanDetailQuery,
  masterDataQuery,
} from '#/lib/queries.ts'
import { hasPermission } from '#/lib/permissions.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import { cn, handleRowArrowNavigation } from '#/lib/utils.ts'
import { useBusyKeys } from '#/lib/use-busy.ts'
import {
  deleteLoanPaymentFn,
  recordLoanPaymentFn,
  updateLoanPaymentFn,
} from '#/server/fns/finance.ts'

export const Route = createFileRoute('/loans/$loanId')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'loans.view')
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
  const canManage = hasPermission(user, 'loans.manage')
  // Newest payment first (same day: the one recorded last)
  const sortedRepayments = React.useMemo(
    () =>
      [...loanDetail.repayments].sort(
        (a, b) =>
          String(b.paymentDate).localeCompare(String(a.paymentDate)) ||
          b.id - a.id,
      ),
    [loanDetail.repayments],
  )
  const repaymentsPg = usePagination<any>(sortedRepayments)

  // One record per day (newest first): easier to follow than long segments
  const dailyRows = React.useMemo(
    () => expandInterestByDay(loanDetail.segments).reverse(),
    [loanDetail.segments],
  )
  const dailyPg = usePagination(dailyRows)
  const queryClient = useQueryClient()
  const { isBusy, setBusy } = useBusyKeys()

  const repayLoan = useMutation({
    mutationFn: recordLoanPaymentFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const updateRepayment = useMutation({
    mutationFn: updateLoanPaymentFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const deleteRepayment = useMutation({
    mutationFn: deleteLoanPaymentFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const isSaving = repayLoan.isPending || updateRepayment.isPending
  const savingRef = React.useRef(false)

  // Inline repayment edit / create state
  const [editingRepaymentId, setEditingRepaymentId] = React.useState<
    number | 'new' | null
  >(null)
  const [rSubmitted, setRSubmitted] = React.useState(false)
  const [rDraft, setRDraft] = React.useState<{
    paymentDate: string
    principalAmount: number
    interestAmount: number
    companyBankAccountId: number | null
  }>({
    paymentDate: todayIso(),
    principalAmount: 0,
    interestAmount: 0,
    companyBankAccountId: null,
  })

  const { loan } = loanDetail
  const currentInterestLeft = Math.max(
    0,
    loanDetail.accruedInterest - loanDetail.interestPaid,
  )
  const currentTotalOwing = loanDetail.outstanding + currentInterestLeft

  const otherRepayments = React.useMemo(() => {
    return loanDetail.repayments.filter((r) => r.id !== editingRepaymentId)
  }, [loanDetail.repayments, editingRepaymentId])

  const maxPrincipalAllowed = React.useMemo(() => {
    const otherPaid = otherRepayments.reduce(
      (s, r) => s + (Number(r.principalAmount) || 0),
      0,
    )
    return Math.max(0, loan.principalAmount - otherPaid)
  }, [loan.principalAmount, otherRepayments])

  const maxInterestAllowed = React.useMemo(() => {
    if (!rDraft.paymentDate || rDraft.paymentDate < loan.disbursementDate) {
      return 0
    }
    const result = calculateLoanInterest({
      principal: loan.principalAmount,
      annualRatePercent: loan.interestRate,
      disbursementDate: loan.disbursementDate,
      asOf: rDraft.paymentDate,
      principalRepayments: otherRepayments.map((r) => ({
        date: r.paymentDate,
        amount: Number(r.principalAmount) || 0,
      })),
    })
    const otherPaid = otherRepayments.reduce(
      (s, r) => s + (Number(r.interestAmount) || 0),
      0,
    )
    return Math.max(0, result.totalInterest - otherPaid)
  }, [loan, rDraft.paymentDate, otherRepayments])

  const accountLabel = React.useCallback(
    (bankAccountId: number | null | undefined) => {
      if (!bankAccountId) return '—'
      const acc = master.bankAccounts.find((a) => a.id === bankAccountId)
      if (!acc) return '—'
      return `${acc.bankCode || acc.bankName} - ${acc.accountNumber}`
    },
    [master.bankAccounts],
  )

  const startAddRepayment = () => {
    if (isSaving) return
    const today = todayIso()

    setRDraft({
      paymentDate: today,
      principalAmount: 0,
      interestAmount: 0,
      companyBankAccountId:
        master.bankAccounts.find((a) => a.isActive)?.id ?? null,
    })
    setRSubmitted(false)
    setEditingRepaymentId('new')
  }

  const startEditRepayment = (r: (typeof loanDetail.repayments)[number]) => {
    if (isSaving) return
    setRDraft({
      paymentDate: r.paymentDate,
      principalAmount: Number(r.principalAmount) || 0,
      interestAmount: Number(r.interestAmount) || 0,
      companyBankAccountId: r.companyBankAccountId ?? null,
    })
    setRSubmitted(false)
    setEditingRepaymentId(r.id)
  }

  const cancelRepaymentEdit = () => {
    if (isSaving) return
    setEditingRepaymentId(null)
    setRSubmitted(false)
  }

  const saveRepaymentInline = async () => {
    if (isSaving || savingRef.current) return
    savingRef.current = true
    setRSubmitted(true)
    if (!rDraft.paymentDate) {
      toast.error('Vui lòng chọn ngày thanh toán (viền đỏ)')
      return
    }
    if (rDraft.paymentDate < loan.disbursementDate) {
      toast.error(
        `Ngày thanh toán (${formatDate(rDraft.paymentDate)}) không thể trước ngày giải ngân (${formatDate(loan.disbursementDate)})`,
      )
      return
    }
    if (rDraft.principalAmount <= 0 && rDraft.interestAmount <= 0) {
      toast.error('Vui lòng nhập số tiền gốc hoặc lãi cần trả (viền đỏ)')
      return
    }
    if (rDraft.principalAmount > maxPrincipalAllowed + 0.5) {
      toast.error(
        `Số tiền trả gốc (${formatVnd(rDraft.principalAmount)}) vượt quá dư nợ gốc còn lại (tối đa ${formatVnd(maxPrincipalAllowed)})`,
      )
      return
    }
    if (rDraft.interestAmount > maxInterestAllowed + 1.0) {
      toast.error(
        `Số tiền trả lãi (${formatVnd(rDraft.interestAmount)}) vượt quá số lãi phát sinh đến ngày ${formatDate(rDraft.paymentDate)} (tối đa ${formatVnd(maxInterestAllowed)})`,
      )
      return
    }

    try {
      if (editingRepaymentId === 'new') {
        await repayLoan.mutateAsync({
          data: {
            loanContractId: id,
            paymentDate: rDraft.paymentDate,
            principalAmount: rDraft.principalAmount,
            interestAmount: rDraft.interestAmount,
            companyBankAccountId: rDraft.companyBankAccountId,
          },
        })
        toast.success('Đã ghi nhận đợt trả nợ')
      } else if (typeof editingRepaymentId === 'number') {
        const orig = loanDetail.repayments.find(
          (x) => x.id === editingRepaymentId,
        )
        const hasChanged =
          !orig ||
          orig.paymentDate !== rDraft.paymentDate ||
          Number(orig.principalAmount) !== rDraft.principalAmount ||
          Number(orig.interestAmount) !== rDraft.interestAmount ||
          orig.companyBankAccountId !== rDraft.companyBankAccountId

        if (hasChanged) {
          await updateRepayment.mutateAsync({
            data: {
              id: editingRepaymentId,
              paymentDate: rDraft.paymentDate,
              principalAmount: rDraft.principalAmount,
              interestAmount: rDraft.interestAmount,
              companyBankAccountId: rDraft.companyBankAccountId,
            },
          })
          toast.success('Đã cập nhật đợt trả nợ')
        }
      }
      setEditingRepaymentId(null)
      setRSubmitted(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu đợt trả nợ')
    } finally {
      savingRef.current = false
    }
  }

  const handleDeleteRepayment = async (
    r: (typeof loanDetail.repayments)[number],
  ) => {
    const totalAmount =
      Number(r.principalAmount) + Number(r.interestAmount)
    const ok = await confirmDialog({
      title: 'Xóa đợt trả nợ này?',
      description: `Đợt trả nợ ngày ${formatDate(r.paymentDate)} với tổng tiền ${formatVnd(totalAmount)} sẽ bị xóa vĩnh viễn và lịch tính lãi sẽ được tính lại tự động.`,
      confirmLabel: 'Xác nhận xóa',
      destructive: true,
    })
    if (!ok) return
    const busyKey = `repayment:${r.id}`
    setBusy(busyKey, true)
    try {
      await deleteRepayment.mutateAsync({ data: { id: r.id } })
      toast.success('Đã xóa đợt trả nợ')
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi xóa đợt trả nợ')
    } finally {
      setBusy(busyKey, false)
    }
  }

  const handleRepaymentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const active = document.activeElement as HTMLElement | null
      if (
        active?.closest(
          '[data-radix-popper-content-wrapper], [role="dialog"], [data-radix-popover-content]',
        ) ||
        active?.getAttribute('aria-haspopup') === 'dialog' ||
        active?.getAttribute('data-state') === 'open'
      )
        return
      e.preventDefault()
      e.stopPropagation()
      saveRepaymentInline()
      return
    }
    if (e.key === 'Escape') {
      const active = document.activeElement
      if (
        active?.closest(
          '[data-radix-popper-content-wrapper], [role="dialog"]',
        )
      )
        return
      e.preventDefault()
      e.stopPropagation()
      cancelRepaymentEdit()
      return
    }
    handleRowArrowNavigation(e)
  }

  const hasZeroError =
    rSubmitted && rDraft.principalAmount <= 0 && rDraft.interestAmount <= 0
  const hasInterestOverError =
    editingRepaymentId !== null &&
    rDraft.interestAmount > maxInterestAllowed + 1.0
  const hasPrincipalOverError =
    editingRepaymentId !== null &&
    rDraft.principalAmount > maxPrincipalAllowed + 0.5

  const renderEditingRow = (key: string | number, rowNo: number | string) => {
    return (
      <TableRow
        key={key}
        className="bg-purple-50/50 border-y border-purple-300"
        onKeyDown={handleRepaymentKeyDown}
      >
        <TableCell className="text-center text-muted-foreground">
          {rowNo}
        </TableCell>
        <TableCell className="p-2 align-middle">
          <Input
            type="date"
            required
            disabled={isSaving}
            value={rDraft.paymentDate}
            onChange={(e) =>
              setRDraft({ ...rDraft, paymentDate: e.target.value })
            }
            className={cn(
              'h-8 text-xs bg-white',
              rSubmitted &&
                !rDraft.paymentDate &&
                'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20',
            )}
          />
        </TableCell>
        <TableCell className="p-2 align-middle text-right">
          <MoneyInput
            value={rDraft.principalAmount}
            disabled={isSaving}
            onValueChange={(val: number) =>
              setRDraft((prev) => ({ ...prev, principalAmount: val }))
            }
            blankZero
            placeholder="Tiền gốc"
            title={`Tối đa có thể trả: ${formatVnd(maxPrincipalAllowed)}`}
            className={cn(
              'h-8 text-xs text-right bg-white',
              (hasZeroError || hasPrincipalOverError) &&
                'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20',
            )}
          />
        </TableCell>
        <TableCell className="p-2 align-middle text-right">
          <MoneyInput
            value={rDraft.interestAmount}
            disabled={isSaving}
            onValueChange={(val: number) =>
              setRDraft((prev) => ({ ...prev, interestAmount: val }))
            }
            blankZero
            placeholder="Tiền lãi"
            title={`Tối đa có thể trả đến ngày này: ${formatVnd(maxInterestAllowed)}`}
            className={cn(
              'h-8 text-xs text-right bg-white',
              (hasZeroError || hasInterestOverError) &&
                'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20',
            )}
          />
        </TableCell>
        <TableCell className="p-2 align-middle">
          <BankAccountSelect
            compact
            className="w-full h-8 text-xs bg-white rounded-lg"
            value={rDraft.companyBankAccountId}
            onChange={(val) =>
              setRDraft((prev) => ({
                ...prev,
                companyBankAccountId: val,
              }))
            }
          />
        </TableCell>
        <TableCell className="p-2 align-middle text-right font-semibold text-slate-900">
          {formatVnd(
            (Number(rDraft.principalAmount) || 0) +
              (Number(rDraft.interestAmount) || 0),
          )}
        </TableCell>
        <TableCell className="text-right whitespace-nowrap p-2 align-middle">
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-purple-700 hover:text-purple-800 hover:bg-purple-100/60"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={saveRepaymentInline}
              disabled={isSaving}
              aria-label="Lưu đợt trả nợ"
              title="Lưu (Enter)"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin text-purple-700" />
              ) : (
                <Check className="size-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={cancelRepaymentEdit}
              disabled={isSaving}
              aria-label="Hủy chỉnh sửa"
              title="Hủy (Esc)"
            >
              <X className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

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
              {loan.bankName && (
                <>
                  Ngân hàng: <strong>{loan.bankName}</strong>
                  {loan.accountNumber && (
                    <>
                      {' '}· STK: <strong>{loan.accountNumber}</strong>
                    </>
                  )}{' '}
                  ·{' '}
                </>
              )}
              Lãi suất: <strong>{loan.interestRate}%/năm</strong> · Giải ngân:{' '}
              {formatDate(loan.disbursementDate)} · Kỳ hạn:{' '}
              <strong>{loan.termMonths} tháng</strong> (đáo hạn dự kiến{' '}
              {formatDate(addMonthsIso(loan.disbursementDate, loan.termMonths))}
              )
            </>
          }
        />

        <div className="space-y-5">
          {/* 1. 365-day declining balance interest schedule */}
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4">
              <div className="text-xs font-bold text-slate-800 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  Bảng Tính Lãi Theo Từng Ngày, Dư Nợ Giảm Dần (Quy ước 365
                  ngày):
                </span>
                <span className="text-slate-600 font-medium">
                  Lãi phát sinh lũy kế:{' '}
                  <strong className="text-slate-900 font-bold tabular">
                    {formatVnd(loanDetail.accruedInterest)}
                  </strong>
                </span>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
<TableHead className="w-12 text-center">STT</TableHead>
                      <TableHead>Ngày</TableHead>
                      <TableHead className="text-right">Gốc Đã Trả</TableHead>
                      <TableHead className="text-right">
                        Dư Nợ Trong Ngày
                      </TableHead>
                      <TableHead className="text-right">Lãi Trong Ngày</TableHead>
                      <TableHead className="text-right">Lãi Lũy Kế</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {dailyPg.pageItems.map((d, rowIdx) => (
                      <TableRow key={d.date}>
<TableCell className="text-center text-muted-foreground">{dailyPg.pageSize * (dailyPg.page - 1) + rowIdx + 1}</TableCell>
                        <TableCell>{formatDate(d.date)}</TableCell>
                        <TableCell className="text-right text-emerald-800 font-medium">
                          {formatVnd(loan.principalAmount - d.outstanding)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-purple-900">
                          {formatVnd(d.outstanding)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-purple-900">
                          {formatVnd(d.interest)}
                        </TableCell>
                        <TableCell className="text-right text-slate-900 font-medium">
                          {formatVnd(d.cumulativeInterest)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {dailyRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-6 text-center text-slate-400 italic"
                        >
                          Chưa phát sinh ngày tính lãi nào.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <TablePagination pagination={dailyPg} />
            </CardContent>
          </Card>

          {/* 2. Repayment history with inline create, edit and delete */}
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Lịch Sử Các Đợt Đã Trả Nợ:
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-300 hidden sm:inline">&bull;</span>
                    <span className="text-slate-500">
                      Gốc còn nợ:{' '}
                      <strong className="text-blue-700 font-semibold tabular">
                        {formatVnd(loanDetail.outstanding)}
                      </strong>
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-slate-500">
                      Lãi còn nợ:{' '}
                      <strong
                        className={`font-semibold tabular ${
                          currentInterestLeft > 0
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {formatVnd(currentInterestLeft)}
                      </strong>
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-slate-500">
                      Tổng nợ:{' '}
                      <strong className="text-slate-900 font-bold tabular">
                        {formatVnd(currentTotalOwing)}
                      </strong>
                    </span>
                  </div>
                </div>

                {canManage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 rounded-lg bg-white text-xs border-purple-300 text-purple-900 hover:bg-purple-50 shrink-0"
                    onClick={startAddRepayment}
                    disabled={editingRepaymentId !== null || isSaving}
                  >
                    <Plus className="size-3.5" />
                    Thêm đợt trả nợ
                  </Button>
                )}
              </div>

              {/* Inline warning banner when entered amounts exceed ceilings */}
              {editingRepaymentId !== null &&
                (hasInterestOverError || hasPrincipalOverError) && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0 text-rose-600" />
                    <div className="flex-1 space-y-0.5">
                      {hasInterestOverError && (
                        <div>
                          Tiền lãi nhập ({formatVnd(rDraft.interestAmount)})
                          vượt quá lãi phát sinh đến ngày{' '}
                          {formatDate(rDraft.paymentDate)} (Tối đa:{' '}
                          <strong className="text-rose-950 font-bold">
                            {formatVnd(maxInterestAllowed)}
                          </strong>
                          ).
                        </div>
                      )}
                      {hasPrincipalOverError && (
                        <div>
                          Tiền gốc nhập ({formatVnd(rDraft.principalAmount)})
                          vượt quá dư nợ gốc còn lại (Tối đa:{' '}
                          <strong className="text-rose-950 font-bold">
                            {formatVnd(maxPrincipalAllowed)}
                          </strong>
                          ).
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {loanDetail.repayments.length === 0 &&
              editingRepaymentId !== 'new' ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center bg-white">
                  <p className="text-sm text-slate-500">
                    Chưa có đợt thanh toán nào cho khế ước này
                  </p>
                  {canManage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 h-8 gap-1.5 text-xs text-purple-700 hover:text-purple-800 border-purple-200"
                      onClick={startAddRepayment}
                    >
                      <Plus className="size-3.5" />
                      Ghi nhận đợt trả nợ
                    </Button>
                  )}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs bg-slate-50">
<TableHead className="w-12 text-center">STT</TableHead>
                        <TableHead className="w-[160px]">Ngày Trả</TableHead>
                        <TableHead className="w-[170px] text-right">
                          Tiền Gốc
                        </TableHead>
                        <TableHead className="w-[170px] text-right">
                          Tiền Lãi
                        </TableHead>
                        <TableHead className="min-w-[200px]">
                          Tài Khoản Chi
                        </TableHead>
                        <TableHead className="w-[170px] text-right">
                          Tổng Thanh Toán
                        </TableHead>
                        <TableHead className="w-[80px] text-right" />
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {editingRepaymentId === 'new' && renderEditingRow('new', '+')}
                      {repaymentsPg.pageItems.map((r: any, rowIdx) => {
                        const isEditing = editingRepaymentId === r.id
                        if (isEditing) {
                          return renderEditingRow(
                            r.id,
                            repaymentsPg.pageSize * (repaymentsPg.page - 1) +
                              rowIdx +
                              1,
                          )
                        }

                        return (
                          <TableRow
                            key={r.id}
                            className={cn(
                              canManage &&
                                'cursor-pointer hover:bg-purple-50/40 transition-colors group',
                            )}
                            onClick={() => {
                              if (
                                canManage &&
                                editingRepaymentId !== r.id &&
                                !isSaving
                              ) {
                                startEditRepayment(r)
                              }
                            }}
                          >
<TableCell className="text-center text-muted-foreground">{repaymentsPg.pageSize * (repaymentsPg.page - 1) + rowIdx + 1}</TableCell>
                            <TableCell className="font-medium text-slate-900">
                              {formatDate(r.paymentDate)}
                            </TableCell>
                            <TableCell className="text-right text-emerald-800 font-medium">
                              {formatVnd(r.principalAmount)}
                            </TableCell>
                            <TableCell className="text-right text-purple-800 font-medium">
                              {formatVnd(r.interestAmount)}
                            </TableCell>
                            <TableCell className="text-slate-600 text-xs">
                              {accountLabel(r.companyBankAccountId)}
                            </TableCell>
                            <TableCell className="text-right text-slate-900 font-semibold">
                              {formatVnd(
                                Number(r.principalAmount) +
                                  Number(r.interestAmount),
                              )}
                            </TableCell>
                            <TableCell
                              className="text-right whitespace-nowrap p-2 align-middle"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              {canManage && (
                                <div className="flex items-center justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                    onClick={() => handleDeleteRepayment(r)}
                                    disabled={
                                      editingRepaymentId !== null ||
                                      isSaving ||
                                      isBusy(`repayment:${r.id}`)
                                    }
                                    aria-label="Xóa đợt trả nợ"
                                    title="Xóa đợt trả nợ"
                                  >
                                    <BusyTrash
                                      busy={isBusy(`repayment:${r.id}`)}
                                    />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  <TablePagination pagination={repaymentsPg} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

