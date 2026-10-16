import * as React from 'react'

import { Input } from '#/components/ui/input.tsx'

type DecimalInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'min' | 'max' | 'step'
> & {
  value: number
  onValueChange: (value: number) => void
  /** Digits kept after the decimal comma (default 6) */
  maxDecimals?: number
}

/**
 * Vietnamese number text: "." groups thousands, "," is the decimal mark
 * ("1.234,5"). Returns the text to show and the numeric value.
 */
function parseTyped(raw: string, maxDecimals: number) {
  const cleaned = raw.replace(/[^\d,]/g, '')
  const comma = cleaned.indexOf(',')
  const intDigits = (comma < 0 ? cleaned : cleaned.slice(0, comma)).replace(
    /^0+(?=\d)/,
    '',
  )
  const decDigits =
    comma < 0
      ? ''
      : cleaned
          .slice(comma + 1)
          .replace(/,/g, '')
          .slice(0, maxDecimals)
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return {
    text: grouped + (comma >= 0 ? ',' + decDigits : ''),
    value: Number(`${intDigits || '0'}${decDigits ? '.' + decDigits : ''}`),
  }
}

function formatNumber(value: number, maxDecimals: number) {
  return parseTyped(String(value).replace('.', ','), maxDecimals).text
}

/**
 * Decimal box for rates and percentages with Vietnamese separators:
 * 1.234,5 (a dot for thousands, a comma for decimals). Keeps what the user is
 * typing ("8," or "8,50") while the numeric value is reported on every change.
 */
function DecimalInput({
  value,
  onValueChange,
  maxDecimals = 6,
  ...props
}: DecimalInputProps) {
  const [text, setText] = React.useState(() => formatNumber(value, maxDecimals))

  // The parent changed the value from outside (reset, other field): follow it
  React.useEffect(() => {
    setText((current) =>
      parseTyped(current, maxDecimals).value === value
        ? current
        : formatNumber(value, maxDecimals),
    )
  }, [value, maxDecimals])

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const next = parseTyped(e.target.value, maxDecimals)
        setText(next.text)
        onValueChange(next.value)
      }}
    />
  )
}

export { DecimalInput }
