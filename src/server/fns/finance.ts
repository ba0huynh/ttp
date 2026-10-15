import { createServerFn } from '@tanstack/react-start'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import {
  LOAN_STATUSES,
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
  getLoanStatus,
  importBankStatement,
  matchStatementLine,
  recordLoanRepayment,
  setStatementLineStatus,
  suggestMatches,
} from '#/server/services/finance.ts'
import {
  getPayablesSummary,
  getReceivablesSummary,
} from '#/server/services/reports.ts'
import { authMiddleware } from './middleware.ts'

/* -------------------------------------------------------------------------- */
/* 04. Bank Loans                                                             */
/* -------------------------------------------------------------------------- */

export const listLoansFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
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
        maturityDate: loanContracts.maturityDate,
        status: loanContracts.status,
        note: loanContracts.note,
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
      }
    })
  })

export const getLoanDetailFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int(), asOf: z.string().optional() }))
  .handler(async ({ data }) => {
    return getLoanStatus(data.id, data.asOf)
  })

export const saveLoanContractFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int().optional(),
      contractNumber: z.string().trim().min(1, 'Nhập số khế ước'),
      bankId: z.number().int(),
      principalAmount: z.number().positive('Số tiền vay phải > 0'),
      interestRate: z.number().min(0, 'Lãi suất %/năm'),
      disbursementDate: z.string().min(10),
      maturityDate: z.string().min(10),
      status: z.enum(LOAN_STATUSES).optional(),
      note: z.string().trim().nullable().optional(),
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
  .middleware([authMiddleware])
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

/* -------------------------------------------------------------------------- */
/* 08. Accounts Receivable (AR) & Receipts                                    */
/* -------------------------------------------------------------------------- */

export const getReceivablesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    return getReceivablesSummary()
  })

export const listReceiptVouchersFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const list = await db
      .select({
        id: receiptVouchers.id,
        receiptDate: receiptVouchers.receiptDate,
        amount: receiptVouchers.amount,
        note: receiptVouchers.note,
        customerId: receiptVouchers.customerId,
        customerName: customers.name,
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
  .middleware([authMiddleware])
  .validator(
    z.object({
      receiptDate: z.string().min(10),
      customerId: z.number().int(),
      branchId: z.number().int().nullable().optional(),
      salesOrderId: z.number().int().nullable().optional(),
      amount: z.number().positive('Số tiền phải > 0'),
      companyBankAccountId: z.number().int().nullable().optional(),
      note: z.string().trim().nullable().optional(),
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
  .middleware([authMiddleware])
  .handler(async () => {
    return getPayablesSummary()
  })

export const listPaymentVouchersFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
  .validator(
    z.object({
      paymentDate: z.string().min(10),
      payeeType: z.enum(PAYEE_TYPES),
      supplierId: z.number().int().nullable().optional(),
      payeeName: z.string().trim().nullable().optional(),
      amount: z.number().positive('Số tiền chi phải > 0'),
      companyBankAccountId: z.number().int().nullable().optional(),
      description: z.string().trim().nullable().optional(),
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
  .validator(z.object({ lineId: z.number().int() }))
  .handler(async ({ data }) => {
    return suggestMatches(data.lineId)
  })

export const matchStatementLineFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
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
