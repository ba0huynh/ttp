import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { BankAccountSelect } from '#/components/finance/BankAccountSelect.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { PageHeader } from '#/components/layout/StatCard.tsx'
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
  projectLoanTermInterest,
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
  const repaymentsPg = usePagination<any>(loanDetail.repayments)
  const queryClient = useQueryClient()

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
    setRDraft({
      paymentDate: todayIso(),
      principalAmount: 0,
      interestAmount: loanDetail.interestDue > 0 ? loanDetail.interestDue : 0,
      companyBankAccountId:
        master.bankAccounts.find((a) => a.isActive)?.id ?? null,
    })
    setRSubmitted(false)
    setEditingRepaymentId('new')
  }

  const startEditRepayment = (r: (typeof loanDetail.repayments)[number]) => {
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
    setEditingRepaymentId(null)
    setRSubmitted(false)
  }

  const saveRepaymentInline = async () => {
    setRSubmitted(true)
    if (!rDraft.paymentDate) {
      toast.error('Vui lòng chọn ngày thanh toán (viền đỏ)')
      return
    }
    if (rDraft.principalAmount <= 0 && rDraft.interestAmount <= 0) {
      toast.error('Vui lòng nhập số tiền gốc hoặc lãi cần trả (viền đỏ)')
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
    try {
      await deleteRepayment.mutateAsync({ data: { id: r.id } })
      toast.success('Đã xóa đợt trả nợ')
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi xóa đợt trả nợ')
    }
  }

  const handleRepaymentRowBlur = (
    e: React.FocusEvent<HTMLTableRowElement>,
  ) => {
    const currentTarget = e.currentTarget
    setTimeout(() => {
      const active = document.activeElement
      if (currentTarget && currentTarget.contains(active)) return
      if (
        active?.closest(
          '[data-radix-popper-content-wrapper], [role="dialog"], [data-radix-focus-guard]',
        )
      )
        return
      if (
        editingRepaymentId === 'new' &&
        !rDraft.paymentDate &&
        rDraft.principalAmount <= 0 &&
        rDraft.interestAmount <= 0
      ) {
        setEditingRepaymentId(null)
        setRSubmitted(false)
        return
      }
      saveRepaymentInline()
    }, 120)
  }

  const handleRepaymentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const active = document.activeElement
      if (
        active?.closest(
          '[data-radix-popper-content-wrapper], [role="dialog"]',
        )
      )
        return
      e.preventDefault()
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
      cancelRepaymentEdit()
      return
    }
    handleRowArrowNavigation(e)
  }

  const { loan } = loanDetail
  const termEstimate = projectLoanTermInterest({
    principal: loan.principalAmount,
    annualRatePercent: loan.interestRate,
    disbursementDate: loan.disbursementDate,
    termMonths: loan.termMonths,
    principalRepayments: loanDetail.repayments.map((r) => ({
      date: r.paymentDate,
      amount: r.principalAmount,
    })),
  })

  const renderEditingRow = (key: string | number) => {
    const hasZeroError =
      rSubmitted && rDraft.principalAmount <= 0 && rDraft.interestAmount <= 0
    return (
      <TableRow
        key={key}
        className="bg-purple-50/50 border-y border-purple-300"
        onBlur={handleRepaymentRowBlur}
        onKeyDown={handleRepaymentKeyDown}
      >
        <TableCell className="p-2 align-middle">
          <Input
            type="date"
            required
            value={rDraft.paymentDate}
            onChange={(e) =>
              setRDraft({ ...rDraft, paymentDate: e.target.value })
            }
            onKeyDown={handleRepaymentKeyDown}
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
            onValueChange={(val: number) =>
              setRDraft((prev) => ({ ...prev, principalAmount: val }))
            }
            blankZero
            placeholder="Tiền gốc"
            onKeyDown={handleRepaymentKeyDown}
            className={cn(
              'h-8 text-xs text-right bg-white',
              hasZeroError &&
                'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20',
            )}
          />
        </TableCell>
        <TableCell className="p-2 align-middle text-right">
          <MoneyInput
            value={rDraft.interestAmount}
            onValueChange={(val: number) =>
              setRDraft((prev) => ({ ...prev, interestAmount: val }))
            }
            blankZero
            placeholder="Tiền lãi"
            onKeyDown={handleRepaymentKeyDown}
            className={cn(
              'h-8 text-xs text-right bg-white',
              hasZeroError &&
                'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20',
            )}
          />
        </TableCell>
        <TableCell className="p-2 align-middle">
          <BankAccountSelect
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
              title="Lưu (Enter)"
            >
              <Check className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={cancelRepaymentEdit}
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
              Lãi suất: <strong>{loan.interestRate}%/năm</strong> · Giải ngân:{' '}
              {formatDate(loan.disbursementDate)} · Kỳ hạn:{' '}
              <strong>{loan.termMonths} tháng</strong> (đáo hạn dự kiến{' '}
              {formatDate(addMonthsIso(loan.disbursementDate, loan.termMonths))}
              )
              <br />
              Lãi ước tính: <strong>{formatVnd(termEstimate.monthly)}</strong>
              /tháng · <strong>{formatVnd(termEstimate.total)}</strong> cả kỳ
              hạn
            </>
          }
        />

        <div className="space-y-5">
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
                      <TableHead className="text-right">Gốc Đã Trả</TableHead>
                      <TableHead className="text-right">
                        Dư Nợ Còn Lại
                      </TableHead>
                      <TableHead className="text-right">
                        Lãi Phát Sinh
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {loanDetail.segments.map((seg: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{formatDate(seg.from)}</TableCell>
                        <TableCell>{formatDate(seg.to)}</TableCell>
                        <TableCell className="text-center">
                          {seg.days} ngày
                        </TableCell>
                        <TableCell className="text-right text-emerald-800 font-medium">
                          {formatVnd(seg.principalPaid ?? 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-purple-900">
                          {formatVnd(seg.remainingBalance ?? seg.outstanding)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-purple-900">
                          {formatVnd(seg.interest)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 2. Repayment history with inline create, edit and delete */}
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-slate-800">
                  Lịch Sử Các Đợt Đã Trả Nợ (Gốc:{' '}
                  {formatVnd(loanDetail.principalPaid)} &bull; Lãi:{' '}
                  {formatVnd(loanDetail.interestPaid)}):
                </div>
                {canManage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 rounded-lg bg-white text-xs border-purple-300 text-purple-900 hover:bg-purple-50"
                    onClick={startAddRepayment}
                    disabled={editingRepaymentId !== null}
                  >
                    <Plus className="size-3.5" />
                    Thêm đợt trả nợ
                  </Button>
                )}
              </div>

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
                      {editingRepaymentId === 'new' && renderEditingRow('new')}
                      {repaymentsPg.pageItems.map((r: any) => {
                        const isEditing = editingRepaymentId === r.id
                        if (isEditing) {
                          return renderEditingRow(r.id)
                        }

                        return (
                          <TableRow
                            key={r.id}
                            className={cn(
                              canManage &&
                                'cursor-pointer hover:bg-purple-50/40 transition-colors group',
                            )}
                            onClick={() => {
                              if (canManage && editingRepaymentId !== r.id) {
                                startEditRepayment(r)
                              }
                            }}
                          >
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
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-slate-400 hover:text-purple-700 hover:bg-purple-50"
                                    onClick={() => startEditRepayment(r)}
                                    disabled={editingRepaymentId !== null}
                                    aria-label="Sửa đợt trả nợ"
                                    title="Sửa đợt trả nợ"
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                    onClick={() => handleDeleteRepayment(r)}
                                    disabled={editingRepaymentId !== null}
                                    aria-label="Xóa đợt trả nợ"
                                    title="Xóa đợt trả nợ"
                                  >
                                    <Trash2 className="size-3.5" />
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

