import * as React from 'react'

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

const ERROR_ATTR = 'data-field-error'
const ERROR_CLASS = 'mt-1 text-[11px] font-medium text-rose-600'

/** Vietnamese text for the first constraint a control violates */
function messageFor(el: Control): string {
  const v = el.validity
  const type = el instanceof HTMLInputElement ? el.type : ''
  if (v.valueMissing) {
    if (
      el instanceof HTMLSelectElement ||
      type === 'checkbox' ||
      type === 'radio'
    )
      return 'Vui lòng chọn một giá trị'
    if (type === 'date') return 'Vui lòng chọn ngày'
    return 'Vui lòng nhập thông tin này'
  }
  if (v.typeMismatch)
    return type === 'email' ? 'Email không hợp lệ' : 'Giá trị không hợp lệ'
  if (v.tooShort) return `Tối thiểu ${el.getAttribute('minlength')} ký tự`
  if (v.tooLong) return `Tối đa ${el.getAttribute('maxlength')} ký tự`
  if (v.rangeUnderflow) return `Giá trị tối thiểu là ${el.getAttribute('min')}`
  if (v.rangeOverflow) return `Giá trị tối đa là ${el.getAttribute('max')}`
  if (v.patternMismatch) return el.title || 'Định dạng không hợp lệ'
  if (v.stepMismatch || v.badInput) return 'Giá trị không hợp lệ'
  return el.validationMessage || 'Giá trị không hợp lệ'
}

function errorNodeOf(el: Control): HTMLElement | null {
  const next = el.nextElementSibling
  return next instanceof HTMLElement && next.hasAttribute(ERROR_ATTR)
    ? next
    : null
}

function showError(el: Control, message: string) {
  let node = errorNodeOf(el)
  if (!node) {
    node = document.createElement('p')
    node.setAttribute(ERROR_ATTR, '')
    node.setAttribute('role', 'alert')
    node.className = ERROR_CLASS
    el.insertAdjacentElement('afterend', node)
  }
  node.textContent = message
  el.setAttribute('aria-invalid', 'true')
}

function clearError(el: Control) {
  errorNodeOf(el)?.remove()
  el.removeAttribute('aria-invalid')
}

const isControl = (t: EventTarget | null): t is Control =>
  t instanceof HTMLInputElement ||
  t instanceof HTMLTextAreaElement ||
  t instanceof HTMLSelectElement

/**
 * Replaces the browser's own validation bubble ("Please fill out this field",
 * always in the browser's language) with a Vietnamese message under the
 * control, for every form in the app. Mount once near the root.
 *
 * The browser still does the checking (required, type=email, min, minlength,
 * pattern ...) and blocks the submit; this only cancels the bubble, writes the
 * message below the field, marks it `aria-invalid` (red border) and focuses
 * the first invalid field. The message disappears as soon as the user edits it.
 */
export function FieldValidationHost() {
  React.useEffect(() => {
    let focused = false

    // `invalid` does not bubble, so listen in the capture phase
    const onInvalid = (e: Event) => {
      if (!isControl(e.target)) return
      e.preventDefault()
      showError(e.target, messageFor(e.target))
      if (!focused) {
        focused = true
        e.target.focus()
        // One submit fires `invalid` once per bad field in the same tick
        setTimeout(() => {
          focused = false
        }, 0)
      }
    }
    const onEdit = (e: Event) => {
      if (isControl(e.target) && e.target.hasAttribute('aria-invalid'))
        clearError(e.target)
    }

    document.addEventListener('invalid', onInvalid, true)
    document.addEventListener('input', onEdit, true)
    document.addEventListener('change', onEdit, true)
    return () => {
      document.removeEventListener('invalid', onInvalid, true)
      document.removeEventListener('input', onEdit, true)
      document.removeEventListener('change', onEdit, true)
    }
  }, [])

  return null
}
