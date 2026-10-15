import { db } from '../index.ts'
import {
  receiptVouchers,
  paymentVouchers,
  bankStatements,
  bankStatementLines,
} from '../schema.ts'

interface SeedFinanceParams {
  adminId: number
  customers: {
    custNamAnh: { id: number }
    custThanhDat: { id: number }
  }
  branches: {
    branchNamAnhQ10: { id: number }
    branchThanhDatTD: { id: number }
  }
  orders: {
    order1: { id: number }
    order3: { id: number }
  }
  suppliers: {
    supplierThai: { id: number }
    supplierIndo: { id: number }
  }
  batches: {
    batch1: { id: number }
    batch2: { id: number }
  }
  companyBankAccounts: {
    vcbAccount: { id: number }
    bidvAccount: { id: number }
  }
}

/**
 * Seeds cash receipts, vendor payments, and bank statements for transaction reconciliation.
 * Idempotent: skips the insert (receipts, payments, statement + lines, all
 * seeded together) if `bank_statements` already has rows.
 */
export async function seedFinance({
  adminId,
  customers,
  branches,
  orders,
  suppliers,
  batches,
  companyBankAccounts,
}: SeedFinanceParams) {
  const [existingStatement] = await db.select().from(bankStatements).limit(1)
  if (existingStatement) {
    console.log(' -> Finance vouchers already seeded, skipping...')
    return { statement: existingStatement }
  }

  console.log(' -> Seeding receipt and payment vouchers...')
  await db.insert(receiptVouchers).values([
    {
      voucherNumber: 'PT-260122-001',
      receiptDate: '2026-01-22',
      customerId: customers.custNamAnh.id,
      branchId: branches.branchNamAnhQ10.id,
      salesOrderId: orders.order1.id,
      amount: 200_000_000,
      method: 'bank_transfer',
      companyBankAccountId: companyBankAccounts.vcbAccount.id,
      note: 'Nam Anh chuyển khoản trả nợ đợt 1 cho Order 1',
      createdBy: adminId,
    },
    {
      voucherNumber: 'PT-260210-002',
      receiptDate: '2026-02-10',
      customerId: customers.custThanhDat.id,
      branchId: branches.branchThanhDatTD.id,
      salesOrderId: orders.order3.id,
      amount: 100_000_000,
      method: 'bank_transfer',
      companyBankAccountId: companyBankAccounts.vcbAccount.id,
      note: 'Thành Đạt đặt cọc/thanh toán đợt 1',
      createdBy: adminId,
    },
  ])

  await db.insert(paymentVouchers).values([
    {
      voucherNumber: 'PC-260118-001',
      paymentDate: '2026-01-18',
      payeeType: 'supplier',
      supplierId: suppliers.supplierThai.id,
      batchId: batches.batch1.id,
      amount: 500_000_000,
      method: 'bank_transfer',
      companyBankAccountId: companyBankAccounts.vcbAccount.id,
      description: 'Thanh toán tiền hàng đợt 1 cho Thai Honda',
      createdBy: adminId,
    },
    {
      voucherNumber: 'PC-260222-002',
      paymentDate: '2026-02-22',
      payeeType: 'supplier',
      supplierId: suppliers.supplierIndo.id,
      batchId: batches.batch2.id,
      amount: 300_000_000,
      method: 'bank_transfer',
      companyBankAccountId: companyBankAccounts.bidvAccount.id,
      description: 'Thanh toán tiền hàng cho PT Astra Honda',
      createdBy: adminId,
    },
  ])

  console.log(' -> Seeding bank statements and statement lines...')
  const [statement] = await db
    .insert(bankStatements)
    .values({
      companyBankAccountId: companyBankAccounts.vcbAccount.id,
      periodFrom: '2026-01-01',
      periodTo: '2026-02-28',
      fileName: 'SAOKE_VCB_0071001234567_T1_T2_2026.xlsx',
      note: 'Sao kê ngân hàng VCB quý 1 năm 2026',
      createdBy: adminId,
    })
    .$returningId()

  await db.insert(bankStatementLines).values([
    {
      statementId: statement.id,
      transactionDate: '2026-01-18',
      description: 'CHUYEN TIEN TT THAI HONDA MANUFACTURING CO LTD',
      debit: 500_000_000,
      credit: 0,
      balance: 1_500_000_000,
      status: 'matched',
      matchedType: 'payment',
      matchedId: 1,
    },
    {
      statementId: statement.id,
      transactionDate: '2026-01-22',
      description: 'CTY XE MAY NAM ANH THANH TOAN TIEN XE',
      debit: 0,
      credit: 200_000_000,
      balance: 1_700_000_000,
      status: 'matched',
      matchedType: 'receipt',
      matchedId: 1,
    },
    {
      statementId: statement.id,
      transactionDate: '2026-02-10',
      description: 'DNTN THANH DAT CHUYEN KHOAN TIEN HANG',
      debit: 0,
      credit: 100_000_000,
      balance: 1_800_000_000,
      status: 'matched',
      matchedType: 'receipt',
      matchedId: 2,
    },
    {
      statementId: statement.id,
      transactionDate: '2026-02-25',
      description: 'TRU NO GOC VA LAI KHE UOC KU-2026-VCB-01',
      debit: 521_438_356,
      credit: 0,
      balance: 1_278_561_644,
      status: 'matched',
      matchedType: 'loan_repayment',
      matchedId: 1,
    },
    {
      statementId: statement.id,
      transactionDate: '2026-02-26',
      description: 'KHACH HANG LE VAN A CK TIEN COC XE',
      debit: 0,
      credit: 50_000_000,
      balance: 1_328_561_644,
      status: 'unmatched',
    },
    {
      statementId: statement.id,
      transactionDate: '2026-02-27',
      description: 'PHI QUAN LY TAI KHOAN VA SMS BANKING',
      debit: 220_000,
      credit: 0,
      balance: 1_328_341_644,
      status: 'unmatched',
    },
  ])

  return {
    statement,
  }
}
