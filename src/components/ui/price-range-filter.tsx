import * as React from 'react'

import { Label } from '#/components/ui/label.tsx'
import { MoneyInput } from '#/components/ui/money-input.tsx'
import { formatVnd } from '#/lib/business.ts'

function Field({
  prefix,
  value,
  onChange,
}: {
  prefix: string
  value: number | undefined
  onChange: (n: number | undefined) => void
}) {
  return (
    <div className="relative flex-1 min-w-0">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
        {prefix}
      </span>
      <MoneyInput
        blankZero
        placeholder="Không giới hạn"
        value={value ?? 0}
        onValueChange={(n) => onChange(n || undefined)}
        className="h-11 w-full text-sm text-right pl-12 pr-8 rounded-lg"
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        ₫
      </span>
    </div>
  )
}

/** Min / max amount pair with a ₫ suffix, a live summary and a range check */
export function PriceRangeFilter({
  label,
  min: urlMin,
  max: urlMax,
  onChange,
  delay = 1000,
}: {
  label: string
  min: number | undefined
  max: number | undefined
  onChange: (min: number | undefined, max: number | undefined) => void
  /** Pause after the last keystroke before `onChange` (e.g. the URL) runs */
  delay?: number
}) {
  // The boxes edit local state only; `onChange` runs once typing pauses, so no
  // router / URL work happens per keystroke
  const [range, setRange] = React.useState({ min: urlMin, max: urlMax })
  const { min, max } = range
  const pushed = React.useRef({ min: urlMin, max: urlMax })
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  // Changes that come from the URL itself (Back button, shared link, "Xóa lọc")
  React.useEffect(() => {
    if (urlMin !== pushed.current.min || urlMax !== pushed.current.max) {
      pushed.current = { min: urlMin, max: urlMax }
      setRange({ min: urlMin, max: urlMax })
    }
  }, [urlMin, urlMax])

  React.useEffect(() => {
    if (min === pushed.current.min && max === pushed.current.max) return
    const timer = setTimeout(() => {
      pushed.current = { min, max }
      onChangeRef.current(min, max)
    }, delay)
    return () => clearTimeout(timer)
  }, [min, max, delay])

  const clear = () => {
    pushed.current = { min: undefined, max: undefined }
    setRange({ min: undefined, max: undefined })
    onChangeRef.current(undefined, undefined)
  }

  const active = min !== undefined || max !== undefined
  const inverted = min !== undefined && max !== undefined && min > max

  let summary = 'Để trống để không giới hạn'
  if (min !== undefined && max !== undefined)
    summary = `Từ ${formatVnd(min)} đến ${formatVnd(max)}`
  else if (min !== undefined) summary = `Từ ${formatVnd(min)} trở lên`
  else if (max !== undefined) summary = `Tối đa ${formatVnd(max)}`

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{label}</Label>
        {active && (
          <button
            type="button"
            onClick={clear}
            className="text-[11px] font-medium text-slate-500 hover:text-rose-600"
          >
            Xóa khoảng giá
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Field
          prefix="Từ"
          value={min}
          onChange={(n) => setRange((r) => ({ ...r, min: n }))}
        />
        <span className="text-slate-300">—</span>
        <Field
          prefix="Đến"
          value={max}
          onChange={(n) => setRange((r) => ({ ...r, max: n }))}
        />
      </div>
      <p
        className={`text-[11px] ${inverted ? 'text-rose-600' : 'text-slate-500'}`}
      >
        {inverted
          ? 'Giá "Từ" đang lớn hơn giá "Đến" — sẽ không có kết quả nào'
          : summary}
      </p>
    </div>
  )
}
