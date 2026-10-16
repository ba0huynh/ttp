import { eq } from 'drizzle-orm'

import { db } from '../index.ts'
import { banks } from '../schema.ts'

/** VietQR public bank list. `d` is only a daily cache-buster (see API docs). */
const VIETQR_BANKS_URL = 'https://api.vietqr.io/v2/banks'

interface VietQrBank {
  name: string
  logo?: string
  code?: string
  shortName?: string
}

interface BankRow {
  name: string
  image: string | null
  code: string | null
  shortName: string | null
}

/**
 * Banks are matched by name ignoring case and extra spaces: rows seeded earlier
 * can differ from VietQR only in capitalisation ("Ngoại thương" vs "Ngoại Thương").
 */
export const normalizeBankName = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLowerCase().normalize('NFC')

/**
 * Lowercase, diacritic-free form used for keyword lookups, so a bank is still
 * found when the API renames it slightly ("TMCP" vs "Thương mại cổ phần").
 */
export const foldBankName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('đ', 'd')
    .replaceAll('Đ', 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Downloads the current list of Vietnamese banks supported by VietQR */
export async function fetchVietQrBanks() {
  const d = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  let res: Response
  try {
    res = await fetch(`${VIETQR_BANKS_URL}?d=${d}`, {
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err) {
    throw new Error(
      `Could not reach the VietQR API (${VIETQR_BANKS_URL}) — check the internet connection and retry. ${(err as Error).message}`,
    )
  }
  if (!res.ok) throw new Error(`VietQR API returned HTTP ${res.status}`)

  const json = (await res.json()) as { code?: string; data?: VietQrBank[] }
  if (json.code !== '00' || !json.data?.length)
    throw new Error(
      `Unexpected VietQR response: ${JSON.stringify(json).slice(0, 200)}`,
    )

  // Keep only what the `banks` table stores; de-duplicate by name
  const byName = new Map<string, BankRow>()
  for (const b of json.data) {
    const key = normalizeBankName(b.name ?? '')
    if (key && !byName.has(key))
      byName.set(key, {
        name: b.name.trim(),
        image: b.logo?.trim() || null,
        code: b.code?.trim() || null,
        shortName: b.shortName?.trim() || null,
      })
  }
  return [...byName.values()]
}

/**
 * Seeds the Vietnamese bank catalog straight from the VietQR API.
 *
 * Idempotent and additive: inserts only the banks (matched by name) that are
 * missing, so it also tops up a database that already has a few banks. For
 * banks that already exist it only fills in what is missing (logo `image`,
 * search-only `code` and `shortName`); every other field is left as is. The API is called on every run, so seeding needs
 * internet access (a clear error is thrown when it is unreachable).
 *
 * Returns every bank in the table (existing + new).
 */
export async function seedBanks() {
  console.log(' -> Fetching bank list from VietQR API...')
  const [catalog, existing] = await Promise.all([
    fetchVietQrBanks(),
    db
      .select({
        id: banks.id,
        name: banks.name,
        image: banks.image,
        code: banks.code,
        shortName: banks.shortName,
      })
      .from(banks),
  ])
  const have = new Map(existing.map((b) => [normalizeBankName(b.name), b]))
  // Banks can be renamed in the app: the VietQR code still identifies them
  const haveByCode = new Map(
    existing.flatMap((b) => (b.code ? [[b.code, b] as const] : [])),
  )
  const findExisting = (b: BankRow) =>
    have.get(normalizeBankName(b.name)) ??
    (b.code ? haveByCode.get(b.code) : undefined)
  const missing = catalog.filter((b) => !findExisting(b))
  // Existing banks: fill only the columns that are still empty
  const needsFill = catalog.flatMap((b) => {
    const row = findExisting(b)
    if (!row) return []
    const patch: Partial<BankRow> = {}
    if (b.image && !row.image) patch.image = b.image
    if (b.code && !row.code) patch.code = b.code
    if (b.shortName && !row.shortName) patch.shortName = b.shortName
    return Object.keys(patch).length > 0 ? [{ id: row.id, patch }] : []
  })

  if (missing.length > 0) {
    console.log(` -> Seeding ${missing.length} banks (VietQR catalog)...`)
    await db.insert(banks).values(missing)
  } else {
    console.log(' -> Bank catalog already complete, skipping...')
  }

  for (const b of needsFill)
    await db.update(banks).set(b.patch).where(eq(banks.id, b.id))
  if (needsFill.length > 0)
    console.log(
      ` -> Filled in logo / code / short name for ${needsFill.length} existing banks`,
    )

  return db.select().from(banks)
}
