/**
 * Excel (.xlsx) export for list pages (`/batches`, `/inventory`, `/sales`,
 * `/loans`, `/finance` 4 tabs, `/reconcile`, `/customers`).
 * Runs in the browser and downloads the file directly. Pages import this
 * module on demand so `xlsx` stays out of initial page bundles.
 */
import { utils, writeFile } from 'xlsx'
import type { CellObject } from 'xlsx'

import { formatVnd } from '#/lib/business.ts'

type CellValue = string | number | null

export interface ExcelColumn<T> {
  header: string
  width: number
  value: (item: T, index: number) => CellValue
  /** Excel number format of the data cells */
  format?: string
  /** Summed in the totals row using SUBTOTAL(109, ...) */
  sum?: boolean
}

export interface ExportTableOptions<T> {
  title: string
  sheetName: string
  filePrefix: string
  unitLabel: string
  items: T[]
  totalCount: number
  filters?: string[]
  columns: ExcelColumn<T>[]
}

export const MONEY_FORMAT = '#,##0'
export const INT_FORMAT = '#,##0'
export const DATE_FORMAT = 'dd/mm/yyyy'

/** 'yyyy-mm-dd' -> Excel date serial so Excel sorts and filters it as a real date */
export const excelDate = (value: string | null | undefined): number | null => {
  if (!value) return null
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000
}

const pad = (n: number) => String(n).padStart(2, '0')

export function downloadTableExcel<T>({
  title,
  sheetName,
  filePrefix,
  unitLabel,
  items,
  totalCount,
  filters = [],
  columns,
}: ExportTableOptions<T>) {
  const now = new Date()
  const lastCol = columns.length - 1

  const info = [
    title,
    filters.length > 0
      ? `Số lượng: ${items.length}/${totalCount} ${unitLabel} (bộ lọc: ${filters.join('; ')})`
      : `Số lượng: ${items.length}/${totalCount} ${unitLabel}`,
    `Ngày xuất file: ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
  ]

  // Empty rows separate info and totals from the table so Excel autofilter
  // does not include the totals row when sorting.
  const headerRow = info.length + 1
  const firstRow = headerRow + 1
  const lastRow = headerRow + items.length
  const totalRow = lastRow + 2

  const sheet = utils.aoa_to_sheet([
    ...info.map((line) => [line]),
    [],
    columns.map((col) => col.header),
    ...items.map((item, index) => columns.map((col) => col.value(item, index))),
  ])

  const columnRange = (c: number) =>
    utils.encode_range({ s: { r: firstRow, c }, e: { r: lastRow, c } })

  columns.forEach((col, c) => {
    if (col.format) {
      for (let r = firstRow; r <= lastRow; r++) {
        const cell = sheet[utils.encode_cell({ r, c })] as CellObject | undefined
        if (cell && typeof cell.v === 'number') cell.z = col.format
      }
    }
    if (col.sum) {
      sheet[utils.encode_cell({ r: totalRow, c })] = {
        t: 'n',
        v: items.reduce(
          (sum, item, index) => sum + (Number(col.value(item, index)) || 0),
          0,
        ),
        f: `SUBTOTAL(109,${columnRange(c)})`,
        z: col.format ?? MONEY_FORMAT,
      } satisfies CellObject
    }
  })

  const firstSumIdx = columns.findIndex((col) => col.sum)
  const labelEndCol = firstSumIdx > 0 ? firstSumIdx - 1 : Math.min(1, lastCol)
  sheet[utils.encode_cell({ r: totalRow, c: 0 })] = {
    t: 's',
    v: `Tổng cộng: ${items.length} ${unitLabel}`,
    f: `"Tổng cộng: "&SUBTOTAL(103,${columnRange(1)})&" ${unitLabel}"`,
  } satisfies CellObject

  sheet['!ref'] = utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRow, c: lastCol },
  })
  sheet['!merges'] = [
    ...info.map((_, r) => ({ s: { r, c: 0 }, e: { r, c: lastCol } })),
    ...(labelEndCol > 0
      ? [{ s: { r: totalRow, c: 0 }, e: { r: totalRow, c: labelEndCol } }]
      : []),
  ]
  sheet['!autofilter'] = {
    ref: utils.encode_range({
      s: { r: headerRow, c: 0 },
      e: { r: lastRow, c: lastCol },
    }),
  }
  sheet['!cols'] = columns.map((col) => ({ wch: col.width }))

  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31))
  const fileDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  writeFile(workbook, `${filePrefix}-${fileDate}.xlsx`, {
    compression: true,
  })
}

// 1. Batches (`/batches`)
export interface BatchExcelRow {
  importDate: string
  supplierName: string | null
  loanContractNumber: string | null
  vehicleCount: number
  totalImport: number
  totalExpense: number
  totalCost: number
  pricingBase: string
  pricingMethod: string
  pricingValue: number
}

export function downloadBatchesExcel(
  items: BatchExcelRow[],
  totalCount: number,
  filters?: string[],
) {
  downloadTableExcel({
    title: 'DANH SÁCH LÔ XE NHẬP KHẨU',
    sheetName: 'Lô xe nhập khẩu',
    filePrefix: 'danh-sach-lo-nhap',
    unitLabel: 'lô',
    items,
    totalCount,
    filters,
    columns: [
      { header: 'STT', width: 6, value: (_, i) => i + 1 },
      {
        header: 'Ngày Nhập',
        width: 14,
        format: DATE_FORMAT,
        value: (b) => excelDate(b.importDate),
      },
      {
        header: 'Nhà Cung Cấp',
        width: 28,
        value: (b) => b.supplierName || '—',
      },
      {
        header: 'Khế Ước Vay',
        width: 20,
        value: (b) => b.loanContractNumber || '—',
      },
      {
        header: 'Số Xe',
        width: 10,
        format: INT_FORMAT,
        sum: true,
        value: (b) => b.vehicleCount,
      },
      {
        header: 'Tiền Hàng',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (b) => b.totalImport,
      },
      {
        header: 'Chi Phí Lô',
        width: 18,
        format: MONEY_FORMAT,
        sum: true,
        value: (b) => b.totalExpense,
      },
      {
        header: 'Tổng Giá Vốn Lô',
        width: 22,
        format: MONEY_FORMAT,
        sum: true,
        value: (b) => b.totalCost,
      },
      {
        header: 'Cách Định Giá Bán',
        width: 30,
        value: (b) =>
          `${b.pricingBase === 'cost_price' ? 'Trên Giá Vốn' : 'Trên Giá Nhập Đã VAT'} ${
            b.pricingMethod === 'percent'
              ? `+${b.pricingValue}%`
              : `+${formatVnd(b.pricingValue)}`
          }`,
      },
    ],
  })
}

// 2. Inventory (`/inventory`)
export interface InventoryExcelRow {
  chassisNumber: string
  engineNumber: string
  modelName: string
  year?: number | null
  colorName: string
  batchLabel: string
  importPrice: number
  importPriceWithVat?: number | null
  costPrice: number
  isDelivered: boolean
  isInvoiced: boolean
  salesOrderId: number | null
  note: string | null
}

export function downloadInventoryExcel(
  items: InventoryExcelRow[],
  totalCount: number,
  filters?: string[],
) {
  downloadTableExcel({
    title: 'DANH SÁCH CHI TIẾT KHO XE',
    sheetName: 'Kho xe',
    filePrefix: 'danh-sach-kho-xe',
    unitLabel: 'xe',
    items,
    totalCount,
    filters,
    columns: [
      { header: 'STT', width: 6, value: (_, i) => i + 1 },
      { header: 'Số Khung', width: 22, value: (v) => v.chassisNumber },
      { header: 'Số Máy', width: 20, value: (v) => v.engineNumber },
      {
        header: 'Dòng xe / Màu',
        width: 28,
        value: (v) =>
          `${v.modelName}${v.year ? ` (${v.year})` : ''} / ${v.colorName}`,
      },
      { header: 'Lô Nhập', width: 28, value: (v) => v.batchLabel },
      {
        header: 'Đơn Giá Nhập',
        width: 18,
        format: MONEY_FORMAT,
        sum: true,
        value: (v) => v.importPriceWithVat ?? v.importPrice,
      },
      {
        header: 'Giá Vốn Xe',
        width: 18,
        format: MONEY_FORMAT,
        sum: true,
        value: (v) => v.costPrice,
      },
      {
        header: 'Trạng Thái',
        width: 16,
        value: (v) => (v.isDelivered ? 'Đã giao' : 'Chưa giao'),
      },
      {
        header: 'Trạng Thái HĐ',
        width: 16,
        value: (v) => (v.isInvoiced ? 'Đã HĐ' : 'Chưa HĐ'),
      },
      {
        header: 'Đơn Bán',
        width: 18,
        value: (v) => (v.salesOrderId ? `Phiếu bán #${v.salesOrderId}` : '—'),
      },
      { header: 'Ghi chú', width: 26, value: (v) => v.note || '—' },
    ],
  })
}

// 3. Sales Orders (`/sales`)
export interface SalesOrderListExcelRow {
  orderDate: string
  customerName: string
  branchName: string | null
  totalBeforeVat: number
  totalCost?: number
  minVatRate: number
  maxVatRate: number
  totalAmount: number
  vehicleCount: number
  deliveredCount: number
  invoicedCount: number
}

export function downloadSalesListExcel(
  items: SalesOrderListExcelRow[],
  totalCount: number,
  filters?: string[],
) {
  downloadTableExcel({
    title: 'DANH SÁCH PHIẾU BÁN XE',
    sheetName: 'Phiếu bán xe',
    filePrefix: 'danh-sach-phieu-ban',
    unitLabel: 'phiếu',
    items,
    totalCount,
    filters,
    columns: [
      { header: 'STT', width: 6, value: (_, i) => i + 1 },
      {
        header: 'Ngày Bán',
        width: 14,
        format: DATE_FORMAT,
        value: (o) => excelDate(o.orderDate),
      },
      { header: 'Khách Hàng', width: 28, value: (o) => o.customerName },
      {
        header: 'Điểm Bán Nhận Xe',
        width: 24,
        value: (o) => o.branchName || 'Trực tiếp',
      },
      {
        header: 'Tổng Tiền Chưa VAT',
        width: 22,
        format: MONEY_FORMAT,
        sum: true,
        value: (o) => o.totalBeforeVat,
      },
      {
        header: '% VAT',
        width: 12,
        value: (o) =>
          o.minVatRate === o.maxVatRate
            ? `${o.minVatRate}%`
            : `${o.minVatRate}–${o.maxVatRate}%`,
      },
      {
        header: 'Tổng Tiền Đã VAT',
        width: 22,
        format: MONEY_FORMAT,
        sum: true,
        value: (o) => o.totalAmount,
      },
      {
        header: 'Giá Vốn',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (o) => o.totalCost ?? 0,
      },
      {
        header: 'Số Xe',
        width: 10,
        format: INT_FORMAT,
        sum: true,
        value: (o) => o.vehicleCount,
      },
      {
        header: 'Kho Thực Tế',
        width: 18,
        value: (o) =>
          o.deliveredCount === o.vehicleCount
            ? 'Đã giao đủ'
            : `Đã giao ${o.deliveredCount}/${o.vehicleCount}`,
      },
      {
        header: 'Kho Hóa Đơn',
        width: 18,
        value: (o) =>
          o.invoicedCount === o.vehicleCount
            ? 'Đã lập HĐ'
            : o.invoicedCount === 0
              ? `Chưa ra HĐ 0/${o.vehicleCount}`
              : `Đã lập HĐ ${o.invoicedCount}/${o.vehicleCount}`,
      },
    ],
  })
}

// 4. Loans (`/loans`)
export interface LoanExcelRow {
  contractNumber: string
  bankName: string | null
  accountNumber: string | null
  interestRate: number
  termMonths: number
  principalPaid: number
  outstanding: number
}

export function downloadLoansExcel(
  items: LoanExcelRow[],
  totalCount: number,
  filters?: string[],
) {
  downloadTableExcel({
    title: 'DANH SÁCH KHẾ ƯỚC VAY NGÂN HÀNG',
    sheetName: 'Khế ước vay',
    filePrefix: 'danh-sach-khe-uoc-vay',
    unitLabel: 'khế ước',
    items,
    totalCount,
    filters,
    columns: [
      { header: 'STT', width: 6, value: (_, i) => i + 1 },
      { header: 'Số Khế Ước', width: 22, value: (l) => l.contractNumber },
      {
        header: 'Ngân Hàng',
        width: 32,
        value: (l) =>
          l.bankName
            ? l.accountNumber
              ? `${l.bankName} (STK: ${l.accountNumber})`
              : l.bankName
            : l.accountNumber || '—',
      },
      {
        header: 'Lãi Suất',
        width: 14,
        value: (l) => `${l.interestRate}%/năm`,
      },
      {
        header: 'Kỳ Hạn',
        width: 14,
        value: (l) => `${l.termMonths} tháng`,
      },
      {
        header: 'Gốc Đã Trả',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (l) => l.principalPaid,
      },
      {
        header: 'Dư Nợ Còn Lại',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (l) => l.outstanding,
      },
    ],
  })
}

// 5a. Finance - Tab 1: Accounts Receivable (`/finance?tab=receivables`)
export interface ReceivableExcelRow {
  customerName: string
  branchId: number | null
  entityName: string
  sold: number
  paid: number
  balance: number
}

export function downloadReceivablesExcel(
  items: ReceivableExcelRow[],
  totalCount: number,
  filters?: string[],
) {
  downloadTableExcel({
    title: 'CÔNG NỢ PHẢI THU THEO PHÁP NHÂN NHẬN XE',
    sheetName: 'Công nợ phải thu',
    filePrefix: 'cong-no-phai-thu',
    unitLabel: 'đầu mối',
    items,
    totalCount,
    filters,
    columns: [
      { header: 'STT', width: 6, value: (_, i) => i + 1 },
      { header: 'Khách Hàng', width: 28, value: (r) => r.customerName },
      {
        header: 'Pháp Nhân Điểm Bán Chịu Nợ',
        width: 28,
        value: (r) => (r.branchId ? r.entityName : 'Pháp nhân chính KH mẹ'),
      },
      {
        header: 'Tổng Mua Xe',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (r) => r.sold,
      },
      {
        header: 'Đã Thanh Toán',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (r) => r.paid,
      },
      {
        header: 'Dư Nợ Còn Lại',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (r) => r.balance,
      },
    ],
  })
}

// 5b. Finance - Tab 2: Accounts Payable (`/finance?tab=payables`)
export interface PayableExcelRow {
  supplierName: string
  purchased: number
  paid: number
  balance: number
}

export function downloadPayablesExcel(
  items: PayableExcelRow[],
  totalCount: number,
  filters?: string[],
) {
  downloadTableExcel({
    title: 'CÔNG NỢ PHẢI TRẢ CHO NHÀ CUNG CẤP XE',
    sheetName: 'Công nợ phải trả',
    filePrefix: 'cong-no-phai-tra',
    unitLabel: 'nhà cung cấp',
    items,
    totalCount,
    filters,
    columns: [
      { header: 'STT', width: 6, value: (_, i) => i + 1 },
      { header: 'Nhà Cung Cấp', width: 32, value: (p) => p.supplierName },
      {
        header: 'Tổng Tiền Hàng',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (p) => p.purchased,
      },
      {
        header: 'Đã Thanh Toán',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (p) => p.paid,
      },
      {
        header: 'Còn Nợ NCC',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (p) => p.balance,
      },
    ],
  })
}

// 5c. Finance - Tab 3: Receipt Vouchers (`/finance?tab=receipts`)
export interface ReceiptExcelRow {
  receiptDate: string
  customerName: string
  branchName: string | null
  amount: number
  bankName: string | null
  accountNumber: string | null
  note?: string | null
}

export function downloadReceiptsExcel(
  items: ReceiptExcelRow[],
  totalCount: number,
  filters?: string[],
) {
  downloadTableExcel({
    title: 'LỊCH SỬ PHIẾU THU TIỀN BÁN XE',
    sheetName: 'Phiếu thu',
    filePrefix: 'lich-su-phieu-thu',
    unitLabel: 'phiếu thu',
    items,
    totalCount,
    filters,
    columns: [
      { header: 'STT', width: 6, value: (_, i) => i + 1 },
      {
        header: 'Ngày Thu',
        width: 14,
        format: DATE_FORMAT,
        value: (r) => excelDate(r.receiptDate),
      },
      { header: 'Khách Hàng', width: 28, value: (r) => r.customerName },
      {
        header: 'Điểm Bán Thanh Toán',
        width: 24,
        value: (r) => r.branchName ?? 'Trực tiếp',
      },
      {
        header: 'Số Tiền Thu',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (r) => r.amount,
      },
      {
        header: 'Tài Khoản Nhận',
        width: 30,
        value: (r) =>
          r.accountNumber
            ? r.bankName
              ? `${r.bankName} - ${r.accountNumber}`
              : r.accountNumber
            : '—',
      },
      { header: 'Ghi Chú', width: 36, value: (r) => r.note || '—' },
    ],
  })
}

// 5d. Finance - Tab 4: Payment Vouchers (`/finance?tab=payments`)
export interface PaymentExcelRow {
  paymentDate: string
  supplierName: string | null
  payeeName: string | null
  amount: number
  description: string | null
}

export function downloadPaymentsExcel(
  items: PaymentExcelRow[],
  totalCount: number,
  filters?: string[],
) {
  downloadTableExcel({
    title: 'LỊCH SỬ PHIẾU CHI',
    sheetName: 'Phiếu chi',
    filePrefix: 'lich-su-phieu-chi',
    unitLabel: 'phiếu chi',
    items,
    totalCount,
    filters,
    columns: [
      { header: 'STT', width: 6, value: (_, i) => i + 1 },
      {
        header: 'Ngày Chi',
        width: 14,
        format: DATE_FORMAT,
        value: (p) => excelDate(p.paymentDate),
      },
      {
        header: 'Đối Tượng Nhận',
        width: 30,
        value: (p) => (p.supplierName ?? p.payeeName) || '—',
      },
      {
        header: 'Số Tiền Chi',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (p) => p.amount,
      },
      {
        header: 'Ghi Chú',
        width: 36,
        value: (p) => p.description || '—',
      },
    ],
  })
}

// 6. Bank Statement Reconciliation (`/reconcile`)
export interface ReconcileExcelRow {
  transactionDate: string
  bankShortName?: string | null
  bankCode?: string | null
  bankName: string
  accountNumber: string
  description: string | null
  debit: number
  credit: number
  status: string
  matchedLabel: string
}

export function downloadReconcileExcel(
  items: ReconcileExcelRow[],
  totalCount: number,
  filters?: string[],
) {
  downloadTableExcel({
    title: 'DANH SÁCH GIAO DỊCH SAO KÊ NGÂN HÀNG',
    sheetName: 'Sao kê ngân hàng',
    filePrefix: 'doi-chieu-sao-ke',
    unitLabel: 'giao dịch',
    items,
    totalCount,
    filters,
    columns: [
      { header: 'STT', width: 6, value: (_, i) => i + 1 },
      {
        header: 'Ngày GD',
        width: 14,
        format: DATE_FORMAT,
        value: (l) => excelDate(l.transactionDate),
      },
      {
        header: 'Tài Khoản',
        width: 28,
        value: (l) =>
          `${l.bankShortName || l.bankCode || l.bankName} (${l.accountNumber})`,
      },
      {
        header: 'Nội Dung Diễn Giải',
        width: 38,
        value: (l) => l.description || '—',
      },
      {
        header: 'Tiền Ra (Ghi Nợ)',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (l) => l.debit,
      },
      {
        header: 'Tiền Vào (Ghi Có)',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (l) => l.credit,
      },
      {
        header: 'Đối Chiếu',
        width: 24,
        value: (l) => l.matchedLabel,
      },
    ],
  })
}

// 7. Customers (`/customers`)
export interface CustomerExcelRow {
  name: string
  branchCount: number
  balance: number
}

export function downloadCustomersExcel(
  items: CustomerExcelRow[],
  totalCount: number,
  filters?: string[],
) {
  downloadTableExcel({
    title: 'DANH SÁCH KHÁCH HÀNG',
    sheetName: 'Khách hàng',
    filePrefix: 'danh-sach-khach-hang',
    unitLabel: 'khách hàng',
    items,
    totalCount,
    filters,
    columns: [
      { header: 'STT', width: 6, value: (_, i) => i + 1 },
      { header: 'Tên Khách Hàng', width: 32, value: (c) => c.name },
      {
        header: 'Số Điểm Bán',
        width: 16,
        format: INT_FORMAT,
        sum: true,
        value: (c) => c.branchCount,
      },
      {
        header: 'Còn Nợ',
        width: 20,
        format: MONEY_FORMAT,
        sum: true,
        value: (c) => c.balance,
      },
    ],
  })
}

