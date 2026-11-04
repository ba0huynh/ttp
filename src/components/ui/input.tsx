import * as React from 'react'

import { DateInput } from '#/components/ui/date-input.tsx'
import { INPUT_CLASS } from '#/components/ui/input-class.ts'
import { cn } from '#/lib/utils.ts'

/**
 * Number boxes keep what was typed ("0" + "9" shows "09" even though the value
 * is 9), so a leading zero is dropped as soon as a digit follows it: typing 9
 * over a 0 gives 9, "007" gives 7, while "0.5" is left alone.
 */
function dropLeadingZeros(
  onChange: React.ChangeEventHandler<HTMLInputElement> | undefined,
): React.ChangeEventHandler<HTMLInputElement> | undefined {
  if (!onChange) return onChange
  return (e) => {
    const v = e.target.value
    if (/^0\d/.test(v)) e.target.value = v.replace(/^0+(?=\d)/, '')
    onChange(e)
  }
}

function Input({
  className,
  type,
  onChange,
  ...props
}: React.ComponentProps<'input'>) {
  // Native date boxes use the browser's locale (11/04/2026 on an English
  // Windows), so every date box is a DateInput that always shows dd/mm/yyyy
  if (type === 'date')
    return <DateInput className={className} onChange={onChange} {...props} />
  return (
    <input
      type={type}
      onChange={type === 'number' ? dropLeadingZeros(onChange) : onChange}
      data-slot="input"
      className={cn(INPUT_CLASS, className)}
      {...props}
    />
  )
}

export { Input }
