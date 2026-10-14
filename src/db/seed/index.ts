import { db } from '../index.ts'
import { resetDatabase } from './reset.ts'
import { seedCompany } from './company.ts'
import { seedUsers } from './users.ts'
import { seedMasterData } from './master-data.ts'
import { seedCustomers } from './customers.ts'
import { seedLoans } from './loans.ts'
import { seedBatches } from './batches.ts'
import { seedSales } from './sales.ts'
import { seedFinance } from './finance.ts'

/**
 * Orchestrates database seeding in sequential order, maintaining foreign key integrity
 * and realistic operational demonstration data.
 */
export async function seed() {
  console.log('====================================================')
  console.log('🚀 STARTING TRUONG THINH PHAT DATABASE SEED RUNNER')
  console.log('====================================================')

  // Step 1: Wipe existing records cleanly
  await resetDatabase()

  // Step 2: Seed company legal and profile information
  await seedCompany()

  // Step 3: Seed user accounts
  const { adminId } = await seedUsers()

  // Step 4: Seed master catalogs (banks, suppliers, motorcycle models, colors)
  const { banks, companyBankAccounts, suppliers, models, colors } =
    await seedMasterData()

  // Step 5: Seed customers and POS branches
  const { customers, branches } = await seedCustomers()

  // Step 6: Seed commercial bank loans and repayments
  const { loans } = await seedLoans({ banks, companyBankAccounts })

  // Step 7: Seed import batches, logistics/customs expenses, and vehicles with cost allocation
  const { batches, vIds } = await seedBatches({
    adminId,
    suppliers,
    loans,
    models,
    colors,
  })

  // Step 8: Seed wholesale sales orders & Dual Independent Inventory demonstrator cases
  const { orders } = await seedSales({
    adminId,
    customers,
    branches,
    vIds,
  })

  // Step 9: Seed cash flow vouchers (receipts, payments) & bank statement reconciliations
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
  seed().catch((err) => {
    console.error('❌ Database seeding failed:', err)
    process.exit(1)
  })
}
