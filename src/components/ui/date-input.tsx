import { CalendarDays } from 'lucide-react'
import * as React from 'react'

import { INPUT_CLASS } from '#/components/ui/input-class.ts'
import { cn } from '#/lib/utils.ts'

/** `yyyy-mm-dd` -> `dd/mm/yyyy`; '' for an empty or malformed value */
export function isoToDateText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/**
 * Typed text -> `yyyy-mm-dd`: '' when the box is empty, null when the text is
 * not a real calendar date. Accepts d/m/yyyy and dd/mm/yyyy (also with "." or
 * "-"), ddmmyyyy, and a pasted yyyy-mm-dd.
 */
export function dateTextToIso(text: string): string | null {
  const t = text.trim()
  if (t === '') return ''
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  const dmy =
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t) ??
    /^(\d{2})(\d{2})(\d{4})$/.exec(t)
  const parts = ymd ? [ymd[3], ymd[2], ymd[1]] : dmy && [dmy[1], dmy[2], dmy[3]]
  if (!parts) return null
  const [d, m, y] = parts.map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  if (y < 1900 || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Adds the slashes while typing forward: "04" -> "04/", "4/" -> "04/", "04/1/" -> "04/01/" */
function maskForward(raw: string): string {
  return raw
    .replace(/[.\-\s]/g, '/')
    .replace(/[^\d/]/g, '')
    .replace(/^(\d)\//, (_, d: string) => `0${d}/`)
    .replace(/^(\d{2}\/)(\d)\//, (_, dd: string, m: string) => `${dd}0${m}/`)
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2}\/\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2}|\d{2}\/\d{2})$/, '$1/')
    .replace(/\/{2,}/g, '/')
    .slice(0, 10)
}

/** Width, flex, grid and margin classes go on the wrapper, the rest on the box */
const LAYOUT_CLASS =
  /^(?:[\w-]+:)*-?(?:w-|min-w-|max-w-|basis-|flex-|grow|shrink|self-|justify-self-|col-|row-|order-|m[trblxy]?-)/

function splitClasses(className: string | undefined): [string, string] {
  const outer: string[] = []
  const inner: string[] = []
  for (const c of (className ?? '').split(/\s+/)) {
    if (c) (LAYOUT_CLASS.test(c) ? outer : inner).push(c)
  }
  return [outer.join(' '), inner.join(' ')]
}

const INVALID_DATE = 'Ngày không hợp lệ, nhập theo dạng dd/mm/yyyy'
const OUT_OF_RANGE = 'Ngày nằm ngoài khoảng cho phép'

type DateInputProps = Omit<React.ComponentProps<'input'>, 'type'>

/**
 * Date box that always shows dd/mm/yyyy, whatever the browser's language
 * (a native date box shows 11/04/2026 on an English Windows). `Input` renders
 * it for every `type="date"`, with the same props: `value` and the
 * `e.target.value` that onChange receives stay `yyyy-mm-dd` ('' while the text
 * is empty or not a full date). The calendar button opens the browser's own
 * picker through a hidden native date box, which also carries `name`, `min`
 * and `max`. Alt+ArrowDown opens the picker from the keyboard.
 */
function DateInput({
  value,
  defaultValue,
  onChange,
  onBlur,
  onKeyDown,
  className,
  disabled,
  required,
  name,
  min,
  max,
  placeholder = 'dd/mm/yyyy',
  ...props
}: DateInputProps) {
  const textRef = React.useRef<HTMLInputElement>(null)
  const pickerRef = React.useRef<HTMLInputElement>(null)
  /** True while typed text is being sent through the picker box */
  const sending = React.useRef(false)
  const controlled = value !== undefined
  const iso = controlled ? String(value) : undefined
  const [text, setText] = React.useState(() =>
    isoToDateText(String(value ?? defaultValue ?? '')),
  )

  // Follow outside changes (picker, reset buttons) without wiping half-typed
  // text that still stands for the same value
  const [seenIso, setSeenIso] = React.useState(iso)
  if (iso !== seenIso) {
    setSeenIso(iso)
    if (iso !== undefined && iso !== (dateTextToIso(text) ?? ''))
      setText(isoToDateText(iso))
  }

  const typed = dateTextToIso(text)
  const outOfRange =
    !!typed &&
    ((!!min && typed < String(min)) || (!!max && typed > String(max)))
  const error = typed === null ? INVALID_DATE : outOfRange ? OUT_OF_RANGE : ''
  // The form's submit check (and FieldValidationHost) shows this message
  React.useEffect(() => {
    textRef.current?.setCustomValidity(error)
  }, [error])

  /** Passes a value through the picker box, so onChange gets a real event */
  const send = (next: string) => {
    const el = pickerRef.current
    if (!el || el.value === next) return
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set?.call(el, next)
    sending.current = true
    el.dispatchEvent(new Event('input', { bubbles: true }))
    sending.current = false
  }

  const handleText = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target
    const kind = (e.nativeEvent as InputEvent).inputType ?? ''
    const pasted = kind === 'insertFromPaste' ? dateTextToIso(el.value) : null
    const next = pasted
      ? isoToDateText(pasted)
      : kind.startsWith('insert') && el.selectionStart === el.value.length
        ? maskForward(el.value)
        : el.value.replace(/[^\d/.-]/g, '').slice(0, 14)
    setText(next)
    send(dateTextToIso(next) ?? '')
  }

  const handlePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!controlled && !sending.current) setText(isoToDateText(e.target.value))
    onChange?.(e)
  }

  const openPicker = () => {
    try {
      pickerRef.current?.showPicker()
    } catch {
      // No picker in this browser: typing still works
    }
  }

  const [outer, inner] = splitClasses(className)
  return (
    <div data-field-wrap className={cn('relative', outer)}>
      <input
        {...props}
        ref={textRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        data-slot="date-input"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={text}
        onChange={handleText}
        onBlur={(e) => {
          if (typed) setText(isoToDateText(typed))
          else if (error) e.target.setAttribute('aria-invalid', 'true')
          onBlur?.(e)
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (!e.defaultPrevented && e.altKey && e.key === 'ArrowDown') {
            e.preventDefault()
            openPicker()
          }
        }}
        className={cn(INPUT_CLASS, inner, 'pr-10')}
      />
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        name={name}
        min={min}
        max={max}
        disabled={disabled}
        {...(controlled ? { value: iso } : { defaultValue })}
        onChange={handlePicker}
        className="pointer-events-none absolute inset-0 size-full opacity-0"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Chọn ngày"
        disabled={disabled}
        onClick={openPicker}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarDays className="size-4" />
      </button>
    </div>
  )
}

export { DateInput }
