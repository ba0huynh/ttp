import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  Landmark,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Unlink,
  Upload,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { ImportStatementDialog } from '#/components/finance/ImportStatementDialog.tsx'
import { BankLabel, BankLogo } from '#/components/finance/BankLabel.tsx'
import { Can } from '#/components/auth/Can.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import { cn } from '#/lib/utils.ts'
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
import { SearchSelectItem } from '#/components/ui/search-select.tsx'
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
import { Textarea } from '#/components/ui/textarea.tsx'
import { formatDate, formatVnd } from '#/lib/business.ts'
import { matchesSearch } from '#/lib/text.ts'
import {
  currentUserQuery,
  reconciliationLinesQuery,
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
    account: z
      .union([z.number().int(), z.array(z.number().int())])
      .transform((v) =>
        Array.isArray(v) ? v : v !== undefined ? [v] : undefined,
      )
      .optional()
      .catch(undefined),
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
    await queryClient.query(reconciliationLinesQuery())
  },
  component: ReconcilePage,
})

function ReconcilePage() {
  const { user } = Route.useRouteContext()
  const { data: reconciliationData } = useSuspenseQuery(
    reconciliationLinesQuery(),
  )
  const queryClient = useQueryClient()

  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()
  const selectedAccountIds = searchParams.account ?? []
  const setSelectedAccountIds = (accIds: number[]) =>
    navigate({
      search: (prev) => ({
        ...prev,
        account: accIds.length ? accIds : undefined,
      }),
      replace: true,
    })

  const [importOpen, setImportOpen] = React.useState(false)
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
    selectedAccountIds.length > 0,
    Boolean(descSearch.trim()),
    Boolean(from || to),
    Boolean(flow?.length),
    Boolean(status?.length),
    Boolean(type?.length),
    min !== undefined || max !== undefined,
  ].filter(Boolean).length

  const allLines: any[] = reconciliationData?.lines ?? []
  const accounts: any[] = reconciliationData?.accounts ?? []

  const filteredLines = allLines.filter((l) => {
    if (
      selectedAccountIds.length > 0 &&
      !selectedAccountIds.includes(l.companyBankAccountId)
    ) {
      return false
    }
    if (
      descSearch.trim() &&
      !matchesSearch(
        descSearch,
        l.description,
        l.accountNumber,
        l.bankShortName,
        l.bankName,
      )
    ) {
      return false
    }
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

  const [exporting, setExporting] = React.useState(false)
  const handleExportExcel = async () => {
    if (exporting || filteredLines.length === 0) return
    setExporting(true)
    try {
      const { downloadReconcileExcel } = await import('#/lib/list-excel.ts')
      downloadReconcileExcel(
        filteredLines.map((l: any) => ({
          ...l,
          matchedLabel:
            l.status === 'matched'
              ? `Đã khớp · ${MATCH_LABELS[l.matchedType as keyof typeof MATCH_LABELS] ?? 'Chứng từ'}`
              : 'Chưa đối soát',
        })),
        allLines.length,
      )
      toast.success(`Đã xuất ${filteredLines.length} dòng sao kê ra file Excel`)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể xuất Excel')
    } finally {
      setExporting(false)
    }
  }
  const linesPg = usePagination<any>(
    filteredLines,
    `${selectedAccountIds.join()}|${descSearch}|${from}|${to}|${flow?.join()}|${status?.join()}|${type?.join()}|${min}|${max}`,
  )

  const totalUnmatched = accounts.reduce(
    (sum: number, a: any) => sum + (a.unmatchedLines || 0),
    0,
  )
  const inScopeLines =
    selectedAccountIds.length > 0
      ? allLines.filter((l) =>
          selectedAccountIds.includes(l.companyBankAccountId),
        )
      : allLines
  const inScopeUnmatched = inScopeLines.filter(
    (l) => l.status === 'unmatched',
  ).length
  const inScopeMatched = inScopeLines.filter((l) => l.status === 'matched').length

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

  // Suggestion filters & infinite scroll
  const SUGGEST_PAGE_SIZE = 6
  const [suggestSearch, setSuggestSearch] = React.useState('')
  const [suggestType, setSuggestType] = React.useState<string[]>([])
  const [suggestFrom, setSuggestFrom] = React.useState('')
  const [suggestTo, setSuggestTo] = React.useState('')
  const [suggestMin, setSuggestMin] = React.useState('')
  const [suggestMax, setSuggestMax] = React.useState('')
  const [showSuggestFilters, setShowSuggestFilters] = React.useState(false)
  const [suggestVisibleCount, setSuggestVisibleCount] =
    React.useState(SUGGEST_PAGE_SIZE)
  const suggestScrollRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (matchingLineId !== null) {
      setSuggestSearch('')
      setSuggestType([])
      setSuggestFrom('')
      setSuggestTo('')
      setSuggestMin('')
      setSuggestMax('')
      setShowSuggestFilters(false)
      setSuggestVisibleCount(SUGGEST_PAGE_SIZE)
      if (suggestScrollRef.current) {
        suggestScrollRef.current.scrollTop = 0
      }
    }
  }, [matchingLineId])

  const suggestActiveFilterCount =
    (suggestSearch ? 1 : 0) +
    (suggestType.length ? 1 : 0) +
    (suggestFrom || suggestTo ? 1 : 0) +
    (suggestMin || suggestMax ? 1 : 0)

  const clearSuggestFilters = () => {
    setSuggestSearch('')
    setSuggestType([])
    setSuggestFrom('')
    setSuggestTo('')
    setSuggestMin('')
    setSuggestMax('')
    setSuggestVisibleCount(SUGGEST_PAGE_SIZE)
  }

  const filteredSuggestions = React.useMemo(() => {
    return suggestions.filter((s: any) => {
      if (suggestSearch) {
        const q = suggestSearch.toLowerCase()
        const matchNum = String(s.number || '').toLowerCase().includes(q)
        const matchDesc = String(s.description || '').toLowerCase().includes(q)
        const matchAmt = String(s.amount).includes(q)
        if (!matchNum && !matchDesc && !matchAmt) return false
      }
      if (suggestType.length > 0 && !suggestType.includes(s.type)) {
        return false
      }
      if (suggestFrom && s.date < suggestFrom) return false
      if (suggestTo && s.date > suggestTo) return false
      if (suggestMin && s.amount < Number(suggestMin)) return false
      if (suggestMax && s.amount > Number(suggestMax)) return false
      return true
    })
  }, [
    suggestions,
    suggestSearch,
    suggestType,
    suggestFrom,
    suggestTo,
    suggestMin,
    suggestMax,
  ])

  const visibleSuggestions = React.useMemo(() => {
    return filteredSuggestions.slice(0, suggestVisibleCount)
  }, [filteredSuggestions, suggestVisibleCount])

  const handleSuggestScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      setSuggestVisibleCount((prev) =>
        Math.min(prev + SUGGEST_PAGE_SIZE, filteredSuggestions.length),
      )
    }
  }

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
  const [viewingMatchLine, setViewingMatchLine] = React.useState<any | null>(
    null,
  )

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
          onImported={async () => {
            await queryClient.invalidateQueries()
          }}
        />

        {allLines.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2">
            <Landmark className="size-8 text-slate-300" />
            <p className="font-semibold text-slate-700">
              Chưa có giao dịch sao kê nào trong hệ thống
            </p>
            <p className="text-slate-500">
              Bấm <strong>Nhập Sao Kê</strong> ở góc phải trên để tải lên sao kê từ ngân hàng.
            </p>
          </div>
        )}

        {/* Bank Account Multi-Select Filter */}
        {accounts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Tài Khoản Ngân Hàng
              </span>
              {totalUnmatched > 0 && (
                <span className="text-xs text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-medium">
                  Còn <strong>{totalUnmatched}</strong> giao dịch cần đối soát
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="w-full sm:w-96">
                <MultiSearchSelect
                  className="h-10 w-full text-xs rounded-lg bg-white shadow-xs"
                  placeholder="Tất cả tài khoản ngân hàng"
                  searchPlaceholder="Tìm kiếm tài khoản..."
                  values={selectedAccountIds.map(String)}
                  onValuesChange={(vals) =>
                    setSelectedAccountIds(vals.map(Number))
                  }
                >
                  {accounts.map((acc: any) => {
                    const bankLabel =
                      acc.bankShortName || acc.bankCode || acc.bankName
                    return (
                      <SearchSelectItem
                        key={acc.id}
                        value={String(acc.id)}
                        keywords={`${bankLabel} ${acc.accountNumber}`}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <BankLabel image={acc.bankImage} name={bankLabel}>
                            <span className="font-medium text-slate-800">
                              {bankLabel}
                            </span>
                            <span className="text-slate-400 text-xs">
                              ({acc.accountNumber})
                            </span>
                          </BankLabel>
                          {acc.unmatchedLines > 0 ? (
                            <Badge className="py-0 px-1.5 text-[10px] font-bold bg-amber-100 text-amber-900 border-amber-200">
                              {acc.unmatchedLines} chưa khớp
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              {acc.totalLines || 0} dòng
                            </span>
                          )}
                        </div>
                      </SearchSelectItem>
                    )
                  })}
                </MultiSearchSelect>
              </div>

              {selectedAccountIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedAccountIds([])}
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-medium self-start sm:self-center cursor-pointer"
                >
                  Bỏ chọn ({allLines.length} giao dịch)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800">
                {selectedAccountIds.length === 1 ? (
                  (() => {
                    const acc = accounts.find(
                      (a: any) => a.id === selectedAccountIds[0],
                    )
                    return acc ? (
                      <>
                        Sổ Phụ Giao Dịch:{' '}
                        <span className="font-semibold text-emerald-800">
                          {acc.bankShortName ||
                            acc.bankCode ||
                            acc.bankName}{' '}
                          &bull; {acc.accountNumber}
                        </span>
                      </>
                    ) : (
                      'Tất Cả Giao Dịch Sao Kê Ngân Hàng'
                    )
                  })()
                ) : selectedAccountIds.length > 1 ? (
                  <>
                    Sổ Phụ Giao Dịch:{' '}
                    <span className="font-semibold text-emerald-800">
                      {selectedAccountIds.length} tài khoản đã chọn
                    </span>
                  </>
                ) : (
                  'Tất Cả Giao Dịch Sao Kê Ngân Hàng'
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Hiển thị số dư biến động & trạng thái đối chiếu thực tế với chứng từ
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Quick Status Filters */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/70 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFilter('status', undefined)}
                  className={cn(
                    'px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium',
                    !status?.length
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  Tất cả ({inScopeLines.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('status', ['unmatched'])}
                  className={cn(
                    'px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 font-medium',
                    status?.includes('unmatched') && !status?.includes('matched')
                      ? 'bg-amber-500 text-slate-950 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-amber-800',
                  )}
                >
                  <span>Chưa đối soát</span>
                  <span className="text-[10px] px-1 rounded-full bg-black/10">
                    {inScopeUnmatched}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('status', ['matched'])}
                  className={cn(
                    'px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 font-medium',
                    status?.includes('matched') && !status?.includes('unmatched')
                      ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-emerald-800',
                  )}
                >
                  <span>Đã khớp</span>
                  <span className="text-[10px] px-1 rounded-full bg-white/20">
                    {inScopeMatched}
                  </span>
                </button>
              </div>

              <div className="text-xs text-slate-500 hidden sm:block">
                {activeFilterCount > 0
                  ? `${filteredLines.length}/${inScopeLines.length} dòng`
                  : `Tổng ${filteredLines.length} dòng`}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFilters(true)}
                aria-haspopup="dialog"
                className={`gap-1.5 ${activeFilterCount > 0 ? 'border-emerald-600 text-emerald-800 font-semibold' : ''}`}
              >
                <SlidersHorizontal className="size-3.5" />
                Bộ lọc
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-emerald-700 text-white text-[11px] px-1.5 font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleExportExcel()}
                disabled={exporting || filteredLines.length === 0}
                title={`Xuất ${filteredLines.length} giao dịch theo bộ lọc hiện tại`}
                className="gap-1.5"
              >
                {exporting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                {exporting ? 'Đang xuất...' : 'Xuất Excel'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="table-fixed min-w-[1330px]">
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50/70">
<TableHead className="w-12 text-center">STT</TableHead>
                    <TableHead className="w-24">Ngày GD</TableHead>
                    <TableHead className="w-44">Tài Khoản</TableHead>
                    <TableHead className="w-[300px]">Nội Dung Diễn Giải</TableHead>
                    <TableHead className="w-36 text-right">
                      Tiền Ra (Ghi Nợ)
                    </TableHead>
                    <TableHead className="w-36 text-right">
                      Tiền Vào (Ghi Có)
                    </TableHead>
                    <TableHead className="w-44 text-center">
                      Đối Chiếu
                    </TableHead>
                    <TableHead className="w-60 text-center">
                      Thao tác
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {linesPg.pageItems.map((l: any, rowIdx) => {
                    const isMatched = l.status === 'matched'
                    return (
                      <TableRow key={l.id} className="hover:bg-slate-50/80">
<TableCell className="text-center text-muted-foreground">{linesPg.pageSize * (linesPg.page - 1) + rowIdx + 1}</TableCell>
                        <TableCell className="text-slate-500">
                          {formatDate(l.transactionDate)}
                        </TableCell>
                        <TableCell className="max-w-[176px]">
                          <div
                            className="flex items-center gap-2 min-w-0"
                            title={`${l.bankName} - ${l.accountNumber}`}
                          >
                            <BankLogo
                              src={l.bankImage}
                              name={l.bankName}
                              className="h-4 w-7 shrink-0"
                            />
                            <div className="truncate">
                              <span className="font-semibold text-slate-900 leading-tight block truncate">
                                {l.bankShortName || l.bankCode || l.bankName}
                              </span>
                              <span className="text-[10px] text-slate-500 leading-tight block">
                                • {l.accountNumber.slice(-4)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          className="truncate font-medium text-slate-900"
                          title={l.description}
                        >
                          <div className="truncate">{l.description}</div>
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
                                onClick={() => setViewingMatchLine(l)}
                                className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px] gap-1 cursor-pointer hover:bg-emerald-100 transition-colors"
                                title="Bấm để xem chi tiết khớp"
                              >
                                <CheckCircle2 className="size-3 text-emerald-600" />
                                Đã khớp ·{' '}
                                {MATCH_LABELS[
                                  l.matchedType as keyof typeof MATCH_LABELS
                                ] ?? 'Chứng từ'}
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
                            <div className="inline-flex items-center justify-center gap-1.5">
                              {!isMatched ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1 font-medium"
                                    onClick={() => openSuggestModal(l.id)}
                                  >
                                    <ArrowRightLeft className="size-3" />
                                    Tìm khớp
                                  </Button>
                                  <Can permission="reconcile.manage">
                                    <Button
                                      variant="ghost"
                                      size="icon"
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
                                      title="Sửa dòng giao dịch"
                                    >
                                      <Pencil className="size-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={isBusy(`line:${l.id}`)}
                                      onClick={() => handleDeleteLine(l)}
                                      className="size-7 text-slate-400 hover:text-rose-600"
                                      aria-label="Xóa"
                                      title="Xóa dòng giao dịch"
                                    >
                                      <BusyTrash
                                        busy={isBusy(`line:${l.id}`)}
                                      />
                                    </Button>
                                  </Can>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1 px-2 font-medium"
                                    onClick={() => setViewingMatchLine(l)}
                                    title="Xem chi tiết chứng từ đã khớp"
                                  >
                                    <Eye className="size-3" />
                                    Xem khớp
                                  </Button>
                                  <Can permission="reconcile.manage">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 gap-1 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 px-2 font-medium"
                                      disabled={setLineStatus.isPending}
                                      onClick={() => handleUnmatch(l.id)}
                                      title="Gỡ liên kết khớp"
                                    >
                                      {cancellingLineId === l.id ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : (
                                        <Unlink className="size-3" />
                                      )}
                                      {cancellingLineId === l.id
                                        ? 'Đang gỡ...'
                                        : 'Gỡ khớp'}
                                    </Button>
                                  </Can>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <TablePagination pagination={linesPg} />
              </div>
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
                <Label className="text-xs font-semibold">
                  Tài khoản ngân hàng
                </Label>
                <MultiSearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  placeholder="Tất cả tài khoản"
                  searchPlaceholder="Tìm kiếm tài khoản..."
                  values={selectedAccountIds.map(String)}
                  onValuesChange={(vals) =>
                    setSelectedAccountIds(vals.map(Number))
                  }
                >
                  {accounts.map((acc: any) => {
                    const bankLabel =
                      acc.bankShortName || acc.bankCode || acc.bankName
                    return (
                      <SearchSelectItem
                        key={acc.id}
                        value={String(acc.id)}
                        keywords={`${bankLabel} ${acc.accountNumber}`}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <BankLabel image={acc.bankImage} name={bankLabel}>
                            <span>{bankLabel}</span>
                            <span className="text-slate-400 text-xs">
                              ({acc.accountNumber})
                            </span>
                          </BankLabel>
                          {acc.unmatchedLines > 0 && (
                            <Badge className="py-0 px-1 text-[10px] font-bold bg-amber-100 text-amber-900 border-amber-200">
                              {acc.unmatchedLines} chưa khớp
                            </Badge>
                          )}
                        </div>
                      </SearchSelectItem>
                    )
                  })}
                </MultiSearchSelect>
              </div>
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
                  <SearchSelectItem value="in">
                    Tiền vào (ghi có)
                  </SearchSelectItem>
                  <SearchSelectItem value="out">
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
                  <SearchSelectItem value="matched">
                    Đã khớp
                  </SearchSelectItem>
                  <SearchSelectItem value="unmatched">
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
                      <SearchSelectItem key={k} value={k}>
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
          <DialogContent className="max-h-[85vh] sm:max-w-4xl flex flex-col p-6 overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-base font-bold text-slate-900">
                Gợi Ý Chứng Từ Khớp Với Giao Dịch Sao Kê
              </DialogTitle>
              <DialogDescription className="text-xs">
                Tự động tìm kiếm các Phiếu thu, Phiếu chi hoặc Khoản trả nợ khế
                ước có cùng số tiền và ngày giao dịch gần đây.
              </DialogDescription>
            </DialogHeader>

            {/* Search and filters toolbar */}
            <div className="space-y-2 pt-1 shrink-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={suggestSearch}
                    onChange={(e) => {
                      setSuggestSearch(e.target.value)
                      setSuggestVisibleCount(SUGGEST_PAGE_SIZE)
                    }}
                    placeholder="Tìm theo tên đối tác, số hợp đồng/chứng từ, ghi chú..."
                    className="h-9 pl-9 pr-8 text-xs rounded-lg"
                  />
                  {suggestSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setSuggestSearch('')
                        setSuggestVisibleCount(SUGGEST_PAGE_SIZE)
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 size-4 flex items-center justify-center text-xs"
                      title="Xóa tìm kiếm"
                    >
                      ×
                    </button>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSuggestFilters(true)}
                  className="h-9 text-xs gap-1.5 shrink-0"
                >
                  <SlidersHorizontal className="size-3.5" />
                  Bộ lọc
                  {suggestActiveFilterCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                      {suggestActiveFilterCount}
                    </span>
                  )}
                </Button>

                {suggestActiveFilterCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSuggestFilters}
                    className="h-9 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 px-2.5 gap-1 shrink-0"
                  >
                    <RotateCcw className="size-3" />
                    Xóa lọc
                  </Button>
                )}

                <div className="text-[11px] text-slate-500 whitespace-nowrap self-center shrink-0">
                  Hiển thị <strong>{visibleSuggestions.length}</strong> / {filteredSuggestions.length} chứng từ
                </div>
              </div>
            </div>

            {/* List with infinite scroll */}
            <div
              ref={suggestScrollRef}
              onScroll={handleSuggestScroll}
              className="py-2 overflow-y-auto max-h-[50vh] min-h-[200px] flex-1 my-1 pr-1 space-y-2"
            >
              {loadingSuggestions ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Đang tìm chứng từ phù hợp...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                  Không tìm thấy chứng từ nội bộ nào có cùng số tiền và ngày
                  giao dịch gần đây.
                </div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed flex flex-col items-center justify-center gap-2">
                  <span>Không tìm thấy chứng từ nào khớp với bộ lọc hiện tại.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearSuggestFilters}
                    className="h-7 text-xs"
                  >
                    Xóa bộ lọc
                  </Button>
                </div>
              ) : (
                <>
                  {visibleSuggestions.map((s: any) => (
                    <div
                      key={`${s.type}-${s.id}`}
                      className="p-3 rounded-lg border border-slate-200 hover:border-emerald-300 bg-slate-50/50 flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold uppercase shrink-0"
                          >
                            {s.type === 'receipt'
                              ? 'Phiếu Thu'
                              : s.type === 'payment'
                                ? 'Phiếu Chi'
                                : 'Trả Nợ Khế Ước'}
                          </Badge>
                          <span className="font-medium text-slate-900 text-xs truncate">
                            {s.number}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Ngày chứng từ: {formatDate(s.date)} &bull; Số tiền:{' '}
                          <strong className="whitespace-nowrap text-slate-900">
                            {formatVnd(s.amount)}
                          </strong>
                        </div>
                        {s.description && (
                          <div className="text-[11px] text-slate-500 italic truncate max-w-md">
                            {s.description}
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1 shrink-0"
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

                  {/* Infinite scroll sentinel / loading indicator */}
                  {suggestVisibleCount < filteredSuggestions.length && (
                    <div className="py-2.5 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2 border-t border-slate-100">
                      <Loader2 className="size-3.5 animate-spin text-emerald-700" />
                      Đang cuộn tải thêm chứng từ ({visibleSuggestions.length}/{filteredSuggestions.length})...
                    </div>
                  )}

                  {suggestVisibleCount >= filteredSuggestions.length && filteredSuggestions.length > SUGGEST_PAGE_SIZE && (
                    <div className="py-2 text-center text-[11px] text-slate-400">
                      Đã hiển thị toàn bộ {filteredSuggestions.length} chứng từ gợi ý
                    </div>
                  )}
                </>
              )}
            </div>

            <DialogFooter className="shrink-0 pt-2 border-t border-slate-100">
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

        {/* Suggestion Filter Popup Dialog */}
        <Dialog
          open={showSuggestFilters}
          onOpenChange={setShowSuggestFilters}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Bộ Lọc Gợi Ý Chứng Từ
              </DialogTitle>
              <DialogDescription className="text-xs">
                Thu hẹp danh sách các chứng từ nội bộ cần tìm khớp.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Loại chứng từ</Label>
                <MultiSearchSelect
                  className="h-10 w-full text-xs rounded-lg"
                  placeholder="Tất cả loại chứng từ"
                  values={suggestType}
                  onValuesChange={(vals) => {
                    setSuggestType(vals)
                    setSuggestVisibleCount(SUGGEST_PAGE_SIZE)
                  }}
                >
                  <SearchSelectItem value="receipt">
                    Phiếu Thu
                  </SearchSelectItem>
                  <SearchSelectItem value="payment">
                    Phiếu Chi
                  </SearchSelectItem>
                  <SearchSelectItem value="loan_repayment">
                    Trả Nợ Khế Ước
                  </SearchSelectItem>
                </MultiSearchSelect>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Từ ngày</Label>
                  <Input
                    type="date"
                    value={suggestFrom}
                    onChange={(e) => {
                      setSuggestFrom(e.target.value)
                      setSuggestVisibleCount(SUGGEST_PAGE_SIZE)
                    }}
                    className="h-10 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Đến ngày</Label>
                  <Input
                    type="date"
                    value={suggestTo}
                    onChange={(e) => {
                      setSuggestTo(e.target.value)
                      setSuggestVisibleCount(SUGGEST_PAGE_SIZE)
                    }}
                    className="h-10 text-xs rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <PriceRangeFilter
                  label="Khoảng số tiền chứng từ"
                  min={suggestMin ? Number(suggestMin) : undefined}
                  max={suggestMax ? Number(suggestMax) : undefined}
                  onChange={(lo, hi) => {
                    setSuggestMin(lo !== undefined ? String(lo) : '')
                    setSuggestMax(hi !== undefined ? String(hi) : '')
                    setSuggestVisibleCount(SUGGEST_PAGE_SIZE)
                  }}
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={suggestActiveFilterCount === 0}
                onClick={clearSuggestFilters}
                className="h-8 text-xs text-slate-500"
              >
                Xóa lọc
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowSuggestFilters(false)}
                className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Xong
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
                <Textarea
                  rows={3}
                  className="min-h-[4.75rem] text-xs resize-y"
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

      {/* View matched details Dialog */}
      <Dialog
        open={viewingMatchLine !== null}
        onOpenChange={(o) => !o && setViewingMatchLine(null)}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Chi Tiết Khớp Đối Chiếu
            </DialogTitle>
            <DialogDescription className="text-xs">
              Thông tin liên kết giữa giao dịch sao kê ngân hàng và chứng từ nội bộ hệ thống.
            </DialogDescription>
          </DialogHeader>

          {viewingMatchLine && (
            <div className="space-y-4 py-2">
              {/* Bank transaction box */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Giao dịch sao kê</span>
                  <Badge variant="outline" className="text-[10px] bg-white text-slate-700">
                    {formatDate(viewingMatchLine.transactionDate)}
                  </Badge>
                </div>
                <div className="text-xs text-slate-800">
                  <span className="text-slate-500">Nội dung diễn giải: </span>
                  <strong>{viewingMatchLine.description || '—'}</strong>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  {viewingMatchLine.debit > 0 && (
                    <div>
                      <span className="text-slate-500">Tiền ra (ghi nợ): </span>
                      <strong className="text-rose-700 font-bold">
                        {formatVnd(viewingMatchLine.debit)}
                      </strong>
                    </div>
                  )}
                  {viewingMatchLine.credit > 0 && (
                    <div>
                      <span className="text-slate-500">Tiền vào (ghi có): </span>
                      <strong className="text-emerald-700 font-bold">
                        {formatVnd(viewingMatchLine.credit)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Matched Voucher Box */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Chứng từ nội bộ đã khớp
                  </div>
                  <Badge className="bg-emerald-700 text-white text-[11px] font-semibold">
                    {viewingMatchLine.matchedInfo?.typeLabel ??
                      MATCH_LABELS[
                        viewingMatchLine.matchedType as keyof typeof MATCH_LABELS
                      ] ??
                      'Chứng từ'}
                  </Badge>
                </div>

                {viewingMatchLine.matchedInfo ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-start gap-2 border-b border-emerald-100 pb-2">
                      <span className="text-slate-500">Đối tượng liên quan:</span>
                      <span className="font-semibold text-slate-900 text-right">
                        {viewingMatchLine.matchedInfo.party}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                      <span className="text-slate-500">Ngày lập chứng từ:</span>
                      <span className="font-medium text-slate-800">
                        {formatDate(viewingMatchLine.matchedInfo.date)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                      <span className="text-slate-500">Số tiền chứng từ:</span>
                      <span className="font-bold text-emerald-800 text-sm">
                        {formatVnd(viewingMatchLine.matchedInfo.amount)}
                      </span>
                    </div>
                    {viewingMatchLine.matchedInfo.details && (
                      <div className="flex justify-between items-start gap-2 border-b border-emerald-100 pb-2">
                        <span className="text-slate-500">Ghi chú / Diễn giải:</span>
                        <span className="text-slate-800 text-right font-medium">
                          {viewingMatchLine.matchedInfo.details}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-600">
                    Khớp với {MATCH_LABELS[viewingMatchLine.matchedType as keyof typeof MATCH_LABELS] ?? viewingMatchLine.matchedType} #{viewingMatchLine.matchedId}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
            {viewingMatchLine?.matchedInfo?.targetUrl ? (
              <Link
                to={viewingMatchLine.matchedInfo.targetUrl}
                preload="intent"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-semibold underline"
              >
                <ExternalLink className="size-3.5" />
                Mở trang chứng từ
              </Link>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingMatchLine(null)}
                className="h-8 text-xs"
              >
                Đóng
              </Button>
              {viewingMatchLine && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 gap-1 font-medium"
                  disabled={setLineStatus.isPending}
                  onClick={async () => {
                    const id = viewingMatchLine.id
                    setViewingMatchLine(null)
                    await handleUnmatch(id)
                  }}
                >
                  <Unlink className="size-3.5" />
                  Gỡ khớp
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
