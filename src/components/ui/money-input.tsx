import * as React from 'react'

import { Input } from '#/components/ui/input.tsx'

type MoneyInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'min' | 'max' | 'step'
> & {
  /** Amount in VND; an empty string or 0 with `blankZero` shows an empty box */
  value: number | string
  onValueChange: (value: number) => void
  /** Show an empty box instead of "0" */
  blankZero?: boolean
}

const grouping = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

/** Whole-number input that shows thousands separators ("1.500.000") while typing */
function MoneyInput({
  value,
  onValueChange,
  blankZero = false,
  className,
  ...props
}: MoneyInputProps) {
  const amount = Number(value) || 0
  const shown =
    value === '' || (blankZero && amount === 0) ? '' : grouping.format(amount)

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={shown}
      onChange={(e) =>
        onValueChange(Number(e.target.value.replace(/\D/g, '')) || 0)
      }
      className={className}
    />
  )
}

export { MoneyInput }
