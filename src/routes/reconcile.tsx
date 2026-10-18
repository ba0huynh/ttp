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
  Pencil,
  SlidersHorizontal,
  Upload,
} from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

import { ImportStatementDialog } from '#/components/finance/ImportStatementDialog.tsx'
import { BankLabel } from '#/components/finance/BankLabel.tsx'
import { Can } from '#/components/auth/Can.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import {
  confirmDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import { Input } from '#/components/ui/input.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import { useBusyKeys } from '#/lib/use-busy.ts'
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
import { MultiSearchSelect } from '#/components/ui/multi-search-select.tsx'
import { PriceRangeFilter } from '#/components/ui/price-range-filter.tsx'
import { useUrlText } from '#/lib/use-url-text.ts'
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
import { requirePagePermission } from '#/lib/route-guard.ts'
import {
  matchStatementLineFn,
  setStatementLineStatusFn,
  suggestMatchesFn,
  deleteStatementLineFn,
  updateStatementLineFn,
} from '#/server/fns/finance.ts'

const MATCH_LABELS = {
  receipt: 'Phiếu thu',
  payment: 'Phiếu chi',
  loan_repayment: 'Trả nợ khế ước',
} as const

export const Route = createFileRoute('/reconcile')({
  // Filters live in the URL so a reload or shared link keeps them
  validateSearch: z.object({
    q: z.string().optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    flow: z.array(z.enum(['in', 'out'])).optional().catch(undefined),
    status: z.array(z.enum(['matched', 'unmatched'])).optional().catch(undefined),
    type: z
      .array(z.enum(['receipt', 'payment', 'loan_repayment']))
      .optional()
      .catch(undefined),
    min: z.number().optional().catch(undefined),
    max: z.number().optional().catch(undefined),
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'reconcile.view')
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

  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()
  const [showFilters, setShowFilters] = React.useState(false)
  const { from, to, flow, status, type, min, max } = searchParams
  // The box filters instantly; the URL follows once typing pauses
  const [descSearch, setDescSearch] = useUrlText(searchParams.q ?? '', (q) =>
    navigate({
      search: (prev) => ({ ...prev, q: q || undefined }),
      replace: true,
    }),
  )
  const setFilter = (
    key: 'from' | 'to' | 'flow' | 'status' | 'type',
    value: string | string[] | undefined,
  ) =>
    navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: true })

  const activeFilterCount = [
    Boolean(descSearch.trim()),
    Boolean(from || to),
    Boolean(flow?.length),
    Boolean(status?.length),
    Boolean(type?.length),
    min !== undefined || max !== undefined,
  ].filter(Boolean).length

  const allLines: any[] = statementDetail?.lines ?? []
  const filteredLines = allLines.filter((l) => {
    const q = descSearch.trim().toLowerCase()
    if (q && !String(l.description ?? '').toLowerCase().includes(q))
      return false
    const date = String(l.transactionDate).slice(0, 10)
    if (from && date < from) return false
    if (to && date > to) return false
    if (flow?.length && !flow.includes(l.debit > 0 ? 'out' : 'in')) return false
    if (
      status?.length &&
      !status.includes(l.status === 'matched' ? 'matched' : 'unmatched')
    )
      return false
    if (type?.length && !type.includes(l.matchedType)) return false
    const amount = l.debit > 0 ? l.debit : l.credit
    if (min !== undefined && amount < min) return false
    if (max !== undefined && amount > max) return false
    return true
  })
  const linesPg = usePagination<any>(
    filteredLines,
    `${selectedStatementId}|${descSearch}|${from}|${to}|${flow?.join()}|${status?.join()}|${type?.join()}|${min}|${max}`,
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

  // Edit / delete one line (only while it is not matched)
  const { isBusy, setBusy } = useBusyKeys()
  const updateLine = useMutation({
    mutationFn: updateStatementLineFn,
    onSuccess: refresh,
  })
  const deleteLine = useMutation({
    mutationFn: deleteStatementLineFn,
    onSuccess: refresh,
  })
  const [editLine, setEditLine] = React.useState<{
    id: number
    date: string
    description: string
    debit: number
    credit: number
  } | null>(null)

  const handleSaveLine = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editLine) return
    try {
      await updateLine.mutateAsync({
        data: {
          lineId: editLine.id,
          transactionDate: editLine.date,
          description: editLine.description.trim() || null,
          debit: editLine.debit,
          credit: editLine.credit,
        },
      })
      setEditLine(null)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi sửa dòng sao kê')
    }
  }

  const handleDeleteLine = async (l: { id: number; description: string }) => {
    const ok = await confirmDialog({
      title: 'Xóa dòng sao kê này?',
      description: l.description || undefined,
      confirmLabel: 'Xóa',
      destructive: true,
    })
    if (!ok) return
    const key = `line:${l.id}`
    setBusy(key, true)
    try {
      await deleteLine.mutateAsync({ data: { lineId: l.id } })
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể xóa dòng sao kê')
    } finally {
      setBusy(key, false)
    }
  }

  const handleUnmatch = async (lineId: number) => {
    try {
      await setLineStatus.mutateAsync({ data: { lineId, status: 'unmatched' } })
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi hủy khớp giao dịch')
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
      await showErrorDialog(err, 'Lỗi khi khớp giao dịch')
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

          <Can permission="reconcile.manage">
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
          </Can>
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
              className="h-11 w-full bg-card text-sm rounded-lg"
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
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-500">
                {activeFilterCount > 0
                  ? `${filteredLines.length}/${allLines.length} dòng`
                  : `Tổng ${allLines.length} dòng`}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFilters(true)}
                aria-haspopup="dialog"
                className={`gap-1.5 ${activeFilterCount > 0 ? 'border-emerald-600 text-emerald-800' : ''}`}
              >
                <SlidersHorizontal className="size-4" />
                Bộ lọc
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-emerald-700 text-white text-[11px] px-1.5">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
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
                      <TableHead className="w-52 text-center">
                        Thao tác
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {linesPg.pageItems.map((l: any) => {
                      const isMatched = l.status === 'matched'
                      return (
                        <TableRow key={l.id} className="hover:bg-slate-50/80">
                          <TableCell className="text-slate-500">
                            {formatDate(l.transactionDate)}
                          </TableCell>
                          <TableCell
                            className="truncate font-medium text-slate-900"
                            title={l.description}
                          >
                            {l.description}
                          </TableCell>
                          <TableCell className="text-right font-medium text-rose-900">
                            {l.debit > 0 ? formatVnd(l.debit) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-900">
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
                          <TableCell className="text-center whitespace-nowrap">
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
                            <Can permission="reconcile.manage">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isMatched}
                                onClick={() =>
                                  setEditLine({
                                    id: l.id,
                                    date: l.transactionDate,
                                    description: l.description ?? '',
                                    debit: l.debit,
                                    credit: l.credit,
                                  })
                                }
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                                title={
                                  isMatched ? 'Hủy khớp trước khi sửa' : 'Sửa'
                                }
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isMatched || isBusy(`line:${l.id}`)}
                                onClick={() => handleDeleteLine(l)}
                                className="size-7 text-slate-400 hover:text-rose-600"
                                aria-label="Xóa"
                                title={
                                  isMatched ? 'Hủy khớp trước khi xóa' : 'Xóa'
                                }
                              >
                                <BusyTrash busy={isBusy(`line:${l.id}`)} />
                              </Button>
                            </Can>
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

        {/* Filter dialog */}
        <Dialog open={showFilters} onOpenChange={setShowFilters}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Bộ Lọc Giao Dịch Sao Kê
              </DialogTitle>
              <DialogDescription className="text-xs">
                Kết quả được lọc ngay khi thay đổi ({filteredLines.length} dòng
                phù hợp)
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Nội dung diễn giải</Label>
                <Input
                  placeholder="Tìm theo nội dung giao dịch..."
                  value={descSearch}
                  onChange={(e) => setDescSearch(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ngày giao dịch từ</Label>
                <Input
                  type="date"
                  value={from ?? ''}
                  onChange={(e) => setFilter('from', e.target.value || undefined)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ngày giao dịch đến</Label>
                <Input
                  type="date"
                  value={to ?? ''}
                  onChange={(e) => setFilter('to', e.target.value || undefined)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Chiều tiền</Label>
                <MultiSearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  placeholder="Tất cả"
                  values={flow ?? []}
                  onValuesChange={(v) =>
                    setFilter('flow', v.length ? v : undefined)
                  }
                >
                  <SearchSelectItem value="in" className="text-xs">
                    Tiền vào (ghi có)
                  </SearchSelectItem>
                  <SearchSelectItem value="out" className="text-xs">
                    Tiền ra (ghi nợ)
                  </SearchSelectItem>
                </MultiSearchSelect>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Đối chiếu</Label>
                <MultiSearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  placeholder="Tất cả"
                  values={status ?? []}
                  onValuesChange={(v) =>
                    setFilter('status', v.length ? v : undefined)
                  }
                >
                  <SearchSelectItem value="matched" className="text-xs">
                    Đã khớp
                  </SearchSelectItem>
                  <SearchSelectItem value="unmatched" className="text-xs">
                    Chưa đối soát
                  </SearchSelectItem>
                </MultiSearchSelect>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Khớp với chứng từ</Label>
                <MultiSearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  placeholder="Tất cả loại chứng từ"
                  values={type ?? []}
                  onValuesChange={(v) =>
                    setFilter('type', v.length ? v : undefined)
                  }
                >
                  {(Object.keys(MATCH_LABELS) as (keyof typeof MATCH_LABELS)[]).map(
                    (k) => (
                      <SearchSelectItem key={k} value={k} className="text-xs">
                        {MATCH_LABELS[k]}
                      </SearchSelectItem>
                    ),
                  )}
                </MultiSearchSelect>
              </div>
              <div className="sm:col-span-2">
                <PriceRangeFilter
                  label="Số tiền giao dịch"
                  min={min}
                  max={max}
                  onChange={(lo, hi) =>
                    navigate({
                      search: (prev) => ({ ...prev, min: lo, max: hi }),
                      replace: true,
                    })
                  }
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={activeFilterCount === 0}
                onClick={() => {
                  setDescSearch('')
                  navigate({ search: () => ({}), replace: true })
                }}
                className="h-8 text-xs text-slate-500"
              >
                Xóa lọc
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowFilters(false)}
                className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Xong
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                          <span className="font-medium text-slate-900 text-xs">
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

      {/* Edit one statement line */}
      <Dialog
        open={editLine !== null}
        onOpenChange={(o) => !o && setEditLine(null)}
      >
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Sửa Dòng Sao Kê
            </DialogTitle>
          </DialogHeader>
          {editLine && (
            <form onSubmit={handleSaveLine} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Ngày Giao Dịch *
                </Label>
                <Input
                  type="date"
                  required
                  value={editLine.date}
                  onChange={(e) =>
                    setEditLine({ ...editLine, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Nội Dung Diễn Giải
                </Label>
                <Input
                  value={editLine.description}
                  onChange={(e) =>
                    setEditLine({ ...editLine, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Tiền Ra (Ghi Nợ)
                  </Label>
                  <MoneyInput
                    blankZero
                    value={editLine.debit}
                    onValueChange={(n) =>
                      setEditLine({
                        ...editLine,
                        debit: n,
                        credit: n > 0 ? 0 : editLine.credit,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Tiền Vào (Ghi Có)
                  </Label>
                  <MoneyInput
                    blankZero
                    value={editLine.credit}
                    onValueChange={(n) =>
                      setEditLine({
                        ...editLine,
                        credit: n,
                        debit: n > 0 ? 0 : editLine.debit,
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditLine(null)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={updateLine.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {updateLine.isPending ? 'Đang lưu...' : 'Lưu'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
