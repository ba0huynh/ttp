import * as XLSX from 'xlsx'

export interface ImportedVehicle {
  modelId: number
  colorId: number
  chassisNumber: string
  engineNumber: string
  year: number | null
  importPrice: number
  vatRate: number
  modelName: string
  colorName: string
}

export interface MasterModelRef {
  id: number
  name: string
}

export interface MasterColorRef {
  id: number
  name: string
}

/**
 * Generates and triggers browser download of the sample vehicle import spreadsheet.
 * Matches the official sample spreadsheet provided by the client:
 * Columns: STT | TÊN HÀNG | SK | SM | MÀU SƠN | NĂM | GIÁ NHẬP
 */
export function downloadVehicleTemplate(): void {
  const headers = ['STT', 'TÊN HÀNG', 'SK', 'SM', 'MÀU SƠN', 'NĂM', 'GIÁ NHẬP', '% VAT']
  const sampleData = [
    [1, 'SIRIUS FI', 'RLCUE4110TY409827', 'E34CE - 554148', 'XANH BẠC ĐEN', 2026, 29600000, 10],
    [2, 'SIRIUS FI', 'RLCUE4110TY409822', 'E34CE - 554143', 'XANH BẠC ĐEN', 2027, 29600000, 10],
    [3, 'SIRIUS FI', 'RLCUE4110TY444318', 'E34CE - 603840', 'ĐEN XÁM', 2027, 29600000, 10],
    [4, 'SIRIUS FI', 'RLCUE4110TY444320', 'E34CE - 603842', 'ĐEN XÁM', 2027, 29600000, 10],
    [5, 'SIRIUS FI', 'RLCUE4110TY424477', 'E34CE - 575348', 'ĐỎ ĐEN', 2027, 29600000, 10],
    [6, 'SIRIUS FI', 'RLCUE4110TY424489', 'E34CE - 575360', 'ĐỎ ĐEN', 2027, 29600000, 10],
    [7, 'SIRIUS FI', 'RLCUE4110TY445723', 'E34CE - 605546', 'ĐỎ ĐEN', 2027, 29600000, 10],
  ]

  const wsData = [headers, ...sampleData]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Configure column widths for readability
  ws['!cols'] = [
    { wch: 6 }, // STT
    { wch: 18 }, // TÊN HÀNG
    { wch: 22 }, // SK
    { wch: 18 }, // SM
    { wch: 18 }, // MÀU SƠN
    { wch: 10 }, // NĂM
    { wch: 16 }, // GIÁ NHẬP
    { wch: 10 }, // % VAT
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'MauNhapXe')

  // Export file
  XLSX.writeFile(wb, 'mau-nhap-xe.xlsx')
}

/**
 * Compares two strings case-insensitively with Vietnamese diacritics preserved.
 */
function normalizeText(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val).trim().toLowerCase()
}

/**
 * Parses numeric price string or number (e.g. "29,600,000", "29.600.000", 29600000).
 */
function parsePrice(val: unknown): number {
  if (typeof val === 'number') return Math.max(0, val)
  if (!val) return 0
  const clean = String(val).replace(/[^\d]/g, '')
  return clean ? Number(clean) : 0
}

/**
 * Parses year integer (e.g. 2026, "2027").
 */
function parseYear(val: unknown): number | null {
  if (typeof val === 'number') {
    const y = Math.floor(val)
    return y >= 1900 && y <= 2100 ? y : null
  }
  if (!val) return null
  const clean = String(val).replace(/[^\d]/g, '')
  if (!clean) return null
  const y = parseInt(clean, 10)
  return y >= 1900 && y <= 2100 ? y : null
}

interface ColumnIndexMap {
  model: number
  chassis: number
  engine: number
  color: number
  year: number
  price: number
  vat?: number
}

function parseVat(val: unknown): number {
  if (typeof val === 'number') return Math.min(100, Math.max(0, val))
  if (!val) return 10
  const clean = String(val).replace(/[^\d.]/g, '')
  return clean ? Math.min(100, Math.max(0, Number(clean))) : 10
}

function findHeaderIndices(headerRow: unknown[]): ColumnIndexMap | null {
  const map: Partial<ColumnIndexMap> = {}

  headerRow.forEach((col, idx) => {
    const name = normalizeText(col)
    if (!name) return

    // Model name
    if (
      name.includes('tên hàng') ||
      name.includes('ten hang') ||
      name.includes('dòng xe') ||
      name.includes('dong xe') ||
      name === 'model'
    ) {
      if (map.model === undefined) map.model = idx
    }
    // Chassis number (SK / Số khung)
    else if (
      name === 'sk' ||
      name.includes('số khung') ||
      name.includes('so khung') ||
      name === 'vin'
    ) {
      if (map.chassis === undefined) map.chassis = idx
    }
    // Engine number (SM / Số máy)
    else if (
      name === 'sm' ||
      name.includes('số máy') ||
      name.includes('so may') ||
      name.includes('engine')
    ) {
      if (map.engine === undefined) map.engine = idx
    }
    // Color (Màu sơn / Màu xe)
    else if (
      name.includes('màu') ||
      name.includes('mau') ||
      name === 'color'
    ) {
      if (map.color === undefined) map.color = idx
    }
    // Year (Năm / Năm sản xuất / Đời xe)
    else if (
      name === 'năm' ||
      name === 'nam' ||
      name.includes('đời') ||
      name.includes('doi') ||
      name === 'year'
    ) {
      if (map.year === undefined) map.year = idx
    }
    // Price (Giá nhập / Đơn giá)
    else if (
      name.includes('giá nhập') ||
      name.includes('gia nhap') ||
      name.includes('đơn giá') ||
      name.includes('don gia') ||
      name === 'price'
    ) {
      if (map.price === undefined) map.price = idx
    }
    // VAT (% VAT / Thuế VAT)
    else if (
      name === 'vat' ||
      name.includes('% vat') ||
      name.includes('thuế vat') ||
      name.includes('thue vat') ||
      name.includes('vat')
    ) {
      if (map.vat === undefined) map.vat = idx
    }
  })

  // Mandatory columns: chassis and engine
  if (
    map.chassis === undefined ||
    map.engine === undefined
  ) {
    return null
  }

  return {
    model: map.model ?? -1,
    chassis: map.chassis,
    engine: map.engine,
    color: map.color ?? -1,
    year: map.year ?? -1,
    price: map.price ?? -1,
    vat: map.vat,
  }
}

/**
 * Parses an Excel file and returns an array of vehicle records.
 * Auto-creates models and colors that do not exist yet.
 */
export async function parseVehicleExcel(
  file: File,
  options: {
    models: MasterModelRef[]
    colors: MasterColorRef[]
    onAutoCreateModel: (name: string) => Promise<number>
    onAutoCreateColor: (name: string) => Promise<number>
  },
): Promise<ImportedVehicle[]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  const firstSheetName = wb.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('File Excel không có trang tính (sheet) nào')
  }

  const sheet = wb.Sheets[firstSheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
  })

  if (rows.length < 2) {
    throw new Error('File Excel không có dữ liệu để import')
  }

  // Find header row in first 5 rows
  let headerIndex = -1
  let colMap: ColumnIndexMap | null = null

  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const candidateMap = findHeaderIndices(rows[i])
    if (candidateMap) {
      headerIndex = i
      colMap = candidateMap
      break
    }
  }

  if (!colMap || headerIndex === -1) {
    throw new Error(
      'Không nhận diện được tiêu đề các cột trong file Excel. Vui lòng tải file mẫu để đảm bảo đúng định dạng (cần có các cột: SK, SM, TÊN HÀNG, MÀU SƠN, NĂM, GIÁ NHẬP).',
    )
  }

  // Build mutable lookups for models and colors (diacritics-preserving lowercase)
  const modelLookup = new Map<string, number>()
  for (const m of options.models) {
    modelLookup.set(normalizeText(m.name), m.id)
  }

  const colorLookup = new Map<string, number>()
  for (const c of options.colors) {
    colorLookup.set(normalizeText(c.name), c.id)
  }

  const result: ImportedVehicle[] = []
  const dataRows = rows.slice(headerIndex + 1)

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r]
    if (!row || row.length === 0) continue

    const chassisRaw = colMap.chassis >= 0 ? String(row[colMap.chassis] ?? '').trim().toUpperCase() : ''
    const engineRaw = colMap.engine >= 0 ? String(row[colMap.engine] ?? '').trim().toUpperCase() : ''

    // Skip empty lines
    if (!chassisRaw && !engineRaw) continue

    if (!chassisRaw) {
      throw new Error(`Dòng ${r + headerIndex + 2}: Thiếu số khung (SK)`)
    }
    if (!engineRaw) {
      throw new Error(`Dòng ${r + headerIndex + 2}: Thiếu số máy (SM)`)
    }

    const modelRaw = colMap.model >= 0 ? String(row[colMap.model] ?? '').trim() : ''
    const colorRaw = colMap.color >= 0 ? String(row[colMap.color] ?? '').trim() : ''
    const yearRaw = colMap.year >= 0 ? row[colMap.year] : null
    const priceRaw = colMap.price >= 0 ? row[colMap.price] : null

    // 1. Resolve or auto-create Model
    let modelId = 0
    let finalModelName = modelRaw
    if (modelRaw) {
      const normModel = normalizeText(modelRaw)
      if (modelLookup.has(normModel)) {
        modelId = modelLookup.get(normModel)!
      } else {
        // Auto-create model
        modelId = await options.onAutoCreateModel(modelRaw)
        modelLookup.set(normModel, modelId)
      }
    }

    // 2. Resolve or auto-create Color
    let colorId = 0
    let finalColorName = colorRaw
    if (colorRaw) {
      const normColor = normalizeText(colorRaw)
      if (colorLookup.has(normColor)) {
        colorId = colorLookup.get(normColor)!
      } else {
        // Auto-create color
        colorId = await options.onAutoCreateColor(colorRaw)
        colorLookup.set(normColor, colorId)
      }
    } else {
      // Default to first color if available, or a fallback
      if (options.colors.length > 0) {
        colorId = options.colors[0].id
        finalColorName = options.colors[0].name
      }
    }

    const year = parseYear(yearRaw)
    const importPrice = parsePrice(priceRaw)
    const vatRate =
      colMap.vat !== undefined && colMap.vat >= 0 ? parseVat(row[colMap.vat]) : 10

    result.push({
      modelId,
      colorId,
      chassisNumber: chassisRaw,
      engineNumber: engineRaw,
      year,
      importPrice,
      vatRate,
      modelName: finalModelName,
      colorName: finalColorName,
    })
  }

  if (result.length === 0) {
    throw new Error('Không tìm thấy dòng xe hợp lệ nào trong file Excel')
  }

  return result
}
