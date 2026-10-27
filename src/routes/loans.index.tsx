import { useBusyKeys } from '#/lib/use-busy.ts'
import { useUrlText } from '#/lib/use-url-text.ts'
import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calculator,
  Pencil,
  Plus,
  SlidersHorizontal,
} from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { DecimalInput } from '#/components/ui/decimal-input.tsx'
import { Input } from '#/components/ui/input.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import { MultiSearchSelect } from '#/components/ui/multi-search-select.tsx'
import { PriceRangeFilter } from '#/components/ui/price-range-filter.tsx'
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

const SORT_KEYS = [
  'contract',
  'bank',
  'rate',
  'term',
  'paid',
  'outstanding',
] as const
type SortKey = (typeof SORT_KEYS)[number]
const SORT_VALUE: Record<
  SortKey,
  (l: {
    contractNumber: string
    bankName: string | null
    interestRate: number
    termMonths: number
    principalPaid: number
    outstanding: number
  }) => number | string
> = {
  contract: (l) => l.contractNumber,
  bank: (l) => l.bankName ?? '',
  rate: (l) => l.interestRate,
  term: (l) => l.termMonths,
  paid: (l) => l.principalPaid,
  outstanding: (l) => l.outstanding,
}

export const Route = createFileRoute('/loans/')({
  // Filters and sort live in the URL so a reload or shared link keeps them
  validateSearch: z.object({
    q: z.string().optional().catch(undefined),
    bank: z.array(z.number().int()).optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    minPrincipal: z.number().optional().catch(undefined),
    maxPrincipal: z.number().optional().catch(undefined),
    sort: z.enum(SORT_KEYS).optional().catch(undefined),
    dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  }),
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
  const { data: master } = useSuspenseQuery(masterDataQuery())

  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()
  const [showFilters, setShowFilters] = React.useState(false)
  const {
    bank,
    from,
    to,
    minPrincipal,
    maxPrincipal,
    sort,
    dir,
  } = searchParams
  // The box filters instantly; the URL follows once typing pauses
  const [contractSearch, setContractSearch] = useUrlText(
    searchParams.q ?? '',
    (q) =>
      navigate({
        search: (prev) => ({ ...prev, q: q || undefined }),
        replace: true,
      }),
  )
  const setFilter = (
    key: 'bank' | 'from' | 'to',
    value: string | string[] | number[] | undefined,
  ) =>
    navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: true })

  const activeFilterCount = [
    Boolean(contractSearch.trim()),
    Boolean(bank?.length),
    Boolean(from || to),
    minPrincipal !== undefined || maxPrincipal !== undefined,
  ].filter(Boolean).length

  const filtered = loans.filter((l) => {
    const q = contractSearch.trim().toLowerCase()
    if (q && !l.contractNumber.toLowerCase().includes(q)) return false
    if (bank?.length && (l.bankId === null || !bank.includes(l.bankId))) return false
    const date = String(l.disbursementDate).slice(0, 10)
    if (from && date < from) return false
    if (to && date > to) return false
    if (minPrincipal !== undefined && l.principalAmount < minPrincipal)
      return false
    if (maxPrincipal !== undefined && l.principalAmount > maxPrincipal)
      return false
    return true
  })
  // No sort chosen keeps the server order (newest disbursement first)
  const sorted = sort
    ? [...filtered].sort((a, b) => {
        const va = SORT_VALUE[sort](a)
        const vb = SORT_VALUE[sort](b)
        const cmp =
          typeof va === 'string' || typeof vb === 'string'
            ? String(va).localeCompare(String(vb), 'vi')
            : va - vb
        return dir === 'asc' ? cmp : -cmp
      })
    : filtered
  const loansPg = usePagination(
    sorted,
    `${contractSearch}|${bank?.join()}|${from}|${to}|${minPrincipal}|${maxPrincipal}|${sort}|${dir}`,
  )

  // Header click: ascending, then descending, then back to the default order
  const toggleSort = (key: SortKey) => {
    const next =
      sort !== key
        ? { sort: key, dir: 'asc' as const }
        : dir === 'asc'
          ? { sort: key, dir: 'desc' as const }
          : { sort: undefined, dir: undefined }
    navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })
  }
  const sortHead = (key: SortKey, label: string, align: string) => (
    <TableHead className={align}>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1 font-[inherit] uppercase hover:text-slate-900 ${sort === key ? 'text-purple-800' : ''}`}
      >
        {label}
        {sort !== key ? (
          <ArrowUpDown className="size-3 opacity-40" />
        ) : dir === 'asc' ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )}
      </button>
    </TableHead>
  )
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
  // null = creating a new contract, otherwise the id being edited
  const [editId, setEditId] = React.useState<number | null>(null)
  const [contractNumber, setContractNumber] = React.useState(
    `KU-${todayIso().slice(0, 4)}-VCB-01`,
  )
  const [principalAmount, setPrincipalAmount] = React.useState(2_000_000_000)
  const [interestRate, setInterestRate] = React.useState(8.5)
  const [disbursementDate, setDisbursementDate] = React.useState(todayIso())
  const [termMonths, setTermMonths] = React.useState(12)
  const [bankId, setBankId] = React.useState<number | null>(null)
  // What the user typed so far, shown live under the form
  const estimate = estimateLoanTermInterest(
    principalAmount,
    interestRate,
    termMonths,
  )
  const savingLoan = saveLoan.isPending

  const { isBusy, setBusy } = useBusyKeys()


  const handleDelete = async (l: { id: number; contractNumber: string }) => {
    // Used loans show what uses them; unused ones ask for confirmation
    const ok = await confirmDelete(
      { entity: 'loans', id: l.id, name: l.contractNumber },
      {
        title: `Xóa khế ước ${l.contractNumber}?`,
        description: 'Hành động này không thể hoàn tác.',
      },
      (checking) => setBusy(`loans:${l.id}`, checking),
    )
    if (!ok) return
    setBusy(`loans:${l.id}`, true)
    try {
      await deleteLoan.mutateAsync({ data: { id: l.id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity: 'loans', id: l.id, name: l.contractNumber },
        'Không thể xóa khế ước',
      )
    } finally {
      setBusy(`loans:${l.id}`, false)
    }
  }

  const openNewLoan = () => {
    setEditId(null)
    setContractNumber(`KU-${todayIso().slice(0, 4)}-VCB-01`)
    setPrincipalAmount(2_000_000_000)
    setInterestRate(8.5)
    setDisbursementDate(todayIso())
    setTermMonths(12)
    setBankId(master.banks[0]?.id ?? null)
    setNewLoanOpen(true)
  }

  const openEditLoan = (l: (typeof loans)[number]) => {
    setEditId(l.id)
    setContractNumber(l.contractNumber)
    setPrincipalAmount(l.principalAmount)
    setInterestRate(l.interestRate)
    setDisbursementDate(l.disbursementDate)
    setTermMonths(l.termMonths)
    setBankId(l.bankId ?? null)
    setNewLoanOpen(true)
  }

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (bankId === null)
      return showErrorDialog(
        new Error('Vui lòng chọn ngân hàng'),
        'Lỗi khi lưu khế ước vay',
      )
    try {
      await saveLoan.mutateAsync({
        data: {
          id: editId ?? undefined,
          contractNumber,
          principalAmount,
          interestRate,
          disbursementDate,
          termMonths,
          bankId,
        },
      })
      setNewLoanOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu khế ước vay')
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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFilters(true)}
              aria-haspopup="dialog"
              className={`gap-1.5 ${activeFilterCount > 0 ? 'border-purple-600 text-purple-800' : ''}`}
            >
              <SlidersHorizontal className="size-4" />
              Bộ lọc
              {activeFilterCount > 0 && (
                <span className="ml-0.5 rounded-full bg-purple-700 text-white text-[11px] px-1.5">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Can permission="loans.manage">
              <Button
                size="sm"
                onClick={openNewLoan}
                className="bg-purple-700 hover:bg-purple-800 text-white gap-1.5 shadow-xs"
              >
                <Plus className="size-4" />
                Tạo Khế Ước Mới
              </Button>
            </Can>
          </div>
        </div>

        {/* Loan Contracts Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh Sách Khế Ước Vay Ngân Hàng ({filtered.length})
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
                    {sortHead('contract', 'Số Khế Ước', '')}
                    {sortHead('bank', 'Ngân Hàng', '')}
                    {sortHead('rate', 'Lãi Suất', 'text-center')}
                    {sortHead('term', 'Kỳ Hạn', 'text-center')}
                    {sortHead('paid', 'Gốc Đã Trả', 'text-right')}
                    {sortHead('outstanding', 'Dư Nợ Còn Lại', 'text-right')}
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
                        {l.bankName ? (
                          <BankLabel image={l.bankImage} name={l.bankName}>
                            {l.bankName}
                          </BankLabel>
                        ) : (
                          '—'
                        )}
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
                            onClick={() => openEditLoan(l)}
                            className="size-7 text-slate-400 hover:text-purple-700"
                            aria-label="Sửa khế ước"
                            title="Sửa khế ước"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(l)}
                            disabled={isBusy(`loans:${l.id}`)}
                            className="size-7 text-slate-400 hover:text-rose-600"
                            aria-label="Xóa khế ước"
                            title="Xóa khế ước"
                          >
                            <BusyTrash busy={isBusy(`loans:${l.id}`)} />
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

        {/* Filter + sort dialog */}
        <Dialog open={showFilters} onOpenChange={setShowFilters}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Bộ Lọc Khế Ước
              </DialogTitle>
              <DialogDescription className="text-xs">
                Tìm theo số khế ước, ngân hàng, ngày giải ngân và số tiền vay ({filtered.length} khế ước phù hợp)
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Số khế ước</Label>
                <Input
                  placeholder="Tìm theo số khế ước..."
                  value={contractSearch}
                  onChange={(e) => setContractSearch(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Ngân hàng</Label>
                <MultiSearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  placeholder="Tất cả ngân hàng"
                  values={(bank ?? []).map(String)}
                  onValuesChange={(vals) =>
                    setFilter('bank', vals.length ? vals.map(Number) : undefined)
                  }
                >
                  {master.banks.map((b) => (
                    <SearchSelectItem
                      key={b.id}
                      value={String(b.id)}
                      keywords={`${b.code ?? ''} ${b.shortName ?? ''}`}
                     
                    >
                      <BankLabel image={b.image} name={b.name}>
                        {b.name}
                      </BankLabel>
                    </SearchSelectItem>
                  ))}
                </MultiSearchSelect>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Giải ngân từ</Label>
                <Input
                  type="date"
                  value={from ?? ''}
                  onChange={(e) =>
                    setFilter('from', e.target.value || undefined)
                  }
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Giải ngân đến</Label>
                <Input
                  type="date"
                  value={to ?? ''}
                  onChange={(e) => setFilter('to', e.target.value || undefined)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <PriceRangeFilter
                  label="Số tiền vay"
                  min={minPrincipal}
                  max={maxPrincipal}
                  onChange={(lo, hi) =>
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        minPrincipal: lo,
                        maxPrincipal: hi,
                      }),
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
                  setContractSearch('')
                  navigate({
                    search: (prev) => ({
                      sort: prev.sort,
                      dir: prev.dir,
                    }),
                    replace: true,
                  })
                }}
                className="h-8 text-xs text-slate-500"
              >
                Xóa lọc
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowFilters(false)}
                className="h-8 text-xs bg-purple-700 hover:bg-purple-800 text-white font-semibold"
              >
                Xong
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create New Loan Contract Modal */}
        <Dialog open={newLoanOpen} onOpenChange={setNewLoanOpen}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {editId ? 'Sửa Khế Ước Vay' : 'Tạo Khế Ước Vay Ngân Hàng Mới'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateLoan} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Khế Ước Vay *</Label>
                <Input
                  required
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ngân Hàng *</Label>
                <SearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  placeholder="Chọn ngân hàng"
                  value={bankId ? String(bankId) : ''}
                  onValueChange={(v) => setBankId(Number(v))}
                >
                  {master.banks.map((b) => (
                    <SearchSelectItem
                      key={b.id}
                      value={String(b.id)}
                      keywords={`${b.code ?? ''} ${b.shortName ?? ''}`}
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
                    className="h-11 text-sm px-4 rounded-lg"
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
                    className="h-11 text-sm px-4 rounded-lg"
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
                    className="h-11 text-sm px-4 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Kỳ Hạn Vay *</Label>
                  <SearchSelect
                    value={String(termMonths)}
                    onValueChange={(v) => setTermMonths(Number(v))}
                    className="h-11 w-full text-sm rounded-lg"
                    placeholder="Chọn kỳ hạn"
                  >
                    {TERM_OPTIONS.map((n) => (
                      <SearchSelectItem
                        key={n}
                        value={String(n)}
                       
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
