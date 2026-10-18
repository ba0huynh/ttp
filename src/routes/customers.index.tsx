import { BusyTrash } from '#/components/ui/busy-trash.tsx'
import { confirmDelete, reportDeleteFailure } from '#/lib/usage.ts'
import { useBusyKeys } from '#/lib/use-busy.ts'
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
  Eye,
  Pencil,
  Plus,
  SlidersHorizontal,
} from 'lucide-react'
import * as React from 'react'
import { z } from 'zod'

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
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { MultiSearchSelect } from '#/components/ui/multi-search-select.tsx'
import { PriceRangeFilter } from '#/components/ui/price-range-filter.tsx'
import {
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
import { useUrlText } from '#/lib/use-url-text.ts'
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
import { formatVnd } from '#/lib/business.ts'
import { customersQuery, currentUserQuery } from '#/lib/queries.ts'
import { requirePagePermission } from '#/lib/route-guard.ts'
import { deleteCustomerFn, saveCustomerFn } from '#/server/fns/customers.ts'

const SORT_KEYS = ['name', 'branches', 'balance'] as const
type SortKey = (typeof SORT_KEYS)[number]
const SORT_LABELS: Record<SortKey, string> = {
  name: 'Tên khách hàng',
  branches: 'Số điểm bán',
  balance: 'Còn nợ',
}
const SORT_VALUE: Record<
  SortKey,
  (c: { name: string; branchCount: number; balance: number }) => number | string
> = {
  name: (c) => c.name,
  branches: (c) => c.branchCount,
  balance: (c) => c.balance,
}
const DEBT = ['owing', 'zero', 'overpaid'] as const
const DEBT_LABELS = {
  owing: 'Còn nợ',
  zero: 'Không nợ',
  overpaid: 'Trả dư (số âm)',
} as const

export const Route = createFileRoute('/customers/')({
  // Filters and sort live in the URL so a reload or shared link keeps them
  validateSearch: z.object({
    q: z.string().optional().catch(undefined),
    debt: z.array(z.enum(DEBT)).optional().catch(undefined),
    min: z.number().optional().catch(undefined),
    max: z.number().optional().catch(undefined),
    sort: z.enum(SORT_KEYS).optional().catch(undefined),
    dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.query(currentUserQuery())
    if (!user) throw redirect({ to: '/login' })
    requirePagePermission(user, 'customers.view')
    return { user }
  },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.query(customersQuery())
  },
  component: CustomersPage,
})

function CustomersPage() {
  const { user } = Route.useRouteContext()
  const { data: customers } = useSuspenseQuery(customersQuery())
  const queryClient = useQueryClient()

  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()
  const [showFilters, setShowFilters] = React.useState(false)
  const { debt, min, max, sort, dir } = searchParams
  // The box filters instantly; the URL follows once typing pauses
  const [nameSearch, setNameSearch] = useUrlText(searchParams.q ?? '', (q) =>
    navigate({
      search: (prev) => ({ ...prev, q: q || undefined }),
      replace: true,
    }),
  )
  const activeFilterCount = [
    Boolean(nameSearch.trim()),
    Boolean(debt?.length),
    min !== undefined || max !== undefined,
  ].filter(Boolean).length

  const filtered = customers.filter((c) => {
    const q = nameSearch.trim().toLowerCase()
    if (q && !c.name.toLowerCase().includes(q)) return false
    if (
      debt?.length &&
      !debt.includes(c.balance > 0 ? 'owing' : c.balance < 0 ? 'overpaid' : 'zero')
    )
      return false
    if (min !== undefined && c.balance < min) return false
    if (max !== undefined && c.balance > max) return false
    return true
  })
  // No sort chosen keeps the server order
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
  const customersPg = usePagination(
    sorted,
    `${nameSearch}|${debt?.join()}|${min}|${max}|${sort}|${dir}`,
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
        className={`inline-flex items-center gap-1 font-[inherit] uppercase hover:text-slate-900 ${sort === key ? 'text-emerald-800' : ''}`}
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

  // Create Parent Customer Modal
  const [newCustOpen, setNewCustOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [editId, setEditId] = React.useState<number | null>(null)
  const { isBusy, setBusy } = useBusyKeys()

  // Mọi thay đổi khách hàng/điểm bán ảnh hưởng danh sách, chi tiết và công nợ
  const saveCustomer = useMutation({
    mutationFn: saveCustomerFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const deleteCustomer = useMutation({
    mutationFn: deleteCustomerFn,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const handleDelete = async (c: { id: number; name: string }) => {
    const key = `customers:${c.id}`
    const ok = await confirmDelete(
      { entity: 'customers', id: c.id, name: c.name },
      {
        title: `Xóa khách hàng "${c.name}"?`,
        description:
          'Các điểm bán của khách hàng cũng bị xóa. Không thể hoàn tác.',
      },
      (checking) => setBusy(key, checking),
    )
    if (!ok) return
    setBusy(key, true)
    try {
      await deleteCustomer.mutateAsync({ data: { id: c.id } })
    } catch (err: unknown) {
      await reportDeleteFailure(
        err,
        { entity: 'customers', id: c.id, name: c.name },
        'Không thể xóa khách hàng',
      )
    } finally {
      setBusy(key, false)
    }
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveCustomer.mutateAsync({
        data: {
          id: editId ?? undefined,
          name,
        },
      })
      setNewCustOpen(false)
    } catch (err: unknown) {
      await showErrorDialog(err, 'Lỗi khi lưu khách hàng')
    }
  }

  return (
    <AppLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Khách Hàng & Điểm Bán
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Doanh thu tính theo <strong>khách hàng</strong> &bull; Hóa đơn và
              công nợ ghi theo <strong>điểm bán</strong> nhận xe.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            <Can permission="customers.manage">
              <Button
                size="sm"
                onClick={() => {
                  setEditId(null)
                  setName('')
                  setNewCustOpen(true)
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-xs"
              >
                <Plus className="size-4" />
                Thêm Khách Hàng
              </Button>
            </Can>
          </div>
        </div>

        {/* Customers Table */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">
              Danh Sách Khách Hàng ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-slate-50/70">
                    {sortHead('name', 'Tên Khách Hàng', '')}
                    {sortHead('branches', 'Số Điểm Bán', 'text-center')}
                    {sortHead('balance', 'Còn Nợ', 'text-right')}
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {customersPg.pageItems.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {c.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold"
                        >
                          {c.branchCount} điểm bán
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-rose-900">
                        {formatVnd(c.balance)}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="size-7 text-slate-400 hover:text-emerald-700"
                        >
                          <Link
                            to="/customers/$customerId"
                            params={{ customerId: String(c.id) }}
                            preload="intent"
                            aria-label="Xem chi tiết"
                            title="Xem chi tiết"
                          >
                            <Eye className="size-3.5" />
                          </Link>
                        </Button>
                        <Can permission="customers.manage">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditId(c.id)
                              setName(c.name)
                              setNewCustOpen(true)
                            }}
                            className="size-7 text-slate-400 hover:text-emerald-700"
                            aria-label="Sửa"
                            title="Sửa"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(c)}
                            disabled={isBusy(`customers:${c.id}`)}
                            className="size-7 text-slate-400 hover:text-rose-600"
                            aria-label="Xóa"
                            title="Xóa"
                          >
                            <BusyTrash busy={isBusy(`customers:${c.id}`)} />
                          </Button>
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination pagination={customersPg} />
          </CardContent>
        </Card>

        {/* Filter + sort dialog */}
        <Dialog open={showFilters} onOpenChange={setShowFilters}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Bộ Lọc Khách Hàng
              </DialogTitle>
              <DialogDescription className="text-xs">
                Kết quả được lọc ngay khi thay đổi ({filtered.length} khách
                hàng phù hợp)
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Sắp xếp theo</Label>
                <SearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  placeholder="Mặc định"
                  value={sort ?? 'default'}
                  onValueChange={(val) =>
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        sort: val === 'default' ? undefined : (val as SortKey),
                        dir:
                          val === 'default' ? undefined : (prev.dir ?? 'desc'),
                      }),
                      replace: true,
                    })
                  }
                >
                  <SearchSelectItem value="default" className="text-xs">
                    Mặc định
                  </SearchSelectItem>
                  {SORT_KEYS.map((k) => (
                    <SearchSelectItem key={k} value={k} className="text-xs">
                      {SORT_LABELS[k]}
                    </SearchSelectItem>
                  ))}
                </SearchSelect>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Thứ tự</Label>
                <SearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  value={dir ?? 'desc'}
                  disabled={!sort}
                  onValueChange={(val) =>
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        dir: val as 'asc' | 'desc',
                      }),
                      replace: true,
                    })
                  }
                >
                  <SearchSelectItem value="asc" className="text-xs">
                    Tăng dần (A → Z, thấp → cao)
                  </SearchSelectItem>
                  <SearchSelectItem value="desc" className="text-xs">
                    Giảm dần (Z → A, cao → thấp)
                  </SearchSelectItem>
                </SearchSelect>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Tên khách hàng</Label>
                <Input
                  placeholder="Tìm theo tên khách hàng..."
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Tình trạng công nợ</Label>
                <MultiSearchSelect
                  className="h-11 w-full text-sm rounded-lg"
                  placeholder="Tất cả"
                  values={debt ?? []}
                  onValuesChange={(v) =>
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        debt: v.length ? (v as (typeof DEBT)[number][]) : undefined,
                      }),
                      replace: true,
                    })
                  }
                >
                  {DEBT.map((k) => (
                    <SearchSelectItem key={k} value={k} className="text-xs">
                      {DEBT_LABELS[k]}
                    </SearchSelectItem>
                  ))}
                </MultiSearchSelect>
              </div>
              <div className="sm:col-span-2">
                <PriceRangeFilter
                  label="Số tiền còn nợ"
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
                  setNameSearch('')
                  navigate({
                    search: (prev) => ({ sort: prev.sort, dir: prev.dir }),
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
                className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Xong
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Parent Customer Modal */}
        <Dialog open={newCustOpen} onOpenChange={setNewCustOpen}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {editId ? 'Sửa Khách Hàng' : 'Thêm Khách Hàng Mới'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateCustomer} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Tên Khách Hàng *
                </Label>
                <Input
                  required
                  placeholder="CÔNG TY TNHH..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 text-sm px-4 rounded-lg"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewCustOpen(false)}
                  className="h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={saveCustomer.isPending}
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {saveCustomer.isPending ? 'Đang lưu...' : 'Lưu Khách Hàng'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
