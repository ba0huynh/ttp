import { CheckIcon, ChevronDownIcon, PlusIcon } from 'lucide-react'
import * as React from 'react'
import { cn } from 'cn'

import { Input } from '#/components/ui/input.tsx'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover.tsx'

/** Options shown first, and added each time the list is scrolled to its end */
const PAGE_SIZE = 10

interface SearchSelectItemProps {
  value: string
  className?: string
  /** Extra words that find the option but are never shown (e.g. a bank code) */
  keywords?: string
  children?: React.ReactNode
}

/**
 * Option marker for `SearchSelect`; it renders nothing by itself, the parent
 * reads its `value` / `children` (same shape as the shadcn `SelectItem`).
 */
export function SearchSelectItem(_props: SearchSelectItemProps) {
  return null
}

/** Plain text of a React node, used to search options whose label is JSX */
export function nodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean')
    return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join(' ')
  if (React.isValidElement(node))
    return nodeText((node.props as { children?: React.ReactNode }).children)
  return ''
}

/** Lower-case and strip Vietnamese diacritics so "ngan hang" finds "Ngân hàng" */
export function fold(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
}

interface Option {
  value: string
  className?: string
  node: React.ReactNode
  haystack: string
}

/**
 * Drop-in for `Select` when the options come from a table: a dropdown with a
 * search box. Children are `<SearchSelectItem value="...">label</SearchSelectItem>`.
 */
export function SearchSelect({
  value,
  onValueChange,
  placeholder = 'Chọn...',
  searchPlaceholder = 'Tìm kiếm...',
  className,
  disabled,
  createAction,
  children,
}: {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  /** Pinned first row that opens a form to create a new option */
  createAction?: { label: string; onClick: () => void }
  children?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  // How many of the matching options are rendered (load more on scroll)
  const [visible, setVisible] = React.useState(PAGE_SIZE)

  const options: Option[] = []
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement(child) || child.type !== SearchSelectItem)
      continue
    const props = child.props as SearchSelectItemProps
    options.push({
      value: props.value,
      className: props.className,
      node: props.children,
      haystack: fold(`${nodeText(props.children)} ${props.keywords ?? ''}`),
    })
  }

  const q = fold(query.trim())
  const filtered = q ? options.filter((o) => o.haystack.includes(q)) : options
  const selected = options.find((o) => o.value === value)
  const shown = filtered.slice(0, visible)
  const hasMore = filtered.length > shown.length
  const current = Math.min(active, Math.max(shown.length - 1, 0))
  const loadMore = () => setVisible((v) => v + PAGE_SIZE)

  const choose = (v: string) => {
    onValueChange(v)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setQuery('')
          setActive(0)
          setVisible(PAGE_SIZE)
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-placeholder={selected ? undefined : ''}
          className={cn(
            'flex h-11 w-full max-w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-4 py-2 text-left text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground dark:bg-input/30',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2 overflow-hidden [&>*]:min-w-0">
            {selected ? selected.node : placeholder}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-48 p-0"
      >
        <div className="border-b p-2">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
              setVisible(PAGE_SIZE)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                // Keyboard past the last rendered option loads the next batch
                if (current + 1 >= shown.length && hasMore) loadMore()
                setActive(Math.min(current + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive(Math.max(current - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const o = shown[current]
                if (o) choose(o.value)
              }
            }}
            placeholder={searchPlaceholder}
            className="h-11 text-sm px-4 rounded-lg"
          />
        </div>
        {/* Wheel events are stopped so scrolling works inside a modal dialog */}
        <div
          className="max-h-64 overflow-y-auto p-1"
          onWheel={(e) => e.stopPropagation()}
          onScroll={(e) => {
            const el = e.currentTarget
            if (
              hasMore &&
              el.scrollTop + el.clientHeight >= el.scrollHeight - 24
            )
              loadMore()
          }}
        >
          {createAction && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                createAction.onClick()
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs font-semibold text-emerald-700 outline-hidden hover:bg-accent"
            >
              <PlusIcon className="size-3.5" />
              {createAction.label}
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-slate-400">
              Không tìm thấy kết quả
            </div>
          ) : (
            shown.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => choose(o.value)}
                onMouseMove={() => setActive(i)}
                className={cn(
                  'relative flex w-full items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-left text-xs outline-hidden',
                  i === current && 'bg-accent text-accent-foreground',
                  o.className,
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {o.node}
                </span>
                {o.value === value && (
                  <CheckIcon className="absolute right-2 size-4" />
                )}
              </button>
            ))
          )}
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              className="w-full py-2 text-center text-[11px] text-slate-500 hover:text-slate-800"
            >
              Cuộn xuống hoặc bấm để tải thêm ({shown.length}/{filtered.length})
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
