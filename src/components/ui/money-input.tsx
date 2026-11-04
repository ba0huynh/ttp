import * as React from 'react'

import { Input } from '#/components/ui/input.tsx'

type MoneyInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'min' | 'step'
> & {
  /** Amount in VND; an empty string or 0 with `blankZero` shows an empty box */
  value: number | string
  onValueChange: (value: number) => void
  /** Show an empty box instead of "0" */
  blankZero?: boolean
  /** Maximum number of raw digits allowed (e.g. 12 digits = 999.999.999.999) */
  maxDigits?: number
  /** Maximum numeric value allowed */
  max?: number
}

const grouping = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

/** Whole-number input that shows thousands separators ("1.500.000") while typing */
function MoneyInput({
  value,
  onValueChange,
  blankZero = false,
  maxDigits,
  max,
  className,
  onKeyDown,
  onPaste,
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
      onKeyDown={(e) => {
        if (onKeyDown) onKeyDown(e)
        if (e.defaultPrevented) return
        if (
          maxDigits !== undefined &&
          /^\d$/.test(e.key) &&
          !e.ctrlKey &&
          !e.metaKey
        ) {
          const input = e.currentTarget
          const selectedLength =
            (input.selectionEnd ?? 0) - (input.selectionStart ?? 0)
          const currentDigits = input.value.replace(/\D/g, '')
          if (selectedLength === 0 && currentDigits.length >= maxDigits) {
            e.preventDefault()
          }
        }
      }}
      onPaste={(e) => {
        if (onPaste) onPaste(e)
        if (e.defaultPrevented) return
        if (maxDigits !== undefined) {
          e.preventDefault()
          const pasted = e.clipboardData.getData('text').replace(/\D/g, '')
          const input = e.currentTarget
          const selectedLength =
            (input.selectionEnd ?? 0) - (input.selectionStart ?? 0)
          const currentDigits = input.value.replace(/\D/g, '')
          const combined = (
            selectedLength > 0 ? pasted : currentDigits + pasted
          ).slice(0, maxDigits)
          let num = Number(combined) || 0
          if (max !== undefined && num > max) num = max
          onValueChange(num)
        }
      }}
      onChange={(e) => {
        let rawDigits = e.target.value.replace(/\D/g, '')
        if (maxDigits !== undefined && rawDigits.length > maxDigits) {
          rawDigits = rawDigits.slice(0, maxDigits)
        }
        let num = Number(rawDigits) || 0
        if (max !== undefined && num > max) {
          num = max
        }
        onValueChange(num)
      }}
      className={className}
    />
  )
}

export { MoneyInput }
