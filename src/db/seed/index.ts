import { db } from '../index.ts'
import { resetDatabase } from './reset.seed.ts'
import { seedCompany } from './company.seed.ts'
import { seedUsers } from './user.seed.ts'
import { seedMasterData } from './master-data.seed.ts'
import { seedCustomers } from './customer.seed.ts'
import { seedLoans } from './loan.seed.ts'
import { seedBatches } from './batch.seed.ts'
import { seedSales } from './sale.seed.ts'
import { seedFinance } from './finance.seed.ts'

/**
 * Orchestrates database seeding in sequential order, maintaining foreign key integrity
 * and realistic operational demonstration data.
 *
 * Idempotent per table: each step below checks its own table(s) first and
 * returns the existing rows instead of inserting when they are already
 * populated (see each seed*.ts file). This lets `seed()` run repeatedly —
 * e.g. to fill in a table added later — without duplicating existing data.
 *
 * Pass `{ reset: true }` (or run `npm run seed -- --reset`) to wipe every
 * table first, which makes every step below see empty tables and reseed
 * from scratch.
 */
export async function seed({ reset = false }: { reset?: boolean } = {}) {
  console.log('====================================================')
  console.log('🚀 STARTING TRUONG THINH PHAT DATABASE SEED RUNNER')
  console.log('====================================================')

  if (reset) {
    // Wipe existing records cleanly
    await resetDatabase()
  }

  // Step 1: Seed company legal and profile information
  await seedCompany()

  // Step 2: Seed user accounts
  const { adminId } = await seedUsers()

  // Step 3: Seed master catalogs (banks, suppliers, motorcycle models, colors)
  const { banks, companyBankAccounts, suppliers, models, colors } =
    await seedMasterData()

  // Step 4: Seed customers and POS branches
  const { customers, branches } = await seedCustomers()

  // Step 5: Seed commercial bank loans and repayments
  const { loans } = await seedLoans({ banks, companyBankAccounts })

  // Step 6: Seed import batches, logistics/customs expenses, and vehicles with cost allocation
  const { batches, vIds } = await seedBatches({
    adminId,
    suppliers,
    loans,
    models,
    colors,
  })

  // Step 7: Seed wholesale sales orders & Dual Independent Inventory demonstrator cases
  const { orders } = await seedSales({
    adminId,
    customers,
    branches,
    vIds,
  })

  // Step 8: Seed cash flow vouchers (receipts, payments) & bank statement reconciliations
  await seedFinance({
    adminId,
    customers,
    branches,
    orders,
    suppliers,
    batches,
    companyBankAccounts,
  })

  console.log('====================================================')
  console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!')
  console.log('====================================================')
  console.log('👤 System Login Accounts:')
  console.log('   - Admin:      admin      / Admin@123')
  console.log('   - Accountant: ketoan     / Ktp@12345')
  console.log('   - Sales:      kinhdoanh  / Sale@12345')
  console.log('   - Warehouse:  kho        / Kho@12345')
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
