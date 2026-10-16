import { db } from '../index.ts'
import { seedBanks } from './bank.seed.ts'
import { seedCompany } from './company.seed.ts'
import { resetDatabase } from './reset.seed.ts'
import { seedUsers } from './user.seed.ts'

/**
 * Seeds the minimum a new installation needs, and nothing else:
 *   1. company profile (`company_info`)
 *   2. default roles + the first administrator (`roles`, `users`)
 *   3. the VietQR bank catalogue (`banks`, needs internet access)
 * Customers, suppliers, models, colours, loans, batches, sales and vouchers are
 * entered through the app.
 *
 * Idempotent per table: every step checks its own table first, so `seed()` can
 * run repeatedly. Pass `{ reset: true }` (or run `npm run seed -- --reset`) to
 * wipe every table first.
 */
export async function seed({ reset = false }: { reset?: boolean } = {}) {
  console.log('====================================================')
  console.log('🚀 STARTING TRUONG THINH PHAT DATABASE SEED RUNNER')
  console.log('====================================================')

  if (reset) await resetDatabase()

  await seedCompany()
  await seedUsers()
  await seedBanks()

  console.log('====================================================')
  console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!')
  console.log('====================================================')
  console.log('👤 System Login Account:')
  console.log('   - Admin: admin / Admin@123')
  console.log('====================================================')

  // Gracefully close underlying connection pool to prevent libuv assertion failure on Windows
  await db.$client.end()
}

// Support direct invocation if run directly via tsx
if (
  process.argv[1]?.endsWith('seed\\index.ts') ||
  process.argv[1]?.endsWith('seed/index.ts')
) {
  const reset = process.argv.includes('--reset')
  seed({ reset }).catch((err) => {
    console.error('❌ Database seeding failed:', err)
    process.exit(1)
  })
}
