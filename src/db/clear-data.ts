import { rm } from 'node:fs/promises'
import path from 'node:path'

import { sql } from 'drizzle-orm'

import { db } from './index.ts'

/**
 * HARD-deletes (TRUNCATE) all business data and keeps only:
 *   1. accounts      -> users, sessions, password_reset_tokens
 *   2. permissions   -> roles, role_permissions
 *   3. settings      -> company_info
 *   4. bank list     -> banks
 * (plus `migrations`, the bookkeeping of the migration runner).
 *
 * Everything else is wiped, auto-increment counters included: batches,
 * vehicles, sales, invoices, delivery notes, loans, vouchers, bank statements,
 * customers, suppliers, motorcycle models, colours, expense types and the
 * company bank accounts. Uploaded supplier logos are removed from disk too.
 *
 * Usage:
 *   npm run db:clear                # deletes for real
 *   npm run db:clear -- --dry-run   # only shows what would be deleted
 */

/** Tables to empty, children before parents (FK checks are off anyway) */
const TABLES_TO_CLEAR = [
  'bank_statement_lines',
  'bank_statements',
  'receipt_vouchers',
  'payment_vouchers',
  'delivery_note_items',
  'delivery_notes',
  'invoice_items',
  'invoices',
  'sales_order_items',
  'sales_orders',
  'vehicles',
  'batch_expenses',
  'import_batches',
  'expense_types',
  'loan_repayments',
  'loan_contracts',
  'pos_branches',
  'customers',
  'colors',
  'motorcycle_models',
  'suppliers',
  'company_bank_accounts',
] as const

async function count(table: string) {
  const [rows] = (await db.execute(
    sql.raw(`SELECT COUNT(*) AS n FROM \`${table}\``),
  )) as unknown as [{ n: number | string }[]]
  return Number(rows[0]?.n ?? 0)
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  // db/index.ts falls back to a hard-coded server when .env is missing: never
  // allow a destructive script to run against that
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter(
    (k) => !process.env[k],
  )
  if (missing.length > 0) {
    console.error(
      `Refusing to run: ${missing.join(', ')} not set in .env / .env.local`,
    )
    process.exitCode = 1
    return
  }
  const target = `${process.env.DB_NAME} @ ${process.env.DB_HOST}:${process.env.DB_PORT ?? 3306}`

  console.log('====================================================')
  console.log(`DATABASE: ${target}`)
  console.log('KEEPS   : users, sessions, roles, role_permissions,')
  console.log('          company_info (settings), banks')
  console.log('DELETES : everything else (hard delete)')
  console.log('====================================================')

  let total = 0
  for (const t of TABLES_TO_CLEAR) {
    const n = await count(t)
    total += n
    console.log(`  ${t.padEnd(24)} ${String(n).padStart(8)} row(s)`)
  }
  console.log(`  ${'TOTAL'.padEnd(24)} ${String(total).padStart(8)} row(s)`)

  if (dryRun) {
    console.log('\nDRY RUN: nothing was deleted.')
    return
  }

  console.log('\nDeleting...')
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`)
  try {
    for (const t of TABLES_TO_CLEAR) {
      await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``))
      console.log(`  ✓ ${t}`)
    }
  } finally {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`)
  }

  // Supplier logos belong to the deleted suppliers (bank logos are kept)
  await rm(path.resolve(process.cwd(), 'uploads', 'suppliers'), {
    recursive: true,
    force: true,
  })
  console.log('  ✓ uploads/suppliers')
  console.log('\nDone. Accounts, permissions, settings and banks are untouched.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Close the pool so the process can exit (avoids a libuv assertion on Windows)
    await db.$client.end()
  })
