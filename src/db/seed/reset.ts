import { sql } from 'drizzle-orm'

import { db } from '../index.ts'
import {
  bankStatementLines,
  bankStatements,
  banks,
  batchExpenses,
  colors,
  companyBankAccounts,
  companyInfo,
  customers,
  deliveryNoteItems,
  deliveryNotes,
  importBatches,
  invoiceItems,
  invoices,
  loanContracts,
  loanRepayments,
  motorcycleModels,
  paymentVouchers,
  posBranches,
  receiptVouchers,
  salesOrderItems,
  salesOrders,
  suppliers,
  users,
  vehicles,
} from '../schema.ts'

/**
 * Resets all tables in the database before seeding.
 * Temporarily disables foreign key checks to prevent cascade order deadlocks.
 */
export async function resetDatabase() {
  console.log(' -> Clearing existing data across all tables...')
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0;`)

  await db.delete(deliveryNoteItems)
  await db.delete(deliveryNotes)
  await db.delete(invoiceItems)
  await db.delete(invoices)
  await db.delete(salesOrderItems)
  await db.delete(salesOrders)
  await db.delete(bankStatementLines)
  await db.delete(bankStatements)
  await db.delete(receiptVouchers)
  await db.delete(paymentVouchers)
  await db.delete(vehicles)
  await db.delete(batchExpenses)
  await db.delete(importBatches)
  await db.delete(loanRepayments)
  await db.delete(loanContracts)
  await db.delete(posBranches)
  await db.delete(customers)
  await db.delete(colors)
  await db.delete(motorcycleModels)
  await db.delete(suppliers)
  await db.delete(companyBankAccounts)
  await db.delete(banks)
  await db.delete(users)
  await db.delete(companyInfo)

  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1;`)
}
