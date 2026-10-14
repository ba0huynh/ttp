import { db } from '../index.ts'
import { banks } from '../schema.ts'
import { VIETNAM_BANKS } from './data/banks.ts'

/**
 * Seeds the Vietnamese bank catalog (generated from the VietQR list, see
 * `fetch-banks.ts`). Idempotent and additive: inserts only the codes that are
 * missing, so it also tops up a database that already has a few banks, and it
 * never overwrites rows that were edited by hand.
 *
 * Returns every bank in the table (existing + new).
 */
export async function seedBanks() {
  const existing = await db.select({ code: banks.code }).from(banks)
  const have = new Set(existing.map((b) => b.code))
  const missing = VIETNAM_BANKS.filter((b) => !have.has(b.code))

  if (missing.length > 0) {
    console.log(` -> Seeding ${missing.length} banks (VietQR catalog)...`)
    await db.insert(banks).values(missing)
  } else {
    console.log(' -> Bank catalog already complete, skipping...')
  }

  return db.select().from(banks)
}
