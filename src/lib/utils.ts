import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import * as React from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Enables smooth horizontal (<- and ->) keyboard navigation between inputs
 * and combobox trigger buttons in an inline table row.
 */
export function handleRowArrowNavigation(
  e: React.KeyboardEvent,
) {
  const isLeft = e.key === 'ArrowLeft'
  const isRight = e.key === 'ArrowRight'
  const isUp = e.key === 'ArrowUp'
  const isDown = e.key === 'ArrowDown'

  if (!isLeft && !isRight && !isUp && !isDown) return

  const target = e.target as HTMLElement | null
  if (!target) return

  // Do not intercept if inside a popover, dropdown list, or modal dialog
  if (target.closest('[data-radix-popper-content-wrapper], [role="dialog"]')) return

  const row = (e.currentTarget as HTMLElement).closest('tr') || (e.currentTarget as HTMLElement)
  const fields = Array.from(
    row.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), button[role="combobox"]:not([disabled])',
    ),
  )

  const currentIndex = fields.indexOf(target)
  if (currentIndex === -1) return

  // Vertical navigation between stacked comboboxes (e.g. Model and Color)
  if (isDown && target.getAttribute('role') === 'combobox') {
    if (
      currentIndex < fields.length - 1 &&
      fields[currentIndex + 1].getAttribute('role') === 'combobox'
    ) {
      e.preventDefault()
      e.stopPropagation()
      fields[currentIndex + 1].focus()
      return
    }
  } else if (isUp && target.getAttribute('role') === 'combobox') {
    if (
      currentIndex > 0 &&
      fields[currentIndex - 1].getAttribute('role') === 'combobox'
    ) {
      e.preventDefault()
      e.stopPropagation()
      fields[currentIndex - 1].focus()
      return
    }
  }

  if (!isLeft && !isRight) return

  const isInput = target instanceof HTMLInputElement
  const selStart = isInput ? target.selectionStart : null
  const selEnd = isInput ? target.selectionEnd : null
  const valLen = isInput ? target.value.length : 0

  const isAllSelected = isInput && selStart === 0 && selEnd === valLen
  const isAtStart =
    !isInput ||
    (selStart === 0 && selEnd === 0) ||
    isAllSelected
  const isAtEnd =
    !isInput ||
    (selStart === valLen && selEnd === valLen) ||
    isAllSelected

  if (isRight && isAtEnd) {
    if (currentIndex < fields.length - 1) {
      e.preventDefault()
      e.stopPropagation()
      const next = fields[currentIndex + 1]
      next.focus()
      if (next instanceof HTMLInputElement) {
        next.select()
      }
    }
  } else if (isLeft && isAtStart) {
    if (currentIndex > 0) {
      e.preventDefault()
      e.stopPropagation()
      const prev = fields[currentIndex - 1]
      prev.focus()
      if (prev instanceof HTMLInputElement) {
        prev.select()
      }
    }
  }
}
