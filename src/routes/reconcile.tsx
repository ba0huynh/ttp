import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Loader2,
  Upload,
} from 'lucide-react'
import * as React from 'react'

import { ImportStatementDialog } from '#/components/finance/ImportStatementDialog.tsx'
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
import { formatDate, formatVnd } from '#/lib/business.ts'
import {
  bankStatementDetailQuery,
  bankStatementsQuery,
  currentUserQuery,
} from '#/lib/queries.ts'
import {
  matchStatementLineFn,
  setStatementLineStatusFn,
  suggestMatchesFn,
} from '#/server/fns/finance.ts'

export const Route = createFileRoute('/reconcile')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.query(bankStatementsQuery())
  },
  component: ReconcilePage,
})

function ReconcilePage() {
  const { user } = Route.useRouteContext()
  const { data: statements } = useSuspenseQuery(bankStatementsQuery())
  const queryClient = useQueryClient()

  const [selectedStatementId, setSelectedStatementId] = React.useState<
    number | null
  >(statements[0]?.id ?? null)
  const [importOpen, setImportOpen] = React.useState(false)
  const { data: statementDetail, isLoading: loadingLines } = useQuery({
    ...bankStatementDetailQuery(selectedStatementId ?? 0),
    enabled: selectedStatementId !== null,
  })
  const linesPg = usePagination<any>(
    statementDetail?.lines ?? [],
    selectedStatementId,
  )

  // Matching suggestions
  const [matchingLineId, setMatchingLineId] = React.useState<number | null>(
    null,
  )
  // Gợi ý luôn lấy mới: phụ thuộc vào phiếu thu/chi vừa phát sinh
  const { data: suggestions = [], isLoading: loadingSuggestions } = useQuery({
    queryKey: ['bank-statements', 'suggest', matchingLineId],
    queryFn: () => suggestMatchesFn({ data: { lineId: matchingLineId ?? 0 } }),
    enabled: matchingLineId !== null,
    staleTime: 0,
  })

  // Khớp giao dịch ảnh hưởng sao kê, phiếu thu/chi, công nợ và khế ước vay
  const refresh = () => queryClient.invalidateQueries()
  const matchLine = useMutation({
    mutationFn: matchStatementLineFn,
    onSuccess: refresh,
  })
  const setLineStatus = useMutation({
    mutationFn: setStatementLineStatusFn,
    onSuccess: refresh,
  })
  // The line being un-matched right now (pending also covers the data refresh)
  const cancellingLineId = setLineStatus.isPending
    ? setLineStatus.variables?.data.lineId
    : undefined

  const handleUnmatch = async (lineId: number) => {
    try {
      await setLineStatus.mutateAsync({ data: { lineId, status: 'unmatched' } })
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi hủy khớp giao dịch')
    }
  }

  const openSuggestModal = (lineId: number) => setMatchingLineId(lineId)

  const handleMatch = async (matchedType: any, matchedId: number) => {
    if (!matchingLineId) return
    try {
      await matchLine.mutateAsync({
        data: {
          lineId: matchingLineId,
          matchedType,
          matchedId,
        },
      })
      setMatchingLineId(null)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi khớp giao dịch')
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Đối Chiếu Sao Kê Ngân Hàng
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Khớp nối dòng tiền thực tế trên sao kê với{' '}
              <strong>Phiếu thu (tiền khách trả)</strong>,{' '}
              <strong>Phiếu chi (trả NCC)</strong> và{' '}
              <strong>Trả nợ vay khế ước</strong>.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="gap-1.5 font-semibold"
            >
              <Upload className="size-4" />
              Nhập Sao Kê
            </Button>
          </div>
        </div>

        <ImportStatementDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={setSelectedStatementId}
        />

        {statements.length === 0 && (
          <div className="py-10 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed">
            Chưa có sao kê nào. Bấm <strong>Nhập Sao Kê</strong> để bắt đầu đối
            chiếu.
          </div>
        )}

        {/* Statement picker */}
        {statements.length > 0 && (
          <div className="max-w-2xl space-y-1.5">
            <Label className="text-xs font-semibold">Sao kê</Label>
            <SearchSelect
              className="h-10 w-full bg-card text-sm"
              placeholder="Chọn sao kê"
              value={selectedStatementId ? String(selectedStatementId) : ''}
              onValueChange={(v) => setSelectedStatementId(Number(v))}
            >
              {statements.map((s) => (
                <SearchSelectItem key={s.id} value={String(s.id)}>
                  <span className="flex items-center gap-3">
                    <BankLabel image={s.bankImage} name={s.bankName}>
                      {s.bankName} ({s.accountNumber})
                    </BankLabel>
                    <span className="text-xs text-slate-400">#{s.id}</span>
                    <Badge
                      variant="secondary"
                      className="py-0 px-1.5 text-[10px] bg-slate-200/80 text-slate-800"
                    >
                      Khớp {s.matchedCount}/{s.lineCount}
                    </Badge>
                  </span>
                </SearchSelectItem>
              ))}
            </SearchSelect>
          </div>
        )}

        {/* Transactions Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800">
                Giao Dịch Trong Kỳ Sao Kê:{' '}
                <span className="font-semibold text-emerald-800">
                  {statementDetail?.statement?.bankName} &bull;{' '}
                  {statementDetail?.statement?.accountNumber}
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Hiển thị số dư biến động & trạng thái đối chiếu
              </CardDescription>
            </div>
            <div className="text-xs text-slate-500">
              Tổng {statementDetail?.lines?.length ?? 0} dòng
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingLines ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Đang tải dòng sao kê...
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Fixed layout + explicit widths: the columns keep their size whether
                    lines are matched (long badge, "Hủy khớp") or not ("Tìm khớp") */}
                <Table className="table-fixed min-w-[960px]">
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/70">
                      <TableHead className="w-28">Ngày GD</TableHead>
                      <TableHead>Nội Dung Diễn Giải</TableHead>
                      <TableHead className="w-44 text-right">
                        Tiền Ra (Ghi Nợ)
                      </TableHead>
                      <TableHead className="w-44 text-right">
                        Tiền Vào (Ghi Có)
                      </TableHead>
                      <TableHead className="w-56 text-center">
                        Đối Chiếu
                      </TableHead>
                      <TableHead className="w-36 text-center">
                        Thao tác
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {linesPg.pageItems.map((l: any) => {
                      const isMatched = l.status === 'matched'
                      return (
                        <TableRow key={l.id} className="hover:bg-slate-50/80">
                          <TableCell className="font-mono text-slate-600">
                            {formatDate(l.transactionDate)}
                          </TableCell>
                          <TableCell
                            className="truncate font-medium text-slate-900"
                            title={l.description}
                          >
                            {l.description}
                          </TableCell>
                          <TableCell className="text-right font-bold text-rose-900">
                            {l.debit > 0 ? formatVnd(l.debit) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-900">
                            {l.credit > 0 ? formatVnd(l.credit) : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {isMatched ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px] gap-1"
                              >
                                <CheckCircle2 className="size-3 text-emerald-600" />
                                Đã khớp ({l.matchedType})
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[11px]"
                              >
                                Chưa đối soát
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {!isMatched ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1"
                                onClick={() => openSuggestModal(l.id)}
                              >
                                <ArrowRightLeft className="size-3" />
                                Tìm khớp
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-xs text-slate-400 hover:text-rose-600"
                                disabled={setLineStatus.isPending}
                                onClick={() => handleUnmatch(l.id)}
                              >
                                {cancellingLineId === l.id && (
                                  <Loader2 className="size-3 animate-spin" />
                                )}
                                {cancellingLineId === l.id
                                  ? 'Đang hủy...'
                                  : 'Hủy khớp'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <TablePagination pagination={linesPg} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Matching Suggestions Modal */}
        <Dialog
          open={matchingLineId !== null}
          onOpenChange={(open) => !open && setMatchingLineId(null)}
        >
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Gợi Ý Chứng Từ Khớp Với Giao Dịch Sao Kê
              </DialogTitle>
              <DialogDescription className="text-xs">
                Tự động tìm kiếm các Phiếu thu, Phiếu chi hoặc Khoản trả nợ khế
                ước có cùng số tiền và trong phạm vi &plusmn;5 ngày.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              {loadingSuggestions ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Đang tìm chứng từ phù hợp...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                  Không tìm thấy chứng từ nội bộ nào có cùng số tiền và ngày
                  giao dịch gần đây.
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <div
                      key={`${s.type}-${s.id}`}
                      className="p-3 rounded-lg border border-slate-200 hover:border-emerald-300 bg-slate-50/50 flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold uppercase"
                          >
                            {s.type === 'receipt'
                              ? 'Phiếu Thu'
                              : s.type === 'payment'
                                ? 'Phiếu Chi'
                                : 'Trả Nợ Khế Ước'}
                          </Badge>
                          <span
                            className={`font-bold text-slate-900 text-xs ${s.type === 'loan_repayment' ? 'font-mono' : ''}`}
                          >
                            {s.number}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Ngày chứng từ: {formatDate(s.date)} &bull; Số tiền:{' '}
                          <strong className="whitespace-nowrap text-slate-900">
                            {formatVnd(s.amount)}
                          </strong>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1"
                        disabled={matchLine.isPending}
                        onClick={() => handleMatch(s.type, s.id)}
                      >
                        {matchLine.isPending &&
                        matchLine.variables?.data.matchedId === s.id &&
                        matchLine.variables?.data.matchedType === s.type ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        Xác Nhận Khớp
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMatchingLineId(null)}
                className="h-8 text-xs"
              >
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
