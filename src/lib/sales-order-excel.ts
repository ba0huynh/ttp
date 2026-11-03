/**
 * Excel (.xlsx) export of the vehicles of one sales order (`/sales/$orderId`).
 * Runs in the browser and downloads the file directly. The page imports this
 * module on demand, so `xlsx` is only loaded when "Xuất Excel" is clicked.
 */
import { utils, writeFile } from 'xlsx'
import type { CellObject } from 'xlsx'

import { formatDate } from '#/lib/business.ts'

export interface SalesOrderExcelOrder {
  id: number
  customerName: string
  branchName: string | null
  orderDate: string
}

export interface SalesOrderExcelItem {
  chassisNumber: string
  engineNumber: string | null
  modelName: string | null
  colorName: string | null
  priceBeforeVat: number
  vatRate: number
  unitPrice: number
  isDelivered: boolean
  deliveredAt: string | null
  deliveryNoteNumber: string | null
  receiverName: string | null
  transportInfo: string | null
  isInvoiced: boolean
  invoicedAt: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
}

export interface SalesOrderExcelInput {
  order: SalesOrderExcelOrder
  /** Vehicles to export (the list currently shown on screen) */
  items: SalesOrderExcelItem[]
  /** Number of vehicles in the whole order */
  totalInOrder: number
  /** Active filters in words; empty when the full list is exported */
  filters: string[]
}

type CellValue = string | number | null

interface Column {
  header: string
  width: number
  value: (item: SalesOrderExcelItem, index: number) => CellValue
  /** Excel number format of the data cells */
  format?: string
  /** Summed in the totals row */
  sum?: boolean
}

const MONEY_FORMAT = '#,##0'
const DATE_FORMAT = 'dd/mm/yyyy'

/** 'yyyy-mm-dd' -> Excel date serial, so Excel sorts and filters it as a real date */
const excelDate = (value: string | null | undefined): number | null => {
  if (!value) return null
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000
}

const pad = (n: number) => String(n).padStart(2, '0')

const COLUMNS: Column[] = [
  { header: 'STT', width: 6, value: (_, index) => index + 1 },
  { header: 'Số khung', width: 24, value: (v) => v.chassisNumber },
  { header: 'Số máy', width: 22, value: (v) => v.engineNumber },
  { header: 'Dòng xe', width: 25, value: (v) => v.modelName || null },
  { header: 'Màu xe', width: 20, value: (v) => v.colorName },
  {
    header: 'Đơn giá chưa VAT (VNĐ)',
    width: 26,
    format: MONEY_FORMAT,
    sum: true,
    value: (v) => v.priceBeforeVat,
  },
  { header: '% VAT', width: 10, value: (v) => v.vatRate },
  {
    header: 'Tiền VAT (VNĐ)',
    width: 20,
    format: MONEY_FORMAT,
    sum: true,
    value: (v) => v.unitPrice - v.priceBeforeVat,
  },
  {
    header: 'Đơn giá bán đã VAT (VNĐ)',
    width: 28,
    format: MONEY_FORMAT,
    sum: true,
    value: (v) => v.unitPrice,
  },
  {
    header: 'Trạng thái giao xe',
    width: 20,
    value: (v) => (v.isDelivered ? 'Đã giao' : 'Chưa giao'),
  },
  {
    header: 'Ngày giao xe',
    width: 16,
    format: DATE_FORMAT,
    value: (v) => (v.isDelivered ? excelDate(v.deliveredAt) : null),
  },
  {
    header: 'Mã phiếu giao',
    width: 20,
    value: (v) => (v.isDelivered ? v.deliveryNoteNumber : null),
  },
  {
    header: 'Người / tài xế nhận xe',
    width: 26,
    value: (v) => (v.isDelivered ? v.receiverName : null),
  },
  {
    header: 'Phương tiện / biển số xe tải',
    width: 30,
    value: (v) => (v.isDelivered ? v.transportInfo : null),
  },
  {
    header: 'Trạng thái hóa đơn',
    width: 21,
    value: (v) => (v.isInvoiced ? 'Đã HĐ' : 'Chưa HĐ'),
  },
  {
    header: 'Số hóa đơn',
    width: 22,
    value: (v) => (v.isInvoiced ? v.invoiceNumber : null),
  },
  {
    header: 'Ngày xuất HĐ',
    width: 18,
    format: DATE_FORMAT,
    value: (v) =>
      v.isInvoiced ? excelDate(v.invoiceDate ?? v.invoicedAt) : null,
  },
]

export function downloadSalesOrderExcel({
  order,
  items,
  totalInOrder,
  filters,
}: SalesOrderExcelInput) {
  const now = new Date()
  const lastCol = COLUMNS.length - 1

  // Order details above the table, so the file still makes sense on its own
  const info = [
    `DANH SÁCH XE - PHIẾU BÁN #${order.id}`,
    `Khách hàng: ${order.customerName}`,
    `Điểm bán: ${order.branchName ?? 'Trực tiếp'}`,
    `Ngày bán: ${formatDate(order.orderDate)}`,
    filters.length > 0
      ? `Số xe: ${items.length}/${totalInOrder} xe (bộ lọc: ${filters.join('; ')})`
      : `Số xe: ${items.length} xe`,
    `Ngày xuất file: ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
  ]

  // Row positions (0-based). Empty rows separate the details and the totals
  // from the table; Excel stretches the autofilter over any touching row, and
  // sorting would then move the totals into the data.
  const headerRow = info.length + 1
  const firstRow = headerRow + 1
  const lastRow = headerRow + items.length
  const totalRow = lastRow + 2

  const sheet = utils.aoa_to_sheet([
    ...info.map((line) => [line]),
    [],
    COLUMNS.map((col) => col.header),
    ...items.map((item, index) => COLUMNS.map((col) => col.value(item, index))),
  ])

  const columnRange = (c: number) =>
    utils.encode_range({ s: { r: firstRow, c }, e: { r: lastRow, c } })

  COLUMNS.forEach((col, c) => {
    if (col.format) {
      for (let r = firstRow; r <= lastRow; r++) {
        const cell = sheet[utils.encode_cell({ r, c })] as CellObject | undefined
        if (cell) cell.z = col.format
      }
    }
    // SUBTOTAL ignores rows hidden by the Excel filter, so totals follow it
    if (col.sum) {
      sheet[utils.encode_cell({ r: totalRow, c })] = {
        t: 'n',
        v: items.reduce(
          (sum, item, index) => sum + (Number(col.value(item, index)) || 0),
          0,
        ),
        f: `SUBTOTAL(109,${columnRange(c)})`,
        z: MONEY_FORMAT,
      } satisfies CellObject
    }
  })

  // Totals label spans the columns before the first summed column
  const labelEndCol = COLUMNS.findIndex((col) => col.sum) - 1
  sheet[utils.encode_cell({ r: totalRow, c: 0 })] = {
    t: 's',
    v: `Tổng cộng: ${items.length} xe`,
    f: `"Tổng cộng: "&SUBTOTAL(103,${columnRange(1)})&" xe"`,
  } satisfies CellObject

  sheet['!ref'] = utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRow, c: lastCol },
  })
  sheet['!merges'] = [
    ...info.map((_, r) => ({ s: { r, c: 0 }, e: { r, c: lastCol } })),
    { s: { r: totalRow, c: 0 }, e: { r: totalRow, c: labelEndCol } },
  ]
  sheet['!autofilter'] = {
    ref: utils.encode_range({
      s: { r: headerRow, c: 0 },
      e: { r: lastRow, c: lastCol },
    }),
  }
  sheet['!cols'] = COLUMNS.map((col) => ({ wch: col.width }))

  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, sheet, 'Danh sách xe')
  const fileDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  writeFile(workbook, `phieu-ban-${order.id}-xe-${fileDate}.xlsx`, {
    compression: true,
  })
}
