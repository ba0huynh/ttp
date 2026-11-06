import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  Download,
  Eye,
  Loader2,
  Pencil,
  Plus,
  SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import * as React from 'react'
import { z } from 'zod'

import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import {
  confirmDialog,
  showErrorDialog,
} from '#/components/ui/confirm-dialog.tsx'
import { useBusyKeys } from '#/lib/use-busy.ts'
import { BankAccountSelect } from '#/components/finance/BankAccountSelect.tsx'
import { BankLabel } from '#/components/finance/BankLabel.tsx'
import { Can } from '#/components/auth/Can.tsx'
import { SupplierLink } from '#/components/suppliers/SupplierDetailDialog.tsx'
import { AppLayout } from '#/components/layout/AppLayout.tsx'
import {
  SalesDeliveryBadge,
  SalesInvoiceBadge,
} from '#/components/sales/SalesWarehouseBadges.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Checkbox } from '#/components/ui/checkbox.tsx'
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
import { Input } from '#/components/ui/input.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import { MultiSearchSelect } from '#/components/ui/multi-search-select.tsx'
import { PriceRangeFilter } from '#/components/ui/price-range-filter.tsx'
import { useUrlText } from '#/lib/use-url-text.ts'
import { Label } from '#/components/ui/label.tsx'
import { Textarea } from '#/components/ui/textarea.tsx'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs.tsx'
import { formatDate, formatVnd, todayIso } from '#/lib/business.ts'
import { cn } from '#/lib/utils.ts'
import {
  customerOptionsQuery,
  masterDataQuery,
  payablesQuery,
  paymentsQuery,
  receiptsQuery,
  receivablesQuery,
  currentUserQuery,
} from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import {
  createPaymentVoucherFn,
  createReceiptVoucherFn,
  deletePaymentVoucherFn,
  deleteReceiptVoucherFn,
  listReceivableOrdersFn,
  listSupplierBatchesFn,
  updatePaymentVoucherFn,
  updateReceiptVoucherFn,
} from '#/server/fns/finance.ts'

type DebtView =
  | {
      kind: 'receivable'
      customerId: number
      branchId: number | null
      title: string
      from?: string
      to?: string
    }
  | {
      kind: 'payable'
      supplierId: number
      title: string
      from?: string
      to?: string
    }

/** Orders behind one debt row: sales orders (receivable) or import batches (payable) */
function DebtOrdersDialog({
  view,
  onClose,
}: {
  view: DebtView | null
  onClose: () => void
}) {
  const receivable = view?.kind === 'receivable' ? view : null
  const payable = view?.kind === 'payable' ? view : null
  const orders = useQuery({
    queryKey: [
      'finance',
      'receivable-orders',
      receivable?.customerId,
      receivable?.branchId,
      receivable?.from ?? '',
      receivable?.to ?? '',
    ],
    queryFn: () =>
      listReceivableOrdersFn({
        data: {
          customerId: receivable!.customerId,
          branchId: receivable!.branchId,
          from: receivable!.from,
          to: receivable!.to,
        },
      }),
    enabled: Boolean(receivable),
  })
  const batches = useQuery({
    queryKey: [
      'finance',
      'supplier-batches',
      payable?.supplierId,
      payable?.from ?? '',
      payable?.to ?? '',
    ],
    queryFn: () =>
      listSupplierBatchesFn({
        data: {
          supplierId: payable!.supplierId,
          from: payable!.from,
          to: payable!.to,
        },
      }),
    enabled: Boolean(payable),
  })
  const active = receivable ? orders : batches
  const rowCount = (receivable ? orders.data : batches.data)?.length ?? 0

  return (
    <Dialog open={Boolean(view)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            {receivable ? 'Các Đơn Bán Xe' : 'Các Đơn Nhập Lô'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {view?.title}
          </DialogDescription>
        </DialogHeader>

        {active.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Đang tải...
          </div>
        ) : active.isError ? (
          <p className="py-6 text-center text-sm text-rose-600">
            Không tải được danh sách
          </p>
        ) : rowCount === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Chưa có đơn nào
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs bg-slate-50">
                  <TableHead className="w-12 text-center">STT</TableHead>
                  <TableHead>{receivable ? 'Ngày Bán' : 'Ngày Nhập'}</TableHead>
                  {receivable && (
                    <>
                      <TableHead className="text-right">Giá Vốn</TableHead>
                      <TableHead className="text-right">
                        Tổng Tiền Chưa VAT
                      </TableHead>
                      <TableHead className="text-center">% VAT</TableHead>
                      <TableHead className="text-right">
                        Tổng Tiền Đã VAT
                      </TableHead>
                    </>
                  )}
                  {receivable && (
                    <>
                      <TableHead className="text-right">Số Xe</TableHead>
                      <TableHead className="text-center">Kho Thực Tế</TableHead>
                      <TableHead className="text-center">Kho Hóa Đơn</TableHead>
                    </>
                  )}
                  {payable && (
                    <>
                      <TableHead className="text-right">Giá Vốn</TableHead>
                      <TableHead className="text-right">
                        Tiền Hàng Chưa VAT
                      </TableHead>
                      <TableHead className="text-center">% VAT</TableHead>
                      <TableHead className="text-right">
                        Tiền Hàng Đã VAT
                      </TableHead>
                      <TableHead className="text-right">Số Xe</TableHead>
                      <TableHead className="text-center">Kho Thực Tế</TableHead>
                      <TableHead className="text-center">Kho Hóa Đơn</TableHead>
                      <TableHead className="text-right">Chi Phí Lô</TableHead>
                      <TableHead>Khế Ước Vay</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {receivable
                  ? (orders.data ?? []).map((o, i) => (
                      <TableRow key={o.id}>
                        <TableCell className="text-center text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <Link
                            to="/sales/$orderId"
                            params={{ orderId: String(o.id) }}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            {formatDate(o.orderDate)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatVnd(o.totalCost)}
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatVnd(o.totalBeforeVat)}
                        </TableCell>
                        <TableCell className="text-center text-slate-500">
                          {o.minVatRate === o.maxVatRate
                            ? `${o.minVatRate}%`
                            : `${o.minVatRate}–${o.maxVatRate}%`}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900">
                          {formatVnd(o.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {o.vehicleCount} xe
                        </TableCell>
                        <TableCell className="text-center">
                          <SalesDeliveryBadge
                            deliveredCount={o.deliveredCount}
                            vehicleCount={o.vehicleCount}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <SalesInvoiceBadge
                            invoicedCount={o.invoicedCount}
                            vehicleCount={o.vehicleCount}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  : (batches.data ?? []).map((b, i) => (
                      <TableRow key={b.id}>
                        <TableCell className="text-center text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <Link
                            to="/batches/$batchId"
                            params={{ batchId: String(b.id) }}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            Lô {formatDate(b.importDate)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatVnd(b.totalCost)}
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatVnd(b.totalBeforeVat)}
                        </TableCell>
                        <TableCell className="text-center text-slate-500">
                          {b.minVatRate === b.maxVatRate
                            ? `${b.minVatRate}%`
                            : `${b.minVatRate}–${b.maxVatRate}%`}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900">
                          {formatVnd(b.totalImport)}
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {b.vehicleCount} xe
                        </TableCell>
                        <TableCell className="text-center">
                          <SalesDeliveryBadge
                            deliveredCount={b.deliveredCount}
                            vehicleCount={b.vehicleCount}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <SalesInvoiceBadge
                            invoicedCount={b.invoicedCount}
                            vehicleCount={b.vehicleCount}
                          />
                        </TableCell>
                        <TableCell className="text-right text-slate-500">
                          {formatVnd(b.totalExpense)}
                        </TableCell>
                        <TableCell>
                          {b.loanContractId ? (
                            <Link
                              to="/loans/$loanId"
                              params={{ loanId: String(b.loanContractId) }}
                              className="font-medium text-emerald-700 hover:underline"
                            >
                              {b.loanContractNumber}
                            </Link>
                          ) : (
                            <span className="text-slate-500">Không vay</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const DIRECT_BRANCH = 'none'
const NO_ACCOUNT = 'none'
const BALANCE = ['owing', 'cleared'] as const

// Each tab keeps its own filters under one key, so the URL stays readable
const moneyRange = {
  min: z.number().optional(),
  max: z.number().optional(),
}
// from / to: period of the orders (receivables) or import batches (payables)
// that the amounts are computed over, also applied to receipts / payments
const rcvFilter = z.object({
  customer: z.array(z.number()).optional(),
  branch: z.array(z.string()).optional(),
  status: z.array(z.enum(BALANCE)).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  ...moneyRange,
})
const payFilter = z.object({
  supplier: z.array(z.number()).optional(),
  status: z.array(z.enum(BALANCE)).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  ...moneyRange,
})
const partyFilter = z.array(z.enum(['customer', 'supplier'])).optional()
const recFilter = z.object({
  party: partyFilter,
  customer: z.array(z.number()).optional(),
  supplier: z.array(z.number()).optional(),
  branch: z.array(z.string()).optional(),
  account: z.array(z.string()).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  ...moneyRange,
})
const pmtFilter = z.object({
  party: partyFilter,
  customer: z.array(z.number()).optional(),
  supplier: z.array(z.number()).optional(),
  account: z.array(z.string()).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  ...moneyRange,
})
type FilterKey = 'rcv' | 'pay' | 'rec' | 'pmt'
type RangeFilter = { min?: number; max?: number }

export const Route = createFileRoute('/finance')({
  // The active tab and its filters live in the URL so a reload keeps them
  validateSearch: z.object({
    tab: z
      .enum(['receivables', 'payables', 'receipts', 'payments'])
      .catch('receivables'),
    rcv: rcvFilter.optional().catch(undefined),
    pay: payFilter.optional().catch(undefined),
    rec: recFilter.optional().catch(undefined),
    pmt: pmtFilter.optional().catch(undefined),
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'finance.view')
    return { user }
  },
  loaderDeps: ({ search }) => ({
    rcv: { from: search.rcv?.from, to: search.rcv?.to },
    pay: { from: search.pay?.from, to: search.pay?.to },
  }),
  loader: async ({ context: { queryClient }, deps }) => {
    await Promise.all([
      queryClient.query(receivablesQuery(deps.rcv)),
      queryClient.query(payablesQuery(deps.pay)),
      queryClient.query(receiptsQuery()),
      queryClient.query(paymentsQuery()),
      queryClient.query(customerOptionsQuery()),
      queryClient.query(masterDataQuery()),
    ])
  },
  component: FinancePage,
})

/** Two-way switch for the counterparty of a receipt / payment voucher */
function PartyToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: readonly (readonly [T, string])[]
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            'h-9 rounded-md text-xs font-semibold transition-colors',
            value === key
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function FinancePage() {
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const { tab } = search
  const navigate = Route.useNavigate()
  const [showFilters, setShowFilters] = React.useState(false)
  // Dates of the debt tabs are edited here and only sent (URL + API) on "Xong"
  const [dateDraft, setDateDraft] = React.useState<{
    from: string
    to: string
  }>({ from: '', to: '' })

  // Merge a change into one tab's filters; empty values are dropped from the URL
  const setTabFilter = (key: FilterKey, patch: Record<string, unknown>) =>
    navigate({
      search: (prev) => {
        const merged = { ...(prev[key] ?? {}), ...patch } as Record<
          string,
          unknown
        >
        const clean = Object.fromEntries(
          Object.entries(merged).filter(
            ([, v]) =>
              v !== undefined &&
              v !== '' &&
              !(Array.isArray(v) && v.length === 0),
          ),
        )
        return { ...prev, [key]: Object.keys(clean).length ? clean : undefined }
      },
      replace: true,
    })
  const clearTabFilter = (key: FilterKey) =>
    navigate({ search: (prev) => ({ ...prev, [key]: undefined }), replace: true })

  const rcvF = search.rcv ?? {}
  const payF = search.pay ?? {}
  const recF = search.rec ?? {}
  const pmtF = search.pmt ?? {}
  // The payment-note box filters instantly; the URL follows once typing pauses
  const [pmtText, setPmtText] = useUrlText(pmtF.q ?? '', (q) =>
    setTabFilter('pmt', { q: q || undefined }),
  )
  const outOfRange = (v: number, r: RangeFilter) =>
    (r.min !== undefined && v < r.min) || (r.max !== undefined && v > r.max)
  const hasRange = (r: RangeFilter) =>
    r.min !== undefined || r.max !== undefined
  const { data: receivables } = useSuspenseQuery(
    receivablesQuery({ from: rcvF.from, to: rcvF.to }),
  )
  const { data: payables } = useSuspenseQuery(
    payablesQuery({ from: payF.from, to: payF.to }),
  )
  const { data: receipts } = useSuspenseQuery(receiptsQuery())
  const { data: payments } = useSuspenseQuery(paymentsQuery())

  const receivablesFiltered = receivables.filter((r) => {
    if (rcvF.customer?.length && !rcvF.customer.includes(r.customerId))
      return false
    if (
      rcvF.branch?.length &&
      !rcvF.branch.includes(r.branchId ? String(r.branchId) : DIRECT_BRANCH)
    )
      return false
    if (
      rcvF.status?.length &&
      !rcvF.status.includes(r.balance > 0 ? 'owing' : 'cleared')
    )
      return false
    return !outOfRange(r.balance, rcvF)
  })
  const payablesFiltered = payables.filter((p) => {
    if (payF.supplier?.length && !payF.supplier.includes(p.supplierId))
      return false
    if (
      payF.status?.length &&
      !payF.status.includes(p.balance > 0 ? 'owing' : 'cleared')
    )
      return false
    return !outOfRange(p.balance, payF)
  })
  // Customer and supplier pickers are alternatives (a row matches either one)
  const matchesParties = (
    row: { customerId: number | null; supplierId: number | null },
    f: { customer?: number[]; supplier?: number[] },
  ) => {
    const byCustomer = f.customer?.length
      ? row.customerId !== null && f.customer.includes(row.customerId)
      : null
    const bySupplier = f.supplier?.length
      ? row.supplierId !== null && f.supplier.includes(row.supplierId)
      : null
    if (byCustomer === null && bySupplier === null) return true
    return Boolean(byCustomer || bySupplier)
  }
  const receiptsFiltered = receipts.filter((r) => {
    if (recF.party?.length && !recF.party.includes(r.partyType)) return false
    if (!matchesParties(r, recF)) return false
    if (
      recF.branch?.length &&
      (r.partyType === 'supplier' ||
        !recF.branch.includes(r.branchId ? String(r.branchId) : DIRECT_BRANCH))
    )
      return false
    if (
      recF.account?.length &&
      !recF.account.includes(
        r.companyBankAccountId ? String(r.companyBankAccountId) : NO_ACCOUNT,
      )
    )
      return false
    const date = String(r.receiptDate).slice(0, 10)
    if (recF.from && date < recF.from) return false
    if (recF.to && date > recF.to) return false
    return !outOfRange(r.amount, recF)
  })
  const paymentsFiltered = payments.filter((p) => {
    if (
      pmtF.party?.length &&
      !(p.partyType !== 'other' && pmtF.party.includes(p.partyType))
    )
      return false
    if (!matchesParties(p, pmtF)) return false
    if (
      pmtF.account?.length &&
      !pmtF.account.includes(
        p.companyBankAccountId ? String(p.companyBankAccountId) : NO_ACCOUNT,
      )
    )
      return false
    const date = String(p.paymentDate).slice(0, 10)
    if (pmtF.from && date < pmtF.from) return false
    if (pmtF.to && date > pmtF.to) return false
    const q = pmtText.trim().toLowerCase()
    if (
      q &&
      !`${p.description ?? ''} ${p.partyName}`
        .toLowerCase()
        .includes(q)
    )
      return false
    return !outOfRange(p.amount, pmtF)
  })
  const receivablesPg = usePagination(
    receivablesFiltered,
    JSON.stringify(rcvF),
  )
  const payablesPg = usePagination(payablesFiltered, JSON.stringify(payF))
  const receiptsPg = usePagination(receiptsFiltered, JSON.stringify(recF))
  const paymentsPg = usePagination(
    paymentsFiltered,
    `${JSON.stringify(pmtF)}|${pmtText}`,
  )

  // Number of filter groups in use on each tab (drives the badge)
  const activeCounts: Record<typeof tab, number> = {
    receivables: [
      rcvF.customer?.length,
      rcvF.branch?.length,
      rcvF.status?.length,
      rcvF.from || rcvF.to,
      hasRange(rcvF),
    ].filter(Boolean).length,
    payables: [
      payF.supplier?.length,
      payF.status?.length,
      payF.from || payF.to,
      hasRange(payF),
    ].filter(Boolean).length,
    receipts: [
      recF.party?.length,
      recF.customer?.length,
      recF.supplier?.length,
      recF.branch?.length,
      recF.account?.length,
      recF.from || recF.to,
      hasRange(recF),
    ].filter(Boolean).length,
    payments: [
      pmtF.party?.length,
      pmtF.customer?.length,
      pmtF.supplier?.length,
      pmtF.account?.length,
      pmtF.from || pmtF.to,
      pmtText.trim(),
      hasRange(pmtF),
    ].filter(Boolean).length,
  }
  const activeCount = activeCounts[tab]
  const tabKey: Record<typeof tab, FilterKey> = {
    receivables: 'rcv',
    payables: 'pay',
    receipts: 'rec',
    payments: 'pmt',
  }
  const resultCount = {
    receivables: receivablesFiltered.length,
    payables: payablesFiltered.length,
    receipts: receiptsFiltered.length,
    payments: paymentsFiltered.length,
  }[tab]
  const [exporting, setExporting] = React.useState(false)
  const handleExportExcel = async () => {
    if (exporting || resultCount === 0) return
    setExporting(true)
    try {
      const mod = await import('#/lib/list-excel.ts')
      if (tab === 'receivables') {
        mod.downloadReceivablesExcel(receivablesFiltered, receivables.length)
        toast.success(`Đã xuất ${receivablesFiltered.length} dòng công nợ phải thu ra file Excel`)
      } else if (tab === 'payables') {
        mod.downloadPayablesExcel(payablesFiltered, payables.length)
        toast.success(`Đã xuất ${payablesFiltered.length} dòng công nợ phải trả ra file Excel`)
      } else if (tab === 'receipts') {
        mod.downloadReceiptsExcel(receiptsFiltered, receipts.length)
        toast.success(`Đã xuất ${receiptsFiltered.length} phiếu thu ra file Excel`)
      } else {
        mod.downloadPaymentsExcel(paymentsFiltered, payments.length)
        toast.success(`Đã xuất ${paymentsFiltered.length} phiếu chi ra file Excel`)
      }
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể xuất Excel')
    } finally {
      setExporting(false)
    }
  }
  const { data: customers } = useSuspenseQuery(customerOptionsQuery())
  const { data: master } = useSuspenseQuery(masterDataQuery())
  const queryClient = useQueryClient()
  // Phiếu thu/chi đổi công nợ, sao kê và dashboard nên làm mới toàn bộ cache
  // One mutation for both create and edit: an id means edit
  const createReceipt = useMutation({
    mutationFn: async (v: { id?: number } & Record<string, unknown>) => {
      if (v.id) await updateReceiptVoucherFn({ data: v as never })
      else await createReceiptVoucherFn({ data: v as never })
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const createPayment = useMutation({
    mutationFn: async (v: { id?: number } & Record<string, unknown>) => {
      if (v.id) await updatePaymentVoucherFn({ data: v as never })
      else await createPaymentVoucherFn({ data: v as never })
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const { isBusy, setBusy } = useBusyKeys()
  const [editReceiptId, setEditReceiptId] = React.useState<number | null>(null)
  const [editPaymentId, setEditPaymentId] = React.useState<number | null>(null)

  // Receipt Voucher modal
  const [receiptOpen, setReceiptOpen] = React.useState(false)
  const [receiptDate, setReceiptDate] = React.useState(todayIso())
  // Who pays: a customer (default) or a supplier refunding a returned vehicle
  const [receiptParty, setReceiptParty] = React.useState<
    'customer' | 'supplier'
  >('customer')
  const [receiptSupplierId, setReceiptSupplierId] = React.useState<number>(
    master.suppliers[0]?.id ?? 0,
  )
  const [receiptCustomerId, setReceiptCustomerId] = React.useState<number>(
    customers[0]?.id ?? 1,
  )
  const [receiptBranchId, setReceiptBranchId] = React.useState<number | null>(
    null,
  )
  const [receiptAmount, setReceiptAmount] = React.useState(50_000_000)
  const [receiptStatement, setReceiptStatement] = React.useState(false)
  const [receiptNote, setReceiptNote] = React.useState('')
  const [debtView, setDebtView] = React.useState<DebtView | null>(null)
  const [receiptAccountId, setReceiptAccountId] = React.useState<number | null>(
    master.bankAccounts.find((a) => a.isActive)?.id ?? null,
  )

  // Payment Voucher modal
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [paymentDate, setPaymentDate] = React.useState(todayIso())
  // Who is paid: a supplier (default) or a customer refunded for a returned vehicle
  const [paymentParty, setPaymentParty] = React.useState<
    'supplier' | 'customer'
  >('supplier')
  const [paymentCustomerId, setPaymentCustomerId] = React.useState<number>(
    customers[0]?.id ?? 1,
  )
  const [paymentBranchId, setPaymentBranchId] = React.useState<number | null>(
    null,
  )
  const [paymentSupplierId, setPaymentSupplierId] = React.useState<number>(
    master.suppliers[0]?.id ?? 1,
  )
  const [paymentAmount, setPaymentAmount] = React.useState(100_000_000)
  const [paymentAccountId, setPaymentAccountId] = React.useState<number | null>(
    master.bankAccounts.find((a) => a.isActive)?.id ?? null,
  )
  const [paymentDesc, setPaymentDesc] = React.useState('')
  const [paymentStatement, setPaymentStatement] = React.useState(false)

  // Filter dropdown options: every customer / branch / supplier / account
  const customerOptions = customers.map((c) => [c.id, c.name] as const)
  const filterBranchOptions = [
    [DIRECT_BRANCH, 'Trực tiếp'] as const,
    ...customers.flatMap((c) =>
      c.branches.map((b) => [String(b.id), `${b.name} (${c.name})`] as const),
    ),
  ]
  const supplierOptions = master.suppliers.map((s) => [s.id, s.name] as const)
  const accountOptions = [
    ...master.bankAccounts.map((a) => ({
      id: String(a.id),
      name: a.bankName,
      image: a.bankImage,
      label: `${a.bankName} (${a.accountNumber})`,
      keywords: `${a.accountNumber} ${a.bankCode ?? ''} ${a.bankShortName ?? ''}`,
    })),
    {
      id: NO_ACCOUNT,
      name: '',
      image: null,
      label: '(Không ghi tài khoản)',
      keywords: '',
    },
  ]

  const selectedCustomer = customers.find((c) => c.id === receiptCustomerId)
  const branchOptions = selectedCustomer?.branches ?? []
  const paymentBranchOptions =
    customers.find((c) => c.id === paymentCustomerId)?.branches ?? []

  const openEditReceipt = (r: (typeof receipts)[number]) => {
    setEditReceiptId(r.id)
    setReceiptDate(r.receiptDate)
    setReceiptParty(r.partyType === 'supplier' ? 'supplier' : 'customer')
    setReceiptCustomerId(r.customerId ?? customers[0]?.id ?? 1)
    setReceiptSupplierId(r.supplierId ?? master.suppliers[0]?.id ?? 0)
    setReceiptBranchId(r.branchId)
    setReceiptAmount(r.amount)
    setReceiptAccountId(r.companyBankAccountId)
    setReceiptNote(r.note ?? '')
    setReceiptOpen(true)
  }
  const openEditPayment = (p: (typeof payments)[number]) => {
    setEditPaymentId(p.id)
    setPaymentDate(p.paymentDate)
    setPaymentParty(p.payeeType === 'customer' ? 'customer' : 'supplier')
    setPaymentSupplierId(p.supplierId ?? master.suppliers[0]?.id ?? 0)
    setPaymentCustomerId(p.customerId ?? customers[0]?.id ?? 1)
    setPaymentBranchId(p.branchId)
    setPaymentAmount(p.amount)
    setPaymentAccountId(p.companyBankAccountId)
    setPaymentDesc(p.description ?? '')
    setPaymentOpen(true)
  }

  const deleteReceipt = useMutation({
    mutationFn: deleteReceiptVoucherFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const deletePayment = useMutation({
    mutationFn: deletePaymentVoucherFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const handleDeleteVoucher = async (
    kind: 'receipt' | 'payment',
    id: number,
    label: string,
  ) => {
    const ok = await confirmDialog({
      title: kind === 'receipt' ? 'Xóa phiếu thu này?' : 'Xóa phiếu chi này?',
      description: `${label}. Công nợ sẽ được tính lại.`,
      confirmLabel: 'Xóa',
      destructive: true,
    })
    if (!ok) return
    const key = `${kind}:${id}`
    setBusy(key, true)
    try {
      if (kind === 'receipt') await deleteReceipt.mutateAsync({ data: { id } })
      else await deletePayment.mutateAsync({ data: { id } })
    } catch (err: unknown) {
      await showErrorDialog(err, 'Không thể xóa phiếu')
    } finally {
      setBusy(key, false)
    }
  }

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createReceipt.mutateAsync({
        id: editReceiptId ?? undefined,
        receiptDate,
        partyType: receiptParty,
        customerId: receiptParty === 'customer' ? receiptCustomerId : null,
        supplierId: receiptParty === 'supplier' ? receiptSupplierId : null,
        branchId: receiptParty === 'customer' ? receiptBranchId : null,
        amount: receiptAmount,
        companyBankAccountId: receiptAccountId,
        note: receiptNote.trim() || null,
        createStatementLine:
          !editReceiptId && !!receiptAccountId && receiptStatement,
      })
      setReceiptOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi tạo phiếu thu')
    }
  }

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createPayment.mutateAsync({
        id: editPaymentId ?? undefined,
        paymentDate,
        payeeType: paymentParty,
        supplierId: paymentParty === 'supplier' ? paymentSupplierId : null,
        customerId: paymentParty === 'customer' ? paymentCustomerId : null,
        branchId: paymentParty === 'customer' ? paymentBranchId : null,
        amount: paymentAmount,
        companyBankAccountId: paymentAccountId,
        description: paymentDesc,
        createStatementLine:
          !editPaymentId && !!paymentAccountId && paymentStatement,
      })
      setPaymentOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi tạo phiếu chi')
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Quản Lý Thu Chi & Công Nợ
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Công nợ phải thu (AR) theo từng{' '}
              <strong>Pháp nhân điểm bán nhận xe</strong> &bull; Công nợ phải
              trả (AP) theo Nhà cung cấp lô hàng.
            </p>
          </div>

          <Can permission="finance.manage">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setEditReceiptId(null)
                  setReceiptParty('customer')
                  setReceiptNote('')
                  setReceiptOpen(true)
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
              >
                <Plus className="size-4" />
                Lập Phiếu Thu Tiền
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditPaymentId(null)
                  setPaymentParty('supplier')
                  setPaymentBranchId(null)
                  setPaymentDesc('')
                  setPaymentOpen(true)
                }}
                className="border-slate-300 text-slate-800 gap-1.5 shadow-xs"
              >
                <Plus className="size-4" />
                Lập Phiếu Chi
              </Button>
            </div>
          </Can>
        </div>

        {/* Tabbed interface */}
        <Tabs
          value={tab}
          onValueChange={(v) =>
            navigate({
              search: (prev) => ({ ...prev, tab: v as typeof tab }),
              replace: true,
            })
          }
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="receivables" className="text-xs font-semibold">
              Công Nợ Phải Thu ({receivables.length})
            </TabsTrigger>
            <TabsTrigger value="payables" className="text-xs font-semibold">
              Công Nợ Phải Trả ({payables.length})
            </TabsTrigger>
            <TabsTrigger value="receipts" className="text-xs font-semibold">
              Lịch Sử Phiếu Thu ({receipts.length})
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-xs font-semibold">
              Lịch Sử Phiếu Chi ({payments.length})
            </TabsTrigger>
          </TabsList>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const cur =
                    tab === 'receivables'
                      ? rcvF
                      : tab === 'payables'
                        ? payF
                        : {}
                  setDateDraft({
                    from: (cur as { from?: string }).from ?? '',
                    to: (cur as { to?: string }).to ?? '',
                  })
                  setShowFilters(true)
                }}
                aria-haspopup="dialog"
                className={`gap-1.5 ${activeCount > 0 ? 'border-emerald-600 text-emerald-800' : ''}`}
              >
                <SlidersHorizontal className="size-4" />
                Bộ lọc
                {activeCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-emerald-700 text-white text-[11px] px-1.5">
                    {activeCount}
                  </span>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleExportExcel()}
                disabled={exporting || resultCount === 0}
                title={`Xuất ${resultCount} dòng theo bộ lọc hiện tại`}
                className="gap-1.5"
              >
                {exporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {exporting ? 'Đang xuất...' : 'Xuất Excel'}
              </Button>
            </div>
          </div>

          {/* Tab 1: Accounts Receivable */}
          <TabsContent value="receivables">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Công Nợ Phải Thu Theo Pháp Nhân Nhận Xe
                </CardTitle>
                <CardDescription className="text-xs">
                  Ghi nhận nợ gắn liền với từng điểm bán
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
<TableHead className="w-12 text-center">STT</TableHead>
                      <TableHead>Khách Hàng</TableHead>
                      <TableHead>Điểm Bán</TableHead>
                      <TableHead className="text-right">Tổng Mua Xe</TableHead>
                      <TableHead className="text-right">
                        Đã Thanh Toán
                      </TableHead>
                      <TableHead className="text-right">
                        Dư Nợ Còn Lại
                      </TableHead>
                      <TableHead className="w-20 text-center">Đơn bán</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {receivablesPg.pageItems.map((r, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/80">
<TableCell className="text-center text-muted-foreground">{receivablesPg.pageSize * (receivablesPg.page - 1) + idx + 1}</TableCell>
                        <TableCell className="font-medium text-slate-900">
                          <Link
                            to="/customers/$customerId"
                            params={{ customerId: String(r.customerId) }}
                            preload="intent"
                            className="hover:text-emerald-700 hover:underline"
                          >
                            {r.customerName}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium text-emerald-900">
                          {r.branchId ? r.entityName : 'Pháp nhân chính KH mẹ'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900">
                          {formatVnd(r.sold)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-800 font-medium">
                          {formatVnd(r.paid)}
                        </TableCell>
                        <TableCell className="text-right text-rose-900">
                          {formatVnd(r.balance)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDebtView({
                                kind: 'receivable',
                                customerId: r.customerId,
                                branchId: r.branchId,
                                from: rcvF.from,
                                to: rcvF.to,
                                title: `${r.customerName}${r.branchId ? ` · ${r.entityName}` : ' · Trực tiếp'}`,
                              })
                            }
                            className="size-7 text-slate-400 hover:text-emerald-700"
                            aria-label="Xem các đơn bán"
                            title="Xem các đơn bán"
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={receivablesPg} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Accounts Payable */}
          <TabsContent value="payables">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Công Nợ Phải Trả Cho Nhà Cung Cấp Xe
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
<TableHead className="w-12 text-center">STT</TableHead>
                      <TableHead>Nhà Cung Cấp</TableHead>
                      <TableHead className="text-right">
                        Tổng Tiền Hàng
                      </TableHead>
                      <TableHead className="text-right">
                        Đã Thanh Toán
                      </TableHead>
                      <TableHead className="text-right">Còn Nợ NCC</TableHead>
                      <TableHead className="w-20 text-center">Đơn nhập</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {payablesPg.pageItems.map((p, rowIdx) => (
                      <TableRow
                        key={p.supplierId}
                        className="hover:bg-slate-50/80"
                      >
<TableCell className="text-center text-muted-foreground">{payablesPg.pageSize * (payablesPg.page - 1) + rowIdx + 1}</TableCell>
                        <TableCell className="font-medium text-slate-900">
                          <SupplierLink supplierId={p.supplierId} className="hover:text-emerald-700 hover:underline">
                            {p.supplierName}
                          </SupplierLink>
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900">
                          {formatVnd(p.purchased)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-800 font-medium">
                          {formatVnd(p.paid)}
                        </TableCell>
                        <TableCell className="text-right text-rose-900">
                          {formatVnd(p.balance)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDebtView({
                                kind: 'payable',
                                supplierId: p.supplierId,
                                from: payF.from,
                                to: payF.to,
                                title: p.supplierName,
                              })
                            }
                            className="size-7 text-slate-400 hover:text-emerald-700"
                            aria-label="Xem các đơn nhập lô"
                            title="Xem các đơn nhập lô"
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={payablesPg} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Receipt Vouchers */}
          <TabsContent value="receipts">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Lịch Sử Phiếu Thu ({receiptsFiltered.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
<TableHead className="w-12 text-center">STT</TableHead>
                      <TableHead>Ngày Thu</TableHead>
                      <TableHead>Đối Tượng</TableHead>
                      <TableHead>Đối Tượng Phụ</TableHead>
                      <TableHead className="text-right">Số Tiền Thu</TableHead>
                      <TableHead>Tài Khoản Nhận</TableHead>
                      <TableHead>Ghi Chú</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {receiptsPg.pageItems.map((r, rowIdx) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/80">
<TableCell className="text-center text-muted-foreground">{receiptsPg.pageSize * (receiptsPg.page - 1) + rowIdx + 1}</TableCell>
                        <TableCell className="text-slate-500">
                          {formatDate(r.receiptDate)}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {r.partyType === 'supplier' && r.supplierId ? (
                            <>
                              <SupplierLink
                                supplierId={r.supplierId}
                                className="hover:text-emerald-700 hover:underline"
                              >
                                {r.partyName}
                              </SupplierLink>
                              <span className="ml-1 font-normal text-slate-500">
                                (NCC)
                              </span>
                            </>
                          ) : (
                            <>
                              <Link
                                to="/customers/$customerId"
                                params={{ customerId: String(r.customerId) }}
                                preload="intent"
                                className="hover:text-emerald-700 hover:underline"
                              >
                                {r.partyName}
                              </Link>
                              <span className="ml-1 font-normal text-slate-500">
                                (KH)
                              </span>
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-900">
                          {r.subName ?? '—'}
                        </TableCell>
                        <TableCell className="text-right text-emerald-900">
                          {formatVnd(r.amount)}
                        </TableCell>
                        <TableCell className="text-slate-700 text-xs">
                          {r.accountNumber ? (
                            <div title={`${r.bankName} - ${r.accountNumber}`}>
                              <BankLabel image={r.bankImage} name={r.bankName}>
                                {r.accountNumber}
                              </BankLabel>
                            </div>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell
                          className="max-w-[200px] truncate text-slate-500"
                          title={r.note ?? undefined}
                        >
                          {r.note || '—'}
                        </TableCell>
                        <TableCell>
                          <Can permission="finance.manage">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditReceipt(r)}
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                                title="Sửa"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isBusy(`receipt:${r.id}`)}
                                onClick={() =>
                                  handleDeleteVoucher(
                                    'receipt',
                                    r.id,
                                    `${r.partyName} — ${formatVnd(r.amount)}`,
                                  )
                                }
                                className="size-7 text-slate-400 hover:text-rose-600"
                                aria-label="Xóa"
                                title="Xóa"
                              >
                                <BusyTrash busy={isBusy(`receipt:${r.id}`)} />
                              </Button>
                            </div>
                          </Can>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={receiptsPg} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Payment Vouchers */}
          <TabsContent value="payments">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Lịch Sử Phiếu Chi ({paymentsFiltered.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
<TableHead className="w-12 text-center">STT</TableHead>
                      <TableHead>Ngày Chi</TableHead>
                      <TableHead>Đối Tượng</TableHead>
                      <TableHead>Đối Tượng Phụ</TableHead>
                      <TableHead className="text-right">Số Tiền Chi</TableHead>
                      <TableHead>Ghi Chú</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {paymentsPg.pageItems.map((p, rowIdx) => (
                      <TableRow key={p.id} className="hover:bg-slate-50/80">
<TableCell className="text-center text-muted-foreground">{paymentsPg.pageSize * (paymentsPg.page - 1) + rowIdx + 1}</TableCell>
                        <TableCell className="text-slate-500">
                          {formatDate(p.paymentDate)}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {p.partyType === 'customer' && p.customerId ? (
                            <>
                              <Link
                                to="/customers/$customerId"
                                params={{ customerId: String(p.customerId) }}
                                preload="intent"
                                className="hover:text-emerald-700 hover:underline"
                              >
                                {p.partyName}
                              </Link>
                              <span className="ml-1 font-normal text-slate-500">
                                (KH)
                              </span>
                            </>
                          ) : p.supplierId && p.supplierName ? (
                            <>
                              <SupplierLink
                                supplierId={p.supplierId}
                                className="hover:text-emerald-700 hover:underline"
                              >
                                {p.supplierName}
                              </SupplierLink>
                              <span className="ml-1 font-normal text-slate-500">
                                (NCC)
                              </span>
                            </>
                          ) : (
                            p.partyName
                          )}
                        </TableCell>
                        <TableCell className="text-slate-900">
                          {p.subName ?? '—'}
                        </TableCell>
                        <TableCell className="text-right text-rose-900">
                          {formatVnd(p.amount)}
                        </TableCell>
                        <TableCell className="text-slate-500 text-[11px]">
                          {p.description ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Can permission="finance.manage">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={p.payeeType === 'other'}
                                onClick={() => openEditPayment(p)}
                                className="size-7 text-slate-400 hover:text-emerald-700"
                                aria-label="Sửa"
                                title="Sửa"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isBusy(`payment:${p.id}`)}
                                onClick={() =>
                                  handleDeleteVoucher(
                                    'payment',
                                    p.id,
                                    `${p.partyName} — ${formatVnd(p.amount)}`,
                                  )
                                }
                                className="size-7 text-slate-400 hover:text-rose-600"
                                aria-label="Xóa"
                                title="Xóa"
                              >
                                <BusyTrash busy={isBusy(`payment:${p.id}`)} />
                              </Button>
                            </div>
                          </Can>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination pagination={paymentsPg} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Filter dialog: shows the fields of the active tab */}
        <Dialog open={showFilters} onOpenChange={setShowFilters}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {
                  {
                    receivables: 'Bộ Lọc Công Nợ Phải Thu',
                    payables: 'Bộ Lọc Công Nợ Phải Trả',
                    receipts: 'Bộ Lọc Phiếu Thu',
                    payments: 'Bộ Lọc Phiếu Chi',
                  }[tab]
                }
              </DialogTitle>
              <DialogDescription className="text-xs">
                Kết quả được lọc ngay khi thay đổi ({resultCount} dòng phù hợp)
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tab === 'receivables' && (
                <>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Khách hàng</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả khách hàng"
                      values={(rcvF.customer ?? []).map(String)}
                      onValuesChange={(v) =>
                        setTabFilter('rcv', { customer: v.map(Number) })
                      }
                    >
                      {customerOptions.map(([id, name]) => (
                        <SearchSelectItem
                          key={id}
                          value={String(id)}
                         
                        >
                          {name}
                        </SearchSelectItem>
                      ))}
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">
                      Pháp nhân điểm bán chịu nợ
                    </Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả pháp nhân"
                      values={rcvF.branch ?? []}
                      onValuesChange={(v) => setTabFilter('rcv', { branch: v })}
                    >
                      {filterBranchOptions.map(([id, name]) => (
                        <SearchSelectItem
                          key={id}
                          value={id}
                         
                        >
                          {name}
                        </SearchSelectItem>
                      ))}
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Tình trạng nợ</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả"
                      values={rcvF.status ?? []}
                      onValuesChange={(v) => setTabFilter('rcv', { status: v })}
                    >
                      <SearchSelectItem value="owing">
                        Còn nợ
                      </SearchSelectItem>
                      <SearchSelectItem value="cleared">
                        Đã thanh toán đủ
                      </SearchSelectItem>
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Đơn bán từ ngày
                    </Label>
                    <Input
                      type="date"
                      value={dateDraft.from}
                      onChange={(e) =>
                        setDateDraft((d) => ({ ...d, from: e.target.value }))
                      }
                      className="h-11 text-sm px-4 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Đơn bán đến ngày
                    </Label>
                    <Input
                      type="date"
                      value={dateDraft.to}
                      onChange={(e) =>
                        setDateDraft((d) => ({ ...d, to: e.target.value }))
                      }
                      className="h-11 text-sm px-4 rounded-lg"
                    />
                  </div>
                  <p className="sm:col-span-2 -mt-1 text-[11px] text-slate-500">
                    Khi chọn ngày, Tổng Mua Xe tính theo các đơn bán trong khoảng
                    và Đã Thanh Toán theo các phiếu thu trong khoảng.
                  </p>
                  <div className="sm:col-span-2">
                    <PriceRangeFilter
                      label="Dư nợ còn lại"
                      min={rcvF.min}
                      max={rcvF.max}
                      onChange={(min, max) => setTabFilter('rcv', { min, max })}
                    />
                  </div>
                </>
              )}

              {tab === 'payables' && (
                <>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Nhà cung cấp</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả nhà cung cấp"
                      values={(payF.supplier ?? []).map(String)}
                      onValuesChange={(v) =>
                        setTabFilter('pay', { supplier: v.map(Number) })
                      }
                    >
                      {supplierOptions.map(([id, name]) => (
                        <SearchSelectItem
                          key={id}
                          value={String(id)}
                         
                        >
                          {name}
                        </SearchSelectItem>
                      ))}
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Tình trạng nợ</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả"
                      values={payF.status ?? []}
                      onValuesChange={(v) => setTabFilter('pay', { status: v })}
                    >
                      <SearchSelectItem value="owing">
                        Còn nợ NCC
                      </SearchSelectItem>
                      <SearchSelectItem value="cleared">
                        Đã thanh toán đủ
                      </SearchSelectItem>
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Nhập lô từ ngày
                    </Label>
                    <Input
                      type="date"
                      value={dateDraft.from}
                      onChange={(e) =>
                        setDateDraft((d) => ({ ...d, from: e.target.value }))
                      }
                      className="h-11 text-sm px-4 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Nhập lô đến ngày
                    </Label>
                    <Input
                      type="date"
                      value={dateDraft.to}
                      onChange={(e) =>
                        setDateDraft((d) => ({ ...d, to: e.target.value }))
                      }
                      className="h-11 text-sm px-4 rounded-lg"
                    />
                  </div>
                  <p className="sm:col-span-2 -mt-1 text-[11px] text-slate-500">
                    Khi chọn ngày, Tổng Tiền Hàng tính theo các lô nhập trong
                    khoảng và Đã Thanh Toán theo các phiếu chi trong khoảng.
                  </p>
                  <div className="sm:col-span-2">
                    <PriceRangeFilter
                      label="Còn nợ NCC"
                      min={payF.min}
                      max={payF.max}
                      onChange={(min, max) => setTabFilter('pay', { min, max })}
                    />
                  </div>
                </>
              )}

              {tab === 'receipts' && (
                <>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Loại đối tượng</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Khách hàng & nhà cung cấp"
                      values={recF.party ?? []}
                      onValuesChange={(v) =>
                        setTabFilter('rec', { party: v })
                      }
                    >
                      <SearchSelectItem value="customer">
                        Khách hàng (KH)
                      </SearchSelectItem>
                      <SearchSelectItem value="supplier">
                        Nhà cung cấp (NCC)
                      </SearchSelectItem>
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Khách hàng</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả khách hàng"
                      values={(recF.customer ?? []).map(String)}
                      onValuesChange={(v) =>
                        setTabFilter('rec', { customer: v.map(Number) })
                      }
                    >
                      {customerOptions.map(([id, name]) => (
                        <SearchSelectItem
                          key={id}
                          value={String(id)}
                         
                        >
                          {name}
                        </SearchSelectItem>
                      ))}
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Nhà cung cấp</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả nhà cung cấp"
                      values={(recF.supplier ?? []).map(String)}
                      onValuesChange={(v) =>
                        setTabFilter('rec', { supplier: v.map(Number) })
                      }
                    >
                      {supplierOptions.map(([id, name]) => (
                        <SearchSelectItem key={id} value={String(id)}>
                          {name}
                        </SearchSelectItem>
                      ))}
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">
                      Đối tượng phụ (điểm bán)
                    </Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả điểm bán"
                      values={recF.branch ?? []}
                      onValuesChange={(v) => setTabFilter('rec', { branch: v })}
                    >
                      {filterBranchOptions.map(([id, name]) => (
                        <SearchSelectItem
                          key={id}
                          value={id}
                         
                        >
                          {name}
                        </SearchSelectItem>
                      ))}
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Tài khoản nhận</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả tài khoản"
                      values={recF.account ?? []}
                      onValuesChange={(v) => setTabFilter('rec', { account: v })}
                    >
                      {accountOptions.map((a) => (
                        <SearchSelectItem
                          key={a.id}
                          value={a.id}
                          keywords={a.keywords}
                         
                        >
                          {a.image ? (
                            <BankLabel image={a.image} name={a.name}>
                              {a.label}
                            </BankLabel>
                          ) : (
                            a.label
                          )}
                        </SearchSelectItem>
                      ))}
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Ngày thu từ</Label>
                    <Input
                      type="date"
                      value={recF.from ?? ''}
                      onChange={(e) =>
                        setTabFilter('rec', { from: e.target.value })
                      }
                      className="h-11 text-sm px-4 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Ngày thu đến</Label>
                    <Input
                      type="date"
                      value={recF.to ?? ''}
                      onChange={(e) =>
                        setTabFilter('rec', { to: e.target.value })
                      }
                      className="h-11 text-sm px-4 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <PriceRangeFilter
                      label="Số tiền thu"
                      min={recF.min}
                      max={recF.max}
                      onChange={(min, max) => setTabFilter('rec', { min, max })}
                    />
                  </div>
                </>
              )}

              {tab === 'payments' && (
                <>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">
                      Nội dung / đối tượng nhận
                    </Label>
                    <Input
                      placeholder="Tìm theo nội dung hoặc tên người nhận..."
                      value={pmtText}
                      onChange={(e) => setPmtText(e.target.value)}
                      className="h-11 text-sm px-4 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Loại đối tượng</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Nhà cung cấp & khách hàng"
                      values={pmtF.party ?? []}
                      onValuesChange={(v) =>
                        setTabFilter('pmt', { party: v })
                      }
                    >
                      <SearchSelectItem value="supplier">
                        Nhà cung cấp (NCC)
                      </SearchSelectItem>
                      <SearchSelectItem value="customer">
                        Khách hàng (KH)
                      </SearchSelectItem>
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Nhà cung cấp</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả nhà cung cấp"
                      values={(pmtF.supplier ?? []).map(String)}
                      onValuesChange={(v) =>
                        setTabFilter('pmt', { supplier: v.map(Number) })
                      }
                    >
                      {supplierOptions.map(([id, name]) => (
                        <SearchSelectItem
                          key={id}
                          value={String(id)}
                         
                        >
                          {name}
                        </SearchSelectItem>
                      ))}
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Khách hàng</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả khách hàng"
                      values={(pmtF.customer ?? []).map(String)}
                      onValuesChange={(v) =>
                        setTabFilter('pmt', { customer: v.map(Number) })
                      }
                    >
                      {customerOptions.map(([id, name]) => (
                        <SearchSelectItem key={id} value={String(id)}>
                          {name}
                        </SearchSelectItem>
                      ))}
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Tài khoản chi</Label>
                    <MultiSearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      placeholder="Tất cả tài khoản"
                      values={pmtF.account ?? []}
                      onValuesChange={(v) => setTabFilter('pmt', { account: v })}
                    >
                      {accountOptions.map((a) => (
                        <SearchSelectItem
                          key={a.id}
                          value={a.id}
                          keywords={a.keywords}
                         
                        >
                          {a.image ? (
                            <BankLabel image={a.image} name={a.name}>
                              {a.label}
                            </BankLabel>
                          ) : (
                            a.label
                          )}
                        </SearchSelectItem>
                      ))}
                    </MultiSearchSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Ngày chi từ</Label>
                    <Input
                      type="date"
                      value={pmtF.from ?? ''}
                      onChange={(e) =>
                        setTabFilter('pmt', { from: e.target.value })
                      }
                      className="h-11 text-sm px-4 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Ngày chi đến</Label>
                    <Input
                      type="date"
                      value={pmtF.to ?? ''}
                      onChange={(e) =>
                        setTabFilter('pmt', { to: e.target.value })
                      }
                      className="h-11 text-sm px-4 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <PriceRangeFilter
                      label="Số tiền chi"
                      min={pmtF.min}
                      max={pmtF.max}
                      onChange={(min, max) => setTabFilter('pmt', { min, max })}
                    />
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={activeCount === 0}
                onClick={() => {
                  if (tab === 'payments') setPmtText('')
                  setDateDraft({ from: '', to: '' })
                  clearTabFilter(tabKey[tab])
                }}
                className="h-8 text-xs text-slate-500"
              >
                Xóa lọc
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  // The debt tabs apply their date range now: URL + API call
                  if (tab === 'receivables' || tab === 'payables') {
                    const from = dateDraft.from || undefined
                    const to = dateDraft.to || undefined
                    const cur = tab === 'receivables' ? rcvF : payF
                    if (from !== cur.from || to !== cur.to)
                      setTabFilter(tabKey[tab], { from, to })
                  }
                  setShowFilters(false)
                }}
                className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Xong
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Receipt Voucher Modal */}
        <DebtOrdersDialog view={debtView} onClose={() => setDebtView(null)} />

        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {editReceiptId ? 'Sửa Phiếu Thu' : 'Lập Phiếu Thu Tiền'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {receiptParty === 'customer'
                  ? 'Ghi nhận khách hàng hoặc điểm bán thanh toán công nợ'
                  : 'Nhà cung cấp hoàn tiền (ví dụ trả xe lại cho nhà cung cấp)'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateReceipt} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ngày Thu Tiền *</Label>
                <Input
                  type="date"
                  required
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Thu Từ *</Label>
                <PartyToggle
                  value={receiptParty}
                  onChange={setReceiptParty}
                  options={[
                    ['customer', 'Khách hàng'],
                    ['supplier', 'NCC'],
                  ]}
                />
              </div>

              {receiptParty === 'supplier' ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nhà Cung Cấp *</Label>
                  <SearchSelect
                    className="h-11 w-full text-sm rounded-lg"
                    value={String(receiptSupplierId)}
                    onValueChange={(val) => setReceiptSupplierId(Number(val))}
                  >
                    {master.suppliers.map((sp) => (
                      <SearchSelectItem key={sp.id} value={String(sp.id)}>
                        {sp.name}
                      </SearchSelectItem>
                    ))}
                  </SearchSelect>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Khách Hàng *</Label>
                  <SearchSelect
                    className="h-11 w-full text-sm rounded-lg"
                    value={String(receiptCustomerId)}
                    onValueChange={(val) => {
                      setReceiptCustomerId(Number(val))
                      setReceiptBranchId(null)
                    }}
                  >
                    {customers.map((c) => (
                      <SearchSelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SearchSelectItem>
                    ))}
                  </SearchSelect>
                </div>
              )}

                                          {receiptParty === 'customer' && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Điểm Bán Thanh Toán (Công nợ trừ theo pháp nhân này)
                </Label>
                <SearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  placeholder="Chọn chi nhánh/điểm bán"
                  value={receiptBranchId ? String(receiptBranchId) : 'none'}
                  onValueChange={(val) =>
                    setReceiptBranchId(val === 'none' ? null : Number(val))
                  }
                >
                  <SearchSelectItem value="none">
                    Trực tiếp
                  </SearchSelectItem>
                  {branchOptions.map((b) => (
                    <SearchSelectItem
                      key={b.id}
                      value={String(b.id)}

                    >
                      {b.name}
                    </SearchSelectItem>
                  ))}
                </SearchSelect>
              </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Số Tiền Thu (VNĐ) *
                </Label>
                <MoneyInput
                  required
                  value={receiptAmount}
                  onValueChange={setReceiptAmount}
                  className="h-11 text-sm px-4 rounded-lg"
                />
                {receiptParty === 'supplier' && (
                  <p className="text-[11px] text-slate-500">
                    Tiền hoàn từ nhà cung cấp: chỉ thu được khi công nợ nhà
                    cung cấp đang âm (đã thanh toán dư), tối đa bằng số dư âm.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Tài Khoản Nhận
                  </Label>
                  <BankAccountSelect
                    value={receiptAccountId}
                    onChange={setReceiptAccountId}
                    noneLabel="Không chọn (tiền mặt)"
                  />
                  {receiptAccountId && !editReceiptId && (
                    <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs text-slate-600">
                      <Checkbox
                        checked={receiptStatement}
                        onCheckedChange={(c) => setReceiptStatement(c === true)}
                        className="mt-0.5"
                      />
                      <span>
                        Tạo luôn dòng sao kê và khớp với phiếu thu này
                        <span className="block text-[11px] text-slate-400">
                          Dùng khi chưa nhập sao kê ngân hàng; nếu sau này nhập
                          sao kê, tránh tạo trùng.
                        </span>
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ghi Chú</Label>
                <Textarea
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  placeholder="Không bắt buộc"
                  maxLength={255}
                  rows={2}
                  className="min-h-16 text-sm px-4 rounded-lg"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReceiptOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={createReceipt.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {createReceipt.isPending ? 'Đang lưu...' : 'Lưu Phiếu Thu'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Payment Voucher Modal */}
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {editPaymentId ? 'Sửa Phiếu Chi' : 'Lập Phiếu Chi Tiền'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {paymentParty === 'supplier'
                  ? 'Chi trả tiền hàng cho nhà cung cấp'
                  : 'Hoàn tiền cho khách hàng (ví dụ khách trả xe lại)'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreatePayment} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ngày Chi Tiền *</Label>
                <Input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Chi Cho *</Label>
                <PartyToggle
                  value={paymentParty}
                  onChange={setPaymentParty}
                  options={[
                    ['customer', 'Khách hàng'],
                    ['supplier', 'NCC'],
                  ]}
                />
              </div>

              {paymentParty === 'supplier' ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Nhà Cung Cấp Thụ Hưởng *
                  </Label>
                  <SearchSelect
                    className="h-11 w-full text-sm rounded-lg"
                    value={String(paymentSupplierId)}
                    onValueChange={(val) => setPaymentSupplierId(Number(val))}
                  >
                    {master.suppliers.map((sp) => (
                      <SearchSelectItem key={sp.id} value={String(sp.id)}>
                        {sp.name}
                      </SearchSelectItem>
                    ))}
                  </SearchSelect>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Khách Hàng Nhận Tiền *
                    </Label>
                    <SearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      value={String(paymentCustomerId)}
                      onValueChange={(val) => {
                        setPaymentCustomerId(Number(val))
                        setPaymentBranchId(null)
                      }}
                    >
                      {customers.map((c) => (
                        <SearchSelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SearchSelectItem>
                      ))}
                    </SearchSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Điểm Bán (Công nợ cộng lại theo pháp nhân này)
                    </Label>
                    <SearchSelect
                      className="h-11 w-full text-sm rounded-lg"
                      value={paymentBranchId ? String(paymentBranchId) : 'none'}
                      onValueChange={(val) =>
                        setPaymentBranchId(val === 'none' ? null : Number(val))
                      }
                    >
                      <SearchSelectItem value="none">Trực tiếp</SearchSelectItem>
                      {paymentBranchOptions.map((b) => (
                        <SearchSelectItem key={b.id} value={String(b.id)}>
                          {b.name}
                        </SearchSelectItem>
                      ))}
                    </SearchSelect>
                  </div>
                </>
              )}

                                          <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Số Tiền Chi (VNĐ) *
                </Label>
                <MoneyInput
                  required
                  value={paymentAmount}
                  onValueChange={setPaymentAmount}
                  className="h-11 text-sm px-4 rounded-lg"
                />
                {paymentParty === 'customer' && (
                  <p className="text-[11px] text-slate-500">
                    Tiền hoàn cho khách hàng: chỉ chi được khi công nợ của
                    khách đang âm (đã thanh toán dư), tối đa bằng số dư âm.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tài Khoản Chi</Label>
                <BankAccountSelect
                  value={paymentAccountId}
                  onChange={setPaymentAccountId}
                  noneLabel="Không chọn (tiền mặt)"
                />
                {paymentAccountId && !editPaymentId && (
                  <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs text-slate-600">
                    <Checkbox
                      checked={paymentStatement}
                      onCheckedChange={(c) => setPaymentStatement(c === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Tạo luôn dòng sao kê và khớp với phiếu chi này
                      <span className="block text-[11px] text-slate-400">
                        Dùng khi chưa nhập sao kê ngân hàng; nếu sau này nhập
                        sao kê, tránh tạo trùng.
                      </span>
                    </span>
                  </label>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ghi Chú</Label>
                <Textarea
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  placeholder="Không bắt buộc"
                  maxLength={255}
                  rows={2}
                  className="h-11 min-h-16 text-sm px-4 rounded-lg"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={createPayment.isPending}
                  size="sm"
                  className="h-8 text-xs bg-rose-700 hover:bg-rose-800 text-white font-semibold"
                >
                  {createPayment.isPending ? 'Đang lưu...' : 'Lưu Phiếu Chi'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
