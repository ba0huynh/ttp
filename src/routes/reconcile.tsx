import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react'
import * as React from 'react'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx'
import { formatDate, formatVnd } from '#/lib/business.ts'
import { getCurrentUserFn } from '#/server/fns/auth.ts'
import {
  autoMatchStatementFn,
  getBankStatementDetailFn,
  listBankStatementsFn,
  matchStatementLineFn,
  setStatementLineStatusFn,
  suggestMatchesFn,
} from '#/server/fns/finance.ts'

export const Route = createFileRoute('/reconcile')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  loader: async () => {
    const statements = await listBankStatementsFn()
    return { statements }
  },
  component: ReconcilePage,
})

function ReconcilePage() {
  const { user } = Route.useRouteContext()
  const { statements } = Route.useLoaderData()

  const [selectedStatementId, setSelectedStatementId] = React.useState<
    number | null
  >(statements[0]?.id ?? null)
  const [statementDetail, setStatementDetail] = React.useState<any>(null)
  const [loadingLines, setLoadingLines] = React.useState(false)

  // Matching suggestions
  const [matchingLineId, setMatchingLineId] = React.useState<number | null>(
    null,
  )
  const [suggestions, setSuggestions] = React.useState<any[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false)

  const [autoMatching, setAutoMatching] = React.useState(false)

  const loadStatement = async (id: number) => {
    setSelectedStatementId(id)
    setLoadingLines(true)
    try {
      const res = await getBankStatementDetailFn({ data: { id } })
      setStatementDetail(res)
    } finally {
      setLoadingLines(false)
    }
  }

  React.useEffect(() => {
    if (selectedStatementId) {
      loadStatement(selectedStatementId)
    }
  }, [selectedStatementId])

  const openSuggestModal = async (lineId: number) => {
    setMatchingLineId(lineId)
    setLoadingSuggestions(true)
    try {
      const res = await suggestMatchesFn({ data: { lineId } })
      setSuggestions(res)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleMatch = async (matchedType: any, matchedId: number) => {
    if (!matchingLineId) return
    try {
      await matchStatementLineFn({
        data: {
          lineId: matchingLineId,
          matchedType,
          matchedId,
        },
      })
      setMatchingLineId(null)
      if (selectedStatementId) await loadStatement(selectedStatementId)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi khớp giao dịch')
    }
  }

  const handleAutoMatch = async () => {
    if (!selectedStatementId) return
    setAutoMatching(true)
    try {
      const res = await autoMatchStatementFn({
        data: { statementId: selectedStatementId },
      })
      alert(
        `Đã tự động đối chiếu khớp ${res.matched}/${res.total} dòng giao dịch phù hợp!`,
      )
      await loadStatement(selectedStatementId)
    } catch (err: unknown) {
      alert((err as Error).message || 'Lỗi khi tự động đối chiếu')
    } finally {
      setAutoMatching(false)
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

          <Button
            size="sm"
            disabled={autoMatching || !selectedStatementId}
            onClick={handleAutoMatch}
            className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs font-semibold"
          >
            <Sparkles className="size-4" />
            {autoMatching ? 'Đang khớp...' : 'Tự Động Đối Chiếu Nhanh'}
          </Button>
        </div>

        {/* Statements list bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {statements.map((s) => (
            <Button
              key={s.id}
              variant={selectedStatementId === s.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatementId(s.id)}
              className={`h-9 text-xs gap-2 shrink-0 ${
                selectedStatementId === s.id ? 'bg-slate-900 text-white' : ''
              }`}
            >
              <FileSpreadsheet className="size-3.5" />
              <span>
                {s.bankShortName} ({formatDate(s.periodFrom)} -{' '}
                {formatDate(s.periodTo)})
              </span>
              <Badge
                variant="secondary"
                className="py-0 px-1.5 text-[10px] bg-slate-200/80 text-slate-800"
              >
                Khớp {s.matchedCount}/{s.lineCount}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Transactions Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800">
                Giao Dịch Trong Kỳ Sao Kê:{' '}
                <span className="font-semibold text-emerald-800">
                  {statementDetail?.statement?.bankShortName} &bull;{' '}
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
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/70">
                      <TableHead>Ngày GD</TableHead>
                      <TableHead>Mã Tham Chiếu</TableHead>
                      <TableHead>Nội Dung Diễn Giải</TableHead>
                      <TableHead className="text-right">
                        Tiền Ra (Ghi Nợ)
                      </TableHead>
                      <TableHead className="text-right">
                        Tiền Vào (Ghi Có)
                      </TableHead>
                      <TableHead className="text-center">Đối Chiếu</TableHead>
                      <TableHead className="text-center">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {statementDetail?.lines?.map((l: any) => {
                      const isMatched = l.status === 'matched'
                      return (
                        <TableRow key={l.id} className="hover:bg-slate-50/80">
                          <TableCell className="font-mono text-slate-600">
                            {formatDate(l.transactionDate)}
                          </TableCell>
                          <TableCell className="font-mono text-slate-500 font-medium">
                            {l.reference ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-md font-medium text-slate-900">
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
                                className="h-7 text-xs text-slate-400 hover:text-rose-600"
                                onClick={async () => {
                                  await setStatementLineStatusFn({
                                    data: { lineId: l.id, status: 'unmatched' },
                                  })
                                  if (selectedStatementId)
                                    loadStatement(selectedStatementId)
                                }}
                              >
                                Hủy khớp
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Matching Suggestions Modal */}
        <Dialog
          open={matchingLineId !== null}
          onOpenChange={(open) => !open && setMatchingLineId(null)}
        >
          <DialogContent className="max-w-xl">
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
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {s.number}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Ngày chứng từ: {formatDate(s.date)} &bull; Số tiền:{' '}
                          <strong className="text-slate-900">
                            {formatVnd(s.amount)}
                          </strong>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1"
                        onClick={() => handleMatch(s.type, s.id)}
                      >
                        <Check className="size-3.5" />
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
