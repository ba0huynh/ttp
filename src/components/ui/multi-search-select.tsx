import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react'
import * as React from 'react'
import { cn } from 'cn'

import { Input } from '#/components/ui/input.tsx'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover.tsx'
import {
  SearchSelectItem,
  fold,
  nodeText,
} from '#/components/ui/search-select.tsx'

interface ItemProps {
  value: string
  className?: string
  keywords?: string
  children?: React.ReactNode
}

/**
 * Multi-choice sibling of `SearchSelect`: same `<SearchSelectItem>` children and
 * search box, but each click toggles an option and the list stays open.
 */
export function MultiSearchSelect({
  values,
  onValuesChange,
  placeholder = 'Chọn...',
  searchPlaceholder = 'Tìm kiếm...',
  className,
  disabled,
  children,
}: {
  values: string[]
  onValuesChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  children?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const options: {
    value: string
    label: string
    node: React.ReactNode
    haystack: string
  }[] = []
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement(child) || child.type !== SearchSelectItem)
      continue
    const props = child.props as ItemProps
    const label = nodeText(props.children)
    options.push({
      value: props.value,
      label,
      node: props.children,
      haystack: fold(`${label} ${props.keywords ?? ''}`),
    })
  }

  const q = fold(query.trim())
  const filtered = q ? options.filter((o) => o.haystack.includes(q)) : options
  const chosen = options.filter((o) => values.includes(o.value))

  const toggle = (v: string) =>
    onValuesChange(
      values.includes(v) ? values.filter((x) => x !== v) : [...values, v],
    )

  const summary =
    chosen.length === 0
      ? placeholder
      : chosen.length <= 2
        ? chosen.map((o) => o.label).join(', ')
        : `${chosen.length} mục đã chọn`

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-placeholder={chosen.length === 0 ? '' : undefined}
          className={cn(
            'flex h-11 w-full max-w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-4 py-2 text-left text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground dark:bg-input/30',
            className,
          )}
        >
          <span className="min-w-0 truncate">{summary}</span>
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 text-sm px-4 rounded-lg"
          />
        </div>
        {/* Wheel events are stopped so scrolling works inside a modal dialog */}
        <div
          className="max-h-64 overflow-y-auto p-1"
          onWheel={(e) => e.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-slate-400">
              Không tìm thấy kết quả
            </div>
          ) : (
            filtered.map((o) => {
              const on = values.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(o.value)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-hidden hover:bg-accent hover:text-accent-foreground',
                    on && 'font-medium',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded border',
                      on
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-slate-300',
                    )}
                  >
                    {on && <CheckIcon className="size-3" />}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    {o.node}
                  </span>
                </button>
              )
            })
          )}
        </div>
        {chosen.length > 0 && (
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-slate-500">
            <span>Đã chọn {chosen.length}</span>
            <button
              type="button"
              onClick={() => onValuesChange([])}
              className="flex items-center gap-1 font-medium text-slate-600 hover:text-rose-600"
            >
              <XIcon className="size-3" />
              Bỏ chọn tất cả
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
