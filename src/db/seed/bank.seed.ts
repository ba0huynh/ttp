import { eq } from 'drizzle-orm'

import { db } from '../index.ts'
import { banks } from '../schema.ts'

/** VietQR public bank list. `d` is only a daily cache-buster (see API docs). */
const VIETQR_BANKS_URL = 'https://api.vietqr.io/v2/banks'

interface VietQrBank {
  name: string
  shortName: string
  logo?: string
}

interface BankRow {
  name: string
  shortName: string
  image: string | null
}

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

  // Keep only what the `banks` table stores; de-duplicate by short name
  const byShortName = new Map<string, BankRow>()
  for (const b of json.data) {
    const shortName = b.shortName?.trim()
    if (shortName && !byShortName.has(shortName))
      byShortName.set(shortName, {
        name: b.name.trim(),
        shortName,
        image: b.logo?.trim() || null,
      })
  }
  return [...byShortName.values()]
}

/**
 * Seeds the Vietnamese bank catalog straight from the VietQR API.
 *
 * Idempotent and additive: inserts only the banks (matched by short name) that are missing, so it also
 * tops up a database that already has a few banks. For banks that already exist
 * it only fills in a missing logo (`image`); every other field is left as is. The API is called on every run, so seeding needs
 * internet access (a clear error is thrown when it is unreachable).
 *
 * Returns every bank in the table (existing + new).
 */
export async function seedBanks() {
  console.log(' -> Fetching bank list from VietQR API...')
  const [catalog, existing] = await Promise.all([
    fetchVietQrBanks(),
    db.select({ shortName: banks.shortName, image: banks.image }).from(banks),
  ])
  const have = new Map(existing.map((b) => [b.shortName, b]))
  const missing = catalog.filter((b) => !have.has(b.shortName))
  const needsLogo = catalog.filter(
    (b) => b.image && have.has(b.shortName) && !have.get(b.shortName)!.image,
  )

  if (missing.length > 0) {
    console.log(` -> Seeding ${missing.length} banks (VietQR catalog)...`)
    await db.insert(banks).values(missing)
  } else {
    console.log(' -> Bank catalog already complete, skipping...')
  }

  for (const b of needsLogo)
    await db
      .update(banks)
      .set({ image: b.image })
      .where(eq(banks.shortName, b.shortName))
  if (needsLogo.length > 0)
    console.log(` -> Filled in logos for ${needsLogo.length} existing banks`)

  return db.select().from(banks)
}
