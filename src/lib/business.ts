/**
 * PURE business logic (no DB access) — shared across server, seed, and UI.
 * All core financial formulas live here. See AGENTS.md section 2.2.
 */

/** Round VND to nearest integer */
export const roundVnd = (n: number) => Math.round(n)

/* -------------------------------------------------------------------------- */
/* Batch expense allocation & cost price                                      */
/* -------------------------------------------------------------------------- */

export interface AllocationInput {
  id: number
  importPrice: number
}

export interface AllocationResult {
  id: number
  importPrice: number
  allocatedExpense: number
  costPrice: number
}

/**
 * Allocated expense for vehicle i = Total batch expenses × (Import price of vehicle i / Σ import prices).
 * Rounding differences are apportioned to the last vehicle so total allocated == total batch expense.
 */
export function allocateBatchExpenses(
  items: AllocationInput[],
  totalExpense: number,
): AllocationResult[] {
  const totalImport = items.reduce((s, v) => s + v.importPrice, 0)
  if (items.length === 0) return []
  if (totalImport <= 0) {
    // Zero goods value -> divide equally to preserve total expense
    const each = roundVnd(totalExpense / items.length)
    return items.map((v, i) => {
      const allocated =
        i === items.length - 1 ? totalExpense - each * (items.length - 1) : each
      return {
        ...v,
        allocatedExpense: allocated,
        costPrice: v.importPrice + allocated,
      }
    })
  }
  let running = 0
  return items.map((v, i) => {
    const allocated =
      i === items.length - 1
        ? roundVnd(totalExpense - running)
        : roundVnd((totalExpense * v.importPrice) / totalImport)
    running += allocated
    return {
      ...v,
      allocatedExpense: allocated,
      costPrice: v.importPrice + allocated,
    }
  })
}

/* -------------------------------------------------------------------------- */
/* Batch selling price                                                         */
/* -------------------------------------------------------------------------- */

export type PricingBase = 'import_price' | 'cost_price'
export type PricingMethod = 'percent' | 'fixed_amount'

export interface BatchPricing {
  pricingBase: PricingBase
  pricingMethod: PricingMethod
  pricingValue: number
}

/**
 * Selling price = import price + % or + fixed amount. Batch expenses are never
 * part of it (`p.pricingBase` is kept only for old data and is ignored).
 */
export function computeSellingPrice(
  v: { importPrice: number; costPrice: number },
  p: BatchPricing,
): number {
  const base = v.importPrice
  const price =
    p.pricingMethod === 'percent'
      ? base * (1 + p.pricingValue / 100)
      : base + p.pricingValue
  return roundVnd(price)
}

/** MANDATORY red warning when selling price < cost price */
export const isBelowCost = (sellingPrice: number, costPrice: number) =>
  sellingPrice < costPrice

/* -------------------------------------------------------------------------- */
/* Bank loan interest: declining balance, 365 days, segmented per principal payment */
/* -------------------------------------------------------------------------- */

export interface InterestSegment {
  from: string
  to: string
  days: number
  outstanding: number
  interest: number
}

export interface InterestResult {
  segments: InterestSegment[]
  totalInterest: number
  outstanding: number
}

const DAY_MS = 86_400_000
const toUtc = (d: string) => Date.parse(`${d}T00:00:00Z`)
export const daysBetween = (from: string, to: string) =>
  Math.max(0, Math.round((toUtc(to) - toUtc(from)) / DAY_MS))

/**
 * Calculate interest from disbursement date to `asOf`.
 * Each principal repayment cuts a segment; segment interest = balance × annual rate × days / 365.
 */
export function calculateLoanInterest(params: {
  principal: number
  annualRatePercent: number
  disbursementDate: string
  asOf: string
  principalRepayments: { date: string; amount: number }[]
}): InterestResult {
  const { principal, annualRatePercent, disbursementDate, asOf } = params
  const repayments = [...params.principalRepayments]
    .filter((r) => r.amount > 0 && r.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date))

  const segments: InterestSegment[] = []
  let outstanding = principal
  let cursor = disbursementDate

  const pushSegment = (to: string) => {
    const days = daysBetween(cursor, to)
    if (days > 0 && outstanding > 0) {
      segments.push({
        from: cursor,
        to,
        days,
        outstanding,
        interest: roundVnd(
          (outstanding * (annualRatePercent / 100) * days) / 365,
        ),
      })
    }
    cursor = to > cursor ? to : cursor
  }

  for (const r of repayments) {
    pushSegment(r.date)
    outstanding = Math.max(0, outstanding - r.amount)
  }
  pushSegment(asOf)

  return {
    segments,
    totalInterest: segments.reduce((s, x) => s + x.interest, 0),
    outstanding,
  }
}

/* -------------------------------------------------------------------------- */
/* Formatting utilities                                                        */
/* -------------------------------------------------------------------------- */

const vnd = new Intl.NumberFormat('vi-VN')
export const formatVnd = (n: number | null | undefined) =>
  `${vnd.format(Math.round(n ?? 0))} ₫`
export const formatNumber = (n: number | null | undefined) => vnd.format(n ?? 0)
export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return '—'
  const s = typeof d === 'string' ? d : d.toISOString().slice(0, 10)
  const [y, m, day] = s.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

/** Display name of a motorcycle model: "Honda SH 150i 2025" */
export const modelLabel = (m: {
  brand?: string | null
  name: string
  modelYear?: string | null
}) => [m.brand, m.name, m.modelYear].filter(Boolean).join(' ')

/** Display name of an import batch: "Lô 20/02/2026 · PT Astra Honda Motor" */
export const batchLabel = (b: {
  importDate: string | Date
  supplierName?: string | null
}) =>
  `Lô ${formatDate(b.importDate)}${b.supplierName ? ` · ${b.supplierName}` : ''}`
export const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * Estimated interest over a loan term, assuming the principal is not repaid
 * early: simple interest on the full principal (rate / 12 per month, the same
 * as the 365-day convention averaged over a year). The real, day-exact figure
 * comes from `calculateLoanInterest`.
 */
export function estimateLoanTermInterest(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
) {
  const monthly = (principal * annualRatePercent) / 100 / 12
  return { monthly, total: monthly * termMonths }
}

/** yyyy-mm-dd + N months, clamped to the end of a shorter month (31 Jan + 1 = 28/29 Feb) */
export function addMonthsIso(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}
