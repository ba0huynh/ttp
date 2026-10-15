import { db } from '../index.ts'
import { normalizeBankName, seedBanks } from './bank.seed.ts'
import {
  companyBankAccounts,
  suppliers,
  motorcycleModels,
  colors,
} from '../schema.ts'

/** Looks up an existing row by its `name`, throwing if a previous seed run is missing one */
function byName<T extends { name: string }>(rows: T[], name: string): T {
  const row = rows.find((r) => r.name === name)
  if (!row) {
    throw new Error(
      `Expected existing master data row "${name}" but found none. The table has partial data from a previous run — drop it and reseed.`,
    )
  }
  return row
}

/** Banks: matched by name ignoring case, because older rows differ from VietQR only in capitalisation */
const bankByName = (rows: { name: string; id: number }[], n: string) => {
  const row = rows.find(
    (r) => normalizeBankName(r.name) === normalizeBankName(n),
  )
  if (!row) throw new Error(`Expected bank "${n}" but found none`)
  return row
}

const BANK_VCB = 'Ngân hàng TMCP Ngoại Thương Việt Nam'
const BANK_BIDV = 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam'
const BANK_TCB = 'Ngân hàng TMCP Kỹ thương Việt Nam'

/**
 * Seeds master catalog data:
 * - Commercial bank catalog (all VietQR banks, see `banks.ts`) and company bank accounts
 * - Overseas motorcycle manufacturers / suppliers
 * - Vehicle models and color variations
 *
 * Idempotent: the bank catalog is topped up with any missing banks every run;
 * the rest (accounts, suppliers, models, colors are seeded together as one
 * batch) is skipped if `company_bank_accounts` already has rows.
 */
export async function seedMasterData() {
  const allBanks = await seedBanks()
  const existingAccounts = await db.select().from(companyBankAccounts)
  if (existingAccounts.length > 0) {
    console.log(' -> Master data already seeded, skipping...')
    const existingSuppliers = await db.select().from(suppliers)
    const existingModels = await db.select().from(motorcycleModels)
    const existingColors = await db.select().from(colors)

    return {
      banks: {
        vcb: bankByName(allBanks, BANK_VCB),
        bidv: bankByName(allBanks, BANK_BIDV),
        tcb: bankByName(allBanks, BANK_TCB),
      },
      companyBankAccounts: {
        vcbAccount: existingAccounts.find(
          (a) => a.accountNumber === '0071001234567',
        )!,
        bidvAccount: existingAccounts.find(
          (a) => a.accountNumber === '13510009876543',
        )!,
      },
      suppliers: {
        supplierThai: byName(
          existingSuppliers,
          'Thai Honda Manufacturing Co., Ltd',
        ),
        supplierIndo: byName(existingSuppliers, 'PT Astra Honda Motor'),
      },
      models: {
        modelSh: byName(existingModels, 'Honda SH 150i ABS'),
        modelWave: byName(existingModels, 'Honda Wave 125i Thái'),
        modelVario: byName(existingModels, 'Honda Vario 160 CBS'),
        modelScoopy: byName(existingModels, 'Honda Scoopy Club12'),
      },
      colors: {
        cRed: byName(existingColors, 'Đỏ Đô'),
        cWhite: byName(existingColors, 'Trắng Ngọc Trai'),
        cBlack: byName(existingColors, 'Đen Mờ (Matte Black)'),
        cGrey: byName(existingColors, 'Xám Xi Măng'),
      },
    }
  }

  console.log(' -> Seeding company bank accounts...')
  const vcb = bankByName(allBanks, BANK_VCB)
  const bidv = bankByName(allBanks, BANK_BIDV)
  const tcb = bankByName(allBanks, BANK_TCB)

  const insertedAccounts = await db
    .insert(companyBankAccounts)
    .values([
      {
        bankId: vcb.id,
        accountNumber: '0071001234567',
        accountName: 'CONG TY TNHH KD DV TRUONG THINH PHAT',
        branch: 'Chi nhánh TP.HCM',
        isActive: true,
      },
      {
        bankId: bidv.id,
        accountNumber: '13510009876543',
        accountName: 'CONG TY TNHH KD DV TRUONG THINH PHAT',
        branch: 'Chi nhánh Nam Kỳ Khởi Nghĩa',
        isActive: true,
      },
    ])
    .$returningId()

  const [vcbAccount, bidvAccount] = insertedAccounts

  console.log(' -> Seeding suppliers catalog...')
  const insertedSuppliers = await db
    .insert(suppliers)
    .values([
      {
        name: 'Thai Honda Manufacturing Co., Ltd',
        taxCode: 'TH0105508001234',
        address: '410 Lat Krabang Industrial Estate, Bangkok, Thailand',
      },
      {
        name: 'PT Astra Honda Motor',
        taxCode: 'ID010002345678000',
        address: 'Jl. Laksda Yos Sudarso, Sunter 1, Jakarta, Indonesia',
      },
    ])
    .$returningId()

  const [supplierThai, supplierIndo] = insertedSuppliers

  console.log(' -> Seeding motorcycle models and colors...')
  const insertedModels = await db
    .insert(motorcycleModels)
    .values([
      {
        name: 'Honda SH 150i ABS',
        description: 'Dòng xe tay ga cao cấp nhập khẩu nguyên chiếc',
      },
      {
        name: 'Honda Wave 125i Thái',
        description: 'Dòng xe số bền bỉ, tiết kiệm xăng nhập khẩu Thái Lan',
      },
      {
        name: 'Honda Vario 160 CBS',
        description: 'Dòng xe tay ga thể thao nhập khẩu Indonesia',
      },
      {
        name: 'Honda Scoopy Club12',
        description: 'Dòng xe tay ga thời trang cổ điển phong cách trẻ',
      },
    ])
    .$returningId()

  const [modelSh, modelWave, modelVario, modelScoopy] = insertedModels

  const insertedColors = await db
    .insert(colors)
    .values([
      { name: 'Đỏ Đô', hex: '#990000' },
      { name: 'Trắng Ngọc Trai', hex: '#f8fafc' },
      { name: 'Đen Mờ (Matte Black)', hex: '#18181b' },
      { name: 'Xám Xi Măng', hex: '#64748b' },
    ])
    .$returningId()

  const [cRed, cWhite, cBlack, cGrey] = insertedColors

  return {
    banks: { vcb, bidv, tcb },
    companyBankAccounts: { vcbAccount, bidvAccount },
    suppliers: { supplierThai, supplierIndo },
    models: { modelSh, modelWave, modelVario, modelScoopy },
    colors: { cRed, cWhite, cBlack, cGrey },
  }
}
