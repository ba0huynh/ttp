import { db } from '../index.ts'
import {
  banks,
  companyBankAccounts,
  suppliers,
  motorcycleModels,
  colors,
} from '../schema.ts'

/**
 * Seeds master catalog data:
 * - Commercial banks and company bank accounts
 * - Overseas motorcycle manufacturers / suppliers
 * - Vehicle models and color variations
 */
export async function seedMasterData() {
  console.log(' -> Seeding banks and company bank accounts...')
  const insertedBanks = await db
    .insert(banks)
    .values([
      {
        code: 'VCB',
        name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
        shortName: 'Vietcombank',
      },
      {
        code: 'BIDV',
        name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
        shortName: 'BIDV',
      },
      {
        code: 'TCB',
        name: 'Ngân hàng TMCP Kỹ thương Việt Nam',
        shortName: 'Techcombank',
      },
    ])
    .$returningId()

  const [vcb, bidv, tcb] = insertedBanks

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
        code: 'THAI-HONDA',
        name: 'Thai Honda Manufacturing Co., Ltd',
        country: 'Thái Lan',
        taxCode: 'TH0105508001234',
        address: '410 Lat Krabang Industrial Estate, Bangkok, Thailand',
        contactPerson: 'Mr. Somchai',
        phone: '+66 2 326 0641',
      },
      {
        code: 'ASTRA-HONDA',
        name: 'PT Astra Honda Motor',
        country: 'Indonesia',
        taxCode: 'ID010002345678000',
        address: 'Jl. Laksda Yos Sudarso, Sunter 1, Jakarta, Indonesia',
        contactPerson: 'Bambang Sugiharto',
        phone: '+62 21 651 8080',
      },
    ])
    .$returningId()

  const [supplierThai, supplierIndo] = insertedSuppliers

  console.log(' -> Seeding motorcycle models and colors...')
  const insertedModels = await db
    .insert(motorcycleModels)
    .values([
      {
        code: 'SH150-ABS',
        name: 'Honda SH 150i ABS',
        brand: 'Honda',
        engineCapacity: 150,
        description: 'Dòng xe tay ga cao cấp nhập khẩu nguyên chiếc',
      },
      {
        code: 'WAVE-125I',
        name: 'Honda Wave 125i Thái',
        brand: 'Honda',
        engineCapacity: 125,
        description: 'Dòng xe số bền bỉ, tiết kiệm xăng nhập khẩu Thái Lan',
      },
      {
        code: 'VARIO-160',
        name: 'Honda Vario 160 CBS',
        brand: 'Honda',
        engineCapacity: 160,
        description: 'Dòng xe tay ga thể thao nhập khẩu Indonesia',
      },
      {
        code: 'SCOOPY-110',
        name: 'Honda Scoopy Club12',
        brand: 'Honda',
        engineCapacity: 110,
        description: 'Dòng xe tay ga thời trang cổ điển phong cách trẻ',
      },
    ])
    .$returningId()

  const [modelSh, modelWave, modelVario, modelScoopy] = insertedModels

  const insertedColors = await db
    .insert(colors)
    .values([
      { code: 'RED', name: 'Đỏ Đô', hex: '#990000' },
      { code: 'WHT', name: 'Trắng Ngọc Trai', hex: '#f8fafc' },
      { code: 'BLK', name: 'Đen Mờ (Matte Black)', hex: '#18181b' },
      { code: 'GRY', name: 'Xám Xi Măng', hex: '#64748b' },
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
