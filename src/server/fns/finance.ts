import { createServerFn } from '@tanstack/react-start'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import {
  MATCH_TYPES,
  PAYEE_TYPES,
  bankStatementLines,
  bankStatements,
  banks,
  companyBankAccounts,
  customers,
  loanContracts,
  loanRepayments,
  paymentVouchers,
  posBranches,
  receiptVouchers,
  suppliers,
} from '#/db/schema.ts'
import { isDuplicateError, num } from '#/server/services/common.ts'
import {
  createPaymentVoucher,
  createReceiptVoucher,
  deleteLoanRepayment,
  deletePaymentVoucher,
  deleteReceiptVoucher,
  deleteStatementLine,
  getLoanStatus,
  importBankStatement,
  matchStatementLine,
  recordLoanRepayment,
  setStatementLineStatus,
  suggestMatches,
  updateLoanRepayment,
  updatePaymentVoucher,
  updateReceiptVoucher,
  updateStatementLine,
} from '#/server/services/finance.ts'
import {
  getPayablesSummary,
  getReceivablesSummary,
} from '#/server/services/reports.ts'
import { requirePermission } from './middleware.ts'

/* -------------------------------------------------------------------------- */
/* 04. Bank Loans                                                             */
/* -------------------------------------------------------------------------- */

export const listLoansFn = createServerFn({ method: 'GET' })
  .middleware([
    requirePermission('loans.view', 'batches.manage', 'dashboard.view'),
  ])
  .handler(async () => {
    const list = await db
      .select({
        id: loanContracts.id,
        contractNumber: loanContracts.contractNumber,
        bankId: loanContracts.bankId,
        bankName: banks.name,
        bankImage: banks.image,
        principalAmount: loanContracts.principalAmount,
        interestRate: loanContracts.interestRate,
        disbursementDate: loanContracts.disbursementDate,
        termMonths: loanContracts.termMonths,
        principalPaid: sql<string>`coalesce((select sum(r.principal_amount) from ${loanRepayments} r where r.loan_contract_id = ${loanContracts.id}),0)`,
        interestPaid: sql<string>`coalesce((select sum(r.interest_amount) from ${loanRepayments} r where r.loan_contract_id = ${loanContracts.id}),0)`,
      })
      .from(loanContracts)
      .innerJoin(banks, eq(banks.id, loanContracts.bankId))
      .orderBy(desc(loanContracts.disbursementDate))

    return list.map((l) => {
      const p = num(l.principalAmount)
      const paid = num(l.principalPaid)
      return {
        ...l,
        principalAmount: p,
        interestRate: num(l.interestRate),
        principalPaid: paid,
        interestPaid: num(l.interestPaid),
        outstanding: p - paid,
        // Derived: a loan is settled once no principal remains
        status: p - paid <= 0.5 ? ('settled' as const) : ('active' as const),
      }
    })
  })

export const getLoanDetailFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('loans.view')])
  .validator(z.object({ id: z.number().int(), asOf: z.string().optional() }))
  .handler(async ({ data }) => {
    return getLoanStatus(data.id, data.asOf)
  })

export const saveLoanContractFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('loans.manage')])
  .validator(
    z.object({
      id: z.number().int().optional(),
      contractNumber: z.string().trim().min(1, 'Nhập số khế ước'),
      bankId: z.number().int(),
      principalAmount: z.number().positive('Số tiền vay phải > 0'),
      interestRate: z.number().min(0, 'Lãi suất %/năm'),
      disbursementDate: z.string().min(10),
      termMonths: z.number().int().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { id, ...v } = data
      if (id) {
        await db.update(loanContracts).set(v).where(eq(loanContracts.id, id))
        return { id }
      }
      const [created] = await db.insert(loanContracts).values(v).$returningId()
      return { id: created.id }
    } catch (e) {
      if (isDuplicateError(e)) throw new Error('Số khế ước đã tồn tại')
      throw e
    }
  })

export const recordLoanPaymentFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('loans.manage')])
  .validator(
    z.object({
      loanContractId: z.number().int(),
      paymentDate: z.string().min(10),
      principalAmount: z.number().min(0),
      interestAmount: z.number().min(0),
      companyBankAccountId: z.number().int().nullable().optional(),
      note: z.string().trim().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await recordLoanRepayment(data)
    return { ok: true }
  })

export const updateLoanPaymentFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('loans.manage')])
  .validator(
    z.object({
      id: z.number().int(),
      paymentDate: z.string().min(10),
      principalAmount: z.number().min(0),
      interestAmount: z.number().min(0),
      companyBankAccountId: z.number().int().nullable().optional(),
      note: z.string().trim().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await updateLoanRepayment(data.id, data)
    return { ok: true }
  })

export const deleteLoanPaymentFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('loans.manage')])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await deleteLoanRepayment(data.id)
    return { ok: true }
  })

/**
 * Deleting a loan contract is allowed only while no repayment is recorded (a
 * repayment would otherwise be deleted with it by the cascade and the history
 * lost).
 */
export const deleteLoanContractFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('loans.manage')])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const [repayment] = await db
      .select({ id: loanRepayments.id })
      .from(loanRepayments)
      .where(eq(loanRepayments.loanContractId, data.id))
      .limit(1)
    if (repayment)
      throw new Error('Khế ước đã có khoản trả nợ nên không thể xóa')
    await db.delete(loanContracts).where(eq(loanContracts.id, data.id))
    return { ok: true }
  })

/* -------------------------------------------------------------------------- */
/* 08. Accounts Receivable (AR) & Receipts                                    */
/* -------------------------------------------------------------------------- */

export const getReceivablesFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('finance.view')])
  .handler(async () => {
    return getReceivablesSummary()
  })

export const listReceiptVouchersFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('finance.view')])
  .handler(async () => {
    const list = await db
      .select({
        id: receiptVouchers.id,
        receiptDate: receiptVouchers.receiptDate,
        amount: receiptVouchers.amount,
        customerId: receiptVouchers.customerId,
        customerName: customers.name,
        companyBankAccountId: receiptVouchers.companyBankAccountId,
        branchId: receiptVouchers.branchId,
        branchName: posBranches.name,
        accountNumber: companyBankAccounts.accountNumber,
        bankName: banks.name,
        bankImage: banks.image,
      })
      .from(receiptVouchers)
      .innerJoin(customers, eq(customers.id, receiptVouchers.customerId))
      .leftJoin(posBranches, eq(posBranches.id, receiptVouchers.branchId))
      .leftJoin(
        companyBankAccounts,
        eq(companyBankAccounts.id, receiptVouchers.companyBankAccountId),
      )
      .leftJoin(banks, eq(banks.id, companyBankAccounts.bankId))
      .orderBy(desc(receiptVouchers.receiptDate), desc(receiptVouchers.id))

    return list.map((r) => ({
      ...r,
      amount: num(r.amount),
    }))
  })

export const createReceiptVoucherFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('finance.manage')])
  .validator(
    z.object({
      receiptDate: z.string().min(10),
      customerId: z.number().int(),
      branchId: z.number().int().nullable().optional(),
      salesOrderId: z.number().int().nullable().optional(),
      amount: z.number().positive('Số tiền phải > 0'),
      companyBankAccountId: z.number().int().nullable().optional(),
      createStatementLine: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const id = await createReceiptVoucher(data, context.user.id)
    return { id }
  })

/* -------------------------------------------------------------------------- */
/* 09. Accounts Payable (AP) & Payments                                       */
/* -------------------------------------------------------------------------- */

export const getPayablesFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('finance.view')])
  .handler(async () => {
    return getPayablesSummary()
  })

export const listPaymentVouchersFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('finance.view')])
  .handler(async () => {
    const list = await db
      .select({
        id: paymentVouchers.id,
        paymentDate: paymentVouchers.paymentDate,
        payeeType: paymentVouchers.payeeType,
        payeeName: paymentVouchers.payeeName,
        amount: paymentVouchers.amount,
        description: paymentVouchers.description,
        supplierId: paymentVouchers.supplierId,
        supplierName: suppliers.name,
        companyBankAccountId: paymentVouchers.companyBankAccountId,
        accountNumber: companyBankAccounts.accountNumber,
        bankName: banks.name,
        bankImage: banks.image,
      })
      .from(paymentVouchers)
      .leftJoin(suppliers, eq(suppliers.id, paymentVouchers.supplierId))
      .leftJoin(
        companyBankAccounts,
        eq(companyBankAccounts.id, paymentVouchers.companyBankAccountId),
      )
      .leftJoin(banks, eq(banks.id, companyBankAccounts.bankId))
      .orderBy(desc(paymentVouchers.paymentDate), desc(paymentVouchers.id))

    return list.map((p) => ({
      ...p,
      amount: num(p.amount),
    }))
  })

export const createPaymentVoucherFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('finance.manage')])
  .validator(
    z.object({
      paymentDate: z.string().min(10),
      payeeType: z.enum(PAYEE_TYPES),
      supplierId: z.number().int().nullable().optional(),
      payeeName: z.string().trim().nullable().optional(),
      amount: z.number().positive('Số tiền chi phải > 0'),
      companyBankAccountId: z.number().int().nullable().optional(),
      description: z.string().trim().nullable().optional(),
      createStatementLine: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const id = await createPaymentVoucher(data, context.user.id)
    return { id }
  })

/* -------------------------------------------------------------------------- */
/* 10. Bank Statements & Reconciliation                                       */
/* -------------------------------------------------------------------------- */

export const listBankStatementsFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('reconcile.view')])
  .handler(async () => {
    const list = await db
      .select({
        id: bankStatements.id,
        fileName: bankStatements.fileName,
        accountNumber: companyBankAccounts.accountNumber,
        bankName: banks.name,
        bankImage: banks.image,
        lineCount: sql<number>`count(${bankStatementLines.id})`,
        matchedCount: sql<number>`sum(case when ${bankStatementLines.status} = 'matched' then 1 else 0 end)`,
      })
      .from(bankStatements)
      .innerJoin(
        companyBankAccounts,
        eq(companyBankAccounts.id, bankStatements.companyBankAccountId),
      )
      .innerJoin(banks, eq(banks.id, companyBankAccounts.bankId))
      .leftJoin(
        bankStatementLines,
        eq(bankStatementLines.statementId, bankStatements.id),
      )
      .groupBy(
        bankStatements.id,
        bankStatements.fileName,
        companyBankAccounts.accountNumber,
        banks.name,
      )
      .orderBy(desc(bankStatements.id))

    return list.map((s) => ({
      ...s,
      lineCount: num(s.lineCount),
      matchedCount: num(s.matchedCount),
    }))
  })

export const getBankStatementDetailFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('reconcile.view')])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const [statement] = await db
      .select({
        id: bankStatements.id,
        fileName: bankStatements.fileName,
        accountNumber: companyBankAccounts.accountNumber,
        bankName: banks.name,
        bankImage: banks.image,
      })
      .from(bankStatements)
      .innerJoin(
        companyBankAccounts,
        eq(companyBankAccounts.id, bankStatements.companyBankAccountId),
      )
      .innerJoin(banks, eq(banks.id, companyBankAccounts.bankId))
      .where(eq(bankStatements.id, data.id))

    if (!statement) throw new Error('Không tìm thấy sao kê')

    const lines = await db
      .select()
      .from(bankStatementLines)
      .where(eq(bankStatementLines.statementId, data.id))
      .orderBy(
        asc(bankStatementLines.transactionDate),
        asc(bankStatementLines.id),
      )

    return {
      statement,
      lines: lines.map((l) => ({
        ...l,
        debit: num(l.debit),
        credit: num(l.credit),
        balance: l.balance !== null ? num(l.balance) : null,
      })),
    }
  })

export const importBankStatementFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('reconcile.manage')])
  .validator(
    z.object({
      companyBankAccountId: z.number().int(),
      fileName: z.string().trim().nullable().optional(),
      lines: z.array(
        z.object({
          transactionDate: z.string().min(10),
          description: z.string().trim().nullable().optional(),
          debit: z.number().min(0),
          credit: z.number().min(0),
          balance: z.number().nullable().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ data, context }) => {
    const id = await importBankStatement(data, context.user.id)
    return { id }
  })

export const suggestMatchesFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('reconcile.view')])
  .validator(z.object({ lineId: z.number().int() }))
  .handler(async ({ data }) => {
    return suggestMatches(data.lineId)
  })

export const matchStatementLineFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('reconcile.manage')])
  .validator(
    z.object({
      lineId: z.number().int(),
      matchedType: z.enum(MATCH_TYPES),
      matchedId: z.number().int(),
    }),
  )
  .handler(async ({ data }) => {
    await matchStatementLine(data.lineId, data.matchedType, data.matchedId)
    return { ok: true }
  })

export const setStatementLineStatusFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('reconcile.manage')])
  .validator(
    z.object({
      lineId: z.number().int(),
      status: z.enum(['unmatched', 'ignored']),
    }),
  )
  .handler(async ({ data }) => {
    await setStatementLineStatus(data.lineId, data.status)
    return { ok: true }
  })

export const updateStatementLineFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('reconcile.manage')])
  .validator(
    z.object({
      lineId: z.number().int(),
      transactionDate: z.string().min(10),
      description: z.string().trim().max(500).nullable(),
      debit: z.number().min(0),
      credit: z.number().min(0),
    }),
  )
  .handler(async ({ data: { lineId, ...v } }) => {
    await updateStatementLine(lineId, v)
    return { ok: true }
  })

export const deleteStatementLineFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('reconcile.manage')])
  .validator(z.object({ lineId: z.number().int() }))
  .handler(async ({ data }) => {
    await deleteStatementLine(data.lineId)
    return { ok: true }
  })

export const updateReceiptVoucherFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('finance.manage')])
  .validator(
    z.object({
      id: z.number().int(),
      receiptDate: z.string().min(10),
      customerId: z.number().int(),
      branchId: z.number().int().nullable().optional(),
      amount: z.number().positive('Số tiền phải > 0'),
      companyBankAccountId: z.number().int().nullable().optional(),
    }),
  )
  .handler(async ({ data: { id, ...v } }) => {
    await updateReceiptVoucher(id, v)
    return { ok: true }
  })

export const deleteReceiptVoucherFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('finance.manage')])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await deleteReceiptVoucher(data.id)
    return { ok: true }
  })

export const updatePaymentVoucherFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('finance.manage')])
  .validator(
    z.object({
      id: z.number().int(),
      paymentDate: z.string().min(10),
      supplierId: z.number().int(),
      amount: z.number().positive('Số tiền chi phải > 0'),
      companyBankAccountId: z.number().int().nullable().optional(),
      description: z.string().trim().nullable().optional(),
    }),
  )
  .handler(async ({ data: { id, ...v } }) => {
    await updatePaymentVoucher(id, v)
    return { ok: true }
  })

export const deletePaymentVoucherFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('finance.manage')])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await deletePaymentVoucher(data.id)
    return { ok: true }
  })
