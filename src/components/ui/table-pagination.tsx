import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'

import { Button } from '#/components/ui/button.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

export interface Pagination<T> {
  /** Rows of the current page */
  pageItems: T[]
  /** 1-based current page (already clamped to the available pages) */
  page: number
  pageSize: number
  pageCount: number
  total: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

/**
 * Client-side pagination (every list is already fully loaded).
 * `resetKey` sends the table back to page 1 when it changes (filters, search).
 */
export function usePagination<T>(
  items: readonly T[],
  resetKey?: unknown,
): Pagination<T> {
  const [pageSize, setPageSizeState] = React.useState<number>(10)
  const [state, setState] = React.useState({ page: 1, key: resetKey })

  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // A changed key, or a list that shrank, must never leave us on a missing page
  const requested = Object.is(state.key, resetKey) ? state.page : 1
  const page = Math.min(Math.max(requested, 1), pageCount)

  const start = (page - 1) * pageSize
  return {
    pageItems: items.slice(start, start + pageSize),
    page,
    pageSize,
    pageCount,
    total,
    setPage: (p) => setState({ page: p, key: resetKey }),
    setPageSize: (size) => {
      setPageSizeState(size)
      setState({ page: 1, key: resetKey })
    },
  }
}

/** Page numbers with "…" gaps, e.g. 1 … 4 5 [6] 7 8 … 20 */
function pageNumbers(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const wanted = new Set([1, pageCount, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((n) => wanted.add(n))
  if (page >= pageCount - 2)
    [pageCount - 3, pageCount - 2, pageCount - 1].forEach((n) => wanted.add(n))
  const sorted = [...wanted]
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('gap')
    out.push(n)
  })
  return out
}

/** Footer for a table: range, rows-per-page select and page buttons */
export function TablePagination<T>({
  pagination: p,
  className = '',
}: {
  pagination: Pagination<T>
  className?: string
}) {
  // Nothing to choose when even the smallest page size shows every row
  if (p.total <= PAGE_SIZE_OPTIONS[0]) return null

  const from = (p.page - 1) * p.pageSize + 1
  const to = Math.min(p.page * p.pageSize, p.total)

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span>
          Hiển thị{' '}
          <strong className="text-slate-900">
            {from}–{to}
          </strong>{' '}
          / {p.total}
        </span>
        <div className="flex items-center gap-1.5">
          <span>Số dòng:</span>
          <Select
            value={String(p.pageSize)}
            onValueChange={(v) => p.setPageSize(Number(v))}
          >
            <SelectTrigger className="h-7 w-[4.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={p.page <= 1}
          onClick={() => p.setPage(p.page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pageNumbers(p.page, p.pageCount).map((n, i) =>
          n === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={n === p.page ? 'default' : 'outline'}
              onClick={() => p.setPage(n)}
              aria-current={n === p.page ? 'page' : undefined}
              className="h-8 min-w-8 px-2 text-xs"
            >
              {n}
            </Button>
          ),
        )}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={p.page >= p.pageCount}
          onClick={() => p.setPage(p.page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-2 hidden sm:inline">
          Trang {p.page} / {p.pageCount}
        </span>
      </div>
    </div>
  )
}
