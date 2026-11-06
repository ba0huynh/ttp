import * as XLSX from 'xlsx'

export const SALES_TEMPLATE_HEADERS = [
  'SỐ KHUNG',
  'ĐƠN GIÁ CHƯA VAT (VNĐ)',
  '% VAT',
] as const

export interface SalesImportRow {
  chassisNumber: string
  priceBeforeVat: number
  vatRate: number
}

export interface SalesImportResult {
  rows: SalesImportRow[]
  /** Chassis numbers that are not in the list of vehicles available for sale. */
  missingChassis: string[]
  /** Human readable problems (bad price / VAT, duplicates). */
  invalidRows: string[]
}

/** Downloads the 3-column template used to bulk-fill a sales order. */
export function downloadSalesTemplate(sampleChassis: string[] = []): void {
  const sample = (sampleChassis.length > 0 ? sampleChassis : ['SỐ KHUNG 1'])
    .slice(0, 3)
    .map((c) => [c, 30000000, 10])
  const ws = XLSX.utils.aoa_to_sheet([[...SALES_TEMPLATE_HEADERS], ...sample])
  ws['!cols'] = [{ wch: 26 }, { wch: 26 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'MauBanXe')
  XLSX.writeFile(wb, 'mau-ban-xe.xlsx')
}

const fold = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

function parseNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v ?? '').trim()
  if (!s) return null
  // VND uses "." or "," as thousands separators; VAT may use "," as decimal mark
  const cleaned = s.replace(/[^\d.,]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Reads the filled template. `availableChassis` is the set of chassis numbers
 * that may be sold; anything else is reported in `missingChassis`.
 */
export async function parseSalesWorkbook(
  file: File,
  availableChassis: Iterable<string>,
): Promise<SalesImportResult> {
  const known = new Set<string>()
  for (const c of availableChassis) known.add(c.trim().toLowerCase())

  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })

  let chassisCol = 0
  let priceCol = 1
  let vatCol = 2
  let start = 0
  const header = data[0]
  if (header) {
    const f = header.map(fold)
    const c = f.findIndex((h) => h.includes('so khung'))
    if (c >= 0) {
      chassisCol = c
      priceCol = f.findIndex((h) => h.includes('don gia'))
      vatCol = f.findIndex((h) => h.includes('vat') && !h.includes('don gia'))
      if (priceCol < 0 || vatCol < 0) {
        throw new Error(
          'File không đúng mẫu. Cần 3 cột: SỐ KHUNG, ĐƠN GIÁ CHƯA VAT (VNĐ), % VAT',
        )
      }
      start = 1
    }
  }

  const result: SalesImportResult = {
    rows: [],
    missingChassis: [],
    invalidRows: [],
  }
  const seen = new Set<string>()

  for (let i = start; i < data.length; i++) {
    const row = data[i]
    const chassis = String(row[chassisCol] ?? '').trim()
    const rawPrice = row[priceCol]
    const rawVat = row[vatCol]
    if (!chassis && String(rawPrice ?? '') === '' && String(rawVat ?? '') === '')
      continue
    const line = i + 1
    if (!chassis) {
      result.invalidRows.push(`Dòng ${line}: thiếu SỐ KHUNG`)
      continue
    }
    const key = chassis.toLowerCase()
    if (!known.has(key)) {
      result.missingChassis.push(chassis)
      continue
    }
    if (seen.has(key)) {
      result.invalidRows.push(`Dòng ${line}: SỐ KHUNG ${chassis} bị trùng`)
      continue
    }
    seen.add(key)
    const price = parseNumber(rawPrice)
    const vat = parseNumber(rawVat)
    if (price === null || price <= 0) {
      result.invalidRows.push(
        `Dòng ${line} (${chassis}): ĐƠN GIÁ CHƯA VAT phải lớn hơn 0`,
      )
      continue
    }
    if (vat === null || vat < 0 || vat > 100) {
      result.invalidRows.push(`Dòng ${line} (${chassis}): % VAT phải từ 0 đến 100`)
      continue
    }
    result.rows.push({
      chassisNumber: chassis,
      priceBeforeVat: Math.round(price),
      vatRate: vat,
    })
  }
  return result
}
