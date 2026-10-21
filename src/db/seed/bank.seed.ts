import { eq } from 'drizzle-orm'

import { db } from '../index.ts'
import { banks } from '../schema.ts'

interface BankRow {
  name: string
  image: string
  code: string
  shortName: string
}

/**
 * The only banks the client works with: ACB, Bản Việt, Vietcombank, HDBank,
 * Eximbank. Names, codes and logos come from the VietQR catalogue, stored here
 * so seeding needs no internet access. `code` is the VietQR code and is how a
 * bank is recognised even after it was renamed in the app.
 */
export const SEED_BANKS: BankRow[] = [
  {
    name: 'Ngân hàng TMCP Á Châu',
    code: 'ACB',
    shortName: 'ACB',
    image: 'https://cdn.vietqr.io/img/ACB.png',
  },
  {
    name: 'Ngân hàng TMCP Bản Việt',
    code: 'VCCB',
    shortName: 'VietCapitalBank',
    image: 'https://cdn.vietqr.io/img/VCCB.png',
  },
  {
    name: 'Ngân hàng TMCP Ngoại Thương Việt Nam',
    code: 'VCB',
    shortName: 'Vietcombank',
    image: 'https://cdn.vietqr.io/img/VCB.png',
  },
  {
    name: 'Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh',
    code: 'HDB',
    shortName: 'HDBank',
    image: 'https://cdn.vietqr.io/img/HDB.png',
  },
  {
    name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam',
    code: 'EIB',
    shortName: 'Eximbank',
    image: 'https://cdn.vietqr.io/img/EIB.png',
  },
]

/**
 * Seeds the five banks. Idempotent and additive: a bank is inserted only when
 * no row has its code; for an existing row (matched by code) only the columns
 * that are still empty (logo, short name) are filled in, nothing is overwritten.
 *
 * Returns every bank in the table.
 */
export async function seedBanks() {
  const existing = await db.select().from(banks)
  const byCode = new Map(existing.flatMap((b) => (b.code ? [[b.code, b]] : [])))

  const missing = SEED_BANKS.filter((b) => !byCode.has(b.code))
  if (missing.length > 0) {
    console.log(` -> Seeding ${missing.length} bank(s)...`)
    await db.insert(banks).values(missing)
  } else {
    console.log(' -> Banks already seeded, skipping...')
  }

  for (const seed of SEED_BANKS) {
    const row = byCode.get(seed.code)
    if (!row) continue
    const patch: Partial<BankRow> = {}
    if (!row.image) patch.image = seed.image
    if (!row.shortName) patch.shortName = seed.shortName
    if (Object.keys(patch).length > 0)
      await db.update(banks).set(patch).where(eq(banks.id, row.id))
  }

  return db.select().from(banks)
}
