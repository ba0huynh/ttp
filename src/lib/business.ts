/**
 * Logic nghiệp vụ THUẦN (không đụng DB) — dùng chung cho server, seed và UI.
 * Mọi công thức tài chính cốt lõi nằm ở đây. Xem AGENTS.md mục 2.2.
 */

/** Làm tròn VNĐ về số nguyên đồng */
export const roundVnd = (n: number) => Math.round(n)

/* -------------------------------------------------------------------------- */
/* Phân bổ chi phí lô & giá vốn                                               */
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
 * Chi phí phân bổ xe i = Tổng chi phí lô × (Đơn giá nhập xe i / Σ đơn giá nhập).
 * Phần chênh do làm tròn được dồn vào xe cuối để tổng phân bổ == tổng chi phí.
 */
export function allocateBatchExpenses(
  items: AllocationInput[],
  totalExpense: number,
): AllocationResult[] {
  const totalImport = items.reduce((s, v) => s + v.importPrice, 0)
  if (items.length === 0) return []
  if (totalImport <= 0) {
    // Không có tiền hàng → chia đều để không mất chi phí
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
/* Giá bán theo lô                                                            */
/* -------------------------------------------------------------------------- */

export type PricingBase = 'import_price' | 'cost_price'
export type PricingMethod = 'percent' | 'fixed_amount'

export interface BatchPricing {
  pricingBase: PricingBase
  pricingMethod: PricingMethod
  pricingValue: number
}

/** Giá bán = Gốc tính (đơn giá nhập | giá vốn) + % hoặc + số tiền */
export function computeSellingPrice(
  v: { importPrice: number; costPrice: number },
  p: BatchPricing,
): number {
  const base = p.pricingBase === 'import_price' ? v.importPrice : v.costPrice
  const price =
    p.pricingMethod === 'percent'
      ? base * (1 + p.pricingValue / 100)
      : base + p.pricingValue
  return roundVnd(price)
}

/** BẮT BUỘC cảnh báo đỏ khi giá bán < giá vốn */
export const isBelowCost = (sellingPrice: number, costPrice: number) =>
  sellingPrice < costPrice

/* -------------------------------------------------------------------------- */
/* Lãi vay: dư nợ giảm dần, 365 ngày, chia đoạn theo từng lần trả gốc         */
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
 * Tính lãi từ ngày giải ngân đến `asOf`.
 * Mỗi lần trả gốc cắt một đoạn; lãi đoạn = dư nợ × lãi suất/năm × số ngày / 365.
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
/* Định dạng                                                                  */
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
export const todayIso = () => new Date().toISOString().slice(0, 10)

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  import_tax: 'Thuế nhập khẩu',
  vat_import: 'VAT hàng nhập',
  shipping_international: 'Vận chuyển quốc tế',
  shipping_domestic: 'Vận chuyển nội địa',
  customs_fee: 'Phí hải quan',
  other: 'Chi phí khác',
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị',
  accountant: 'Kế toán',
  sales: 'Kinh doanh',
  warehouse: 'Kho',
}
