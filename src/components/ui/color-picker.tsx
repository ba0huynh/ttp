import { cn } from 'cn'

import { Input } from '#/components/ui/input.tsx'

/** Common motorcycle colors for one-click selection */
const PRESETS = [
  { hex: '#18181b', label: 'Đen' },
  { hex: '#f8fafc', label: 'Trắng' },
  { hex: '#64748b', label: 'Xám' },
  { hex: '#990000', label: 'Đỏ đô' },
  { hex: '#dc2626', label: 'Đỏ' },
  { hex: '#ea580c', label: 'Cam' },
  { hex: '#ca8a04', label: 'Vàng' },
  { hex: '#166534', label: 'Xanh lá' },
  { hex: '#1e40af', label: 'Xanh dương' },
]

const HEX6 = /^#[0-9a-f]{6}$/i

/** "#abc" / "abc" / "#AABBCC" -> "#aabbcc"; returns null when it is not a color */
export function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(v))
    return `#${v
      .split('')
      .map((c) => c + c)
      .join('')}`.toLowerCase()
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v}`.toLowerCase()
  return null
}

/**
 * Hex color field with the browser's native color wheel / picker, a text box
 * for typing a hex code, and preset swatches. `value` is always a hex string.
 */
export function ColorPicker({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (hex: string) => void
  className?: string
}) {
  const valid = normalizeHex(value)
  // <input type="color"> only accepts #rrggbb
  const pickerValue = valid && HEX6.test(valid) ? valid : '#000000'

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <label
          className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input shadow-xs"
          style={{ backgroundColor: valid ?? 'transparent' }}
          title="Mở bảng chọn màu"
        >
          <input
            type="color"
            value={pickerValue}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label="Chọn màu"
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => valid && onChange(valid)}
          className={cn(
            'h-8 text-xs font-mono',
            value && !valid && 'border-rose-400 focus-visible:ring-rose-200',
          )}
          placeholder="#990000"
          spellCheck={false}
          maxLength={7}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.hex}
            type="button"
            title={p.label}
            aria-label={p.label}
            onClick={() => onChange(p.hex)}
            className={cn(
              'size-6 rounded-full border border-slate-300 shadow-xs transition-transform hover:scale-110',
              valid === p.hex && 'ring-2 ring-emerald-600 ring-offset-1',
            )}
            style={{ backgroundColor: p.hex }}
          />
        ))}
      </div>

      {value && !valid && (
        <p className="text-[11px] text-rose-600">
          Mã màu không hợp lệ. Ví dụ: #990000
        </p>
      )}
    </div>
  )
}
