/**
 * Parses bank statement rows pasted from Excel (tab-separated) or read from a
 * CSV file (comma / semicolon separated) into statement lines.
 *
 * Expected column order (header rows and rows without a valid date are skipped):
 *   Date | Reference | Description | Debit (money out) | Credit (money in) | Balance (optional)
 */

export interface ParsedStatementLine {
  transactionDate: string
  reference: string | null
  description: string | null
  debit: number
  credit: number
  balance: number | null
}

export interface StatementParseResult {
  lines: ParsedStatementLine[]
  /** 1-based row numbers that looked like data but could not be parsed */
  skippedRows: number[]
}

/** Accepts dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy and yyyy-mm-dd; returns yyyy-mm-dd or null */
export function parseStatementDate(raw: string): string | null {
  const s = raw.trim()
  let y: number, m: number, d: number
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  const vn = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s)
  if (iso) {
    y = Number(iso[1])
    m = Number(iso[2])
    d = Number(iso[3])
  } else if (vn) {
    d = Number(vn[1])
    m = Number(vn[2])
    y = Number(vn[3])
  } else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** VND has no decimals, so every separator ("1.234.567", "1,234,567", "1 234 567") is dropped */
export function parseStatementAmount(raw: string | undefined): number | null {
  const s = (raw ?? '').trim()
  if (s === '' || s === '-') return 0
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-')
  const digits = s.replace(/[^\d]/g, '')
  if (digits === '') return null
  const n = Number(digits)
  return negative ? -n : n
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n')
  if (sample.includes('\t')) return '\t'
  const semis = (sample.match(/;/g) ?? []).length
  const commas = (sample.match(/,/g) ?? []).length
  return semis > commas ? ';' : ','
}

/** Splits one delimited row, honouring double-quoted cells ("a, b") */
function splitRow(row: string, delimiter: string): string[] {
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (quoted && row[i + 1] === '"') {
        cur += '"'
        i++
      } else quoted = !quoted
    } else if (ch === delimiter && !quoted) {
      cells.push(cur)
      cur = ''
    } else cur += ch
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}

export function parseStatementText(text: string): StatementParseResult {
  const delimiter = detectDelimiter(text)
  const lines: ParsedStatementLine[] = []
  const skippedRows: number[] = []

  text.split(/\r?\n/).forEach((row, idx) => {
    if (row.trim() === '') return
    const [date, reference, description, debitRaw, creditRaw, balanceRaw] =
      splitRow(row, delimiter)
    const transactionDate = parseStatementDate(date ?? '')
    if (!transactionDate) {
      // Header rows and titles skip silently; a malformed date (e.g. 31/02) is reported
      if (/^\d/.test((date ?? '').trim())) skippedRows.push(idx + 1)
      return
    }

    const debit = parseStatementAmount(debitRaw)
    const credit = parseStatementAmount(creditRaw)
    const balance =
      balanceRaw === undefined || balanceRaw === ''
        ? null
        : parseStatementAmount(balanceRaw)
    if (
      debit === null ||
      credit === null ||
      debit < 0 ||
      credit < 0 ||
      (debit === 0 && credit === 0)
    ) {
      skippedRows.push(idx + 1)
      return
    }
    lines.push({
      transactionDate,
      reference: reference || null,
      description: description || null,
      debit,
      credit,
      balance,
    })
  })

  return { lines, skippedRows }
}
