import { and, eq, gte, lte, sql } from 'drizzle-orm'

import { db } from '../../db/index.ts'
import {
  bankStatementLines,
  bankStatements,
  customers,
  importBatches,
  loanContracts,
  loanRepayments,
  paymentVouchers,
  posBranches,
  receiptVouchers,
  suppliers,
} from '../../db/schema.ts'
import type { MatchType } from '../../db/schema.ts'
import { calculateLoanInterest, todayIso } from '../../lib/business.ts'
import { BusinessError, num } from './common.ts'

/* -------------------------------------------------------------------------- */
/* 04. Bank Loans                                                             */
/* -------------------------------------------------------------------------- */

export async function getLoanStatus(loanId: number, asOf = todayIso()) {
  const [loan] = await db
    .select()
    .from(loanContracts)
    .where(eq(loanContracts.id, loanId))
  if (!loan) throw new BusinessError('Không tìm thấy khế ước')
  const repayments = await db
    .select()
    .from(loanRepayments)
    .where(eq(loanRepayments.loanContractId, loanId))
    .orderBy(loanRepayments.paymentDate, loanRepayments.id)
  const batches = await db
    .select({
      id: importBatches.id,
      importDate: importBatches.importDate,
      supplierName: suppliers.name,
    })
    .from(importBatches)
    .innerJoin(suppliers, eq(suppliers.id, importBatches.supplierId))
    .where(eq(importBatches.loanContractId, loanId))
    .orderBy(importBatches.importDate)

  const interest = calculateLoanInterest({
    principal: num(loan.principalAmount),
    annualRatePercent: num(loan.interestRate),
    disbursementDate: loan.disbursementDate,
    asOf,
    principalRepayments: repayments.map((r) => ({
      date: r.paymentDate,
      amount: num(r.principalAmount),
    })),
  })
  const principalPaid = repayments.reduce(
    (s, r) => s + num(r.principalAmount),
    0,
  )
  const interestPaid = repayments.reduce((s, r) => s + num(r.interestAmount), 0)
  const outstanding = num(loan.principalAmount) - principalPaid
  return {
    // status is derived: settled once no principal remains
    loan: {
      ...loan,
      status: outstanding <= 0.5 ? ('settled' as const) : ('active' as const),
    },
    repayments,
    batches,
    asOf,
    principalPaid,
    interestPaid,
    outstanding,
    accruedInterest: interest.totalInterest,
    interestDue: interest.totalInterest - interestPaid,
    segments: interest.segments,
  }
}

export async function recordLoanRepayment(input: {
  loanContractId: number
  paymentDate: string
  principalAmount: number
  interestAmount: number
  companyBankAccountId?: number | null
  note?: string | null
}) {
  const status = await getLoanStatus(input.loanContractId, input.paymentDate)
  if (input.principalAmount > status.outstanding + 0.5)
    throw new BusinessError('Số tiền trả gốc vượt quá dư nợ còn lại')
  if (input.principalAmount <= 0 && input.interestAmount <= 0)
    throw new BusinessError('Số tiền trả phải lớn hơn 0')
  await db.insert(loanRepayments).values({
    loanContractId: input.loanContractId,
    paymentDate: input.paymentDate,
    principalAmount: input.principalAmount,
    interestAmount: input.interestAmount,
    companyBankAccountId: input.companyBankAccountId ?? null,
    note: input.note ?? null,
  })
}

/* -------------------------------------------------------------------------- */
/* 08. Receipt Vouchers                                                       */
/* -------------------------------------------------------------------------- */

export async function createReceiptVoucher(
  input: {
    receiptDate: string
    customerId: number
    branchId?: number | null
    salesOrderId?: number | null
    amount: number
    companyBankAccountId?: number | null
  },
  userId?: number,
) {
  if (input.amount <= 0) throw new BusinessError('Số tiền phải lớn hơn 0')
  if (input.branchId) {
    const [b] = await db
      .select({ customerId: posBranches.customerId })
      .from(posBranches)
      .where(eq(posBranches.id, input.branchId))
    if (!b || b.customerId !== input.customerId)
      throw new BusinessError('Điểm bán không thuộc khách hàng')
  }
  const [r] = await db
    .insert(receiptVouchers)
    .values({
      ...input,
      branchId: input.branchId ?? null,
      salesOrderId: input.salesOrderId ?? null,
      companyBankAccountId: input.companyBankAccountId ?? null,
      createdBy: userId ?? null,
    })
    .$returningId()
  return r.id
}

/* -------------------------------------------------------------------------- */
/* 09. Payment Vouchers                                                       */
/* -------------------------------------------------------------------------- */

export async function createPaymentVoucher(
  input: {
    paymentDate: string
    payeeType: 'supplier' | 'other'
    supplierId?: number | null
    payeeName?: string | null
    amount: number
    companyBankAccountId?: number | null
    description?: string | null
  },
  userId?: number,
) {
  if (input.amount <= 0) throw new BusinessError('Số tiền phải lớn hơn 0')
  if (input.payeeType === 'supplier' && !input.supplierId)
    throw new BusinessError('Chưa chọn nhà cung cấp')
  const [r] = await db
    .insert(paymentVouchers)
    .values({
      ...input,
      supplierId:
        input.payeeType === 'supplier' ? (input.supplierId ?? null) : null,
      payeeName: input.payeeName ?? null,
      companyBankAccountId: input.companyBankAccountId ?? null,
      description: input.description ?? null,
      createdBy: userId ?? null,
    })
    .$returningId()
  return r.id
}

/* -------------------------------------------------------------------------- */
/* 10. Bank Statements                                                        */
/* -------------------------------------------------------------------------- */

export interface StatementLineInput {
  transactionDate: string
  description?: string | null
  debit: number
  credit: number
  balance?: number | null
}

export async function importBankStatement(
  input: {
    companyBankAccountId: number
    fileName?: string | null
    lines: StatementLineInput[]
  },
  userId?: number,
) {
  if (input.lines.length === 0)
    throw new BusinessError('Sao kê không có dòng nào')
  return db.transaction(async (tx) => {
    const [s] = await tx
      .insert(bankStatements)
      .values({
        companyBankAccountId: input.companyBankAccountId,
        fileName: input.fileName ?? null,
        createdBy: userId ?? null,
      })
      .$returningId()
    await tx.insert(bankStatementLines).values(
      input.lines.map((l) => ({
        statementId: s.id,
        transactionDate: l.transactionDate,
        description: l.description ?? null,
        debit: l.debit,
        credit: l.credit,
        balance: l.balance ?? null,
      })),
    )
    return s.id
  })
}

/** Candidate suggestions: matching amount, date diff <= 5 days, currently unmatched */
export async function suggestMatches(lineId: number) {
  const [line] = await db
    .select()
    .from(bankStatementLines)
    .where(eq(bankStatementLines.id, lineId))
  if (!line) throw new BusinessError('Không tìm thấy dòng sao kê')
  const d = line.transactionDate
  const from = sql`DATE_SUB(${d}, INTERVAL 5 DAY)`
  const to = sql`DATE_ADD(${d}, INTERVAL 5 DAY)`

  const notMatched = (type: MatchType, idCol: unknown) =>
    sql`NOT EXISTS (SELECT 1 FROM ${bankStatementLines} l WHERE l.matched_type = ${type} AND l.matched_id = ${idCol})`

  if (num(line.credit) > 0) {
    const rows = await db
      .select({
        id: receiptVouchers.id,
        number: customers.name,
        date: receiptVouchers.receiptDate,
        amount: receiptVouchers.amount,
      })
      .from(receiptVouchers)
      .innerJoin(customers, eq(customers.id, receiptVouchers.customerId))
      .where(
        and(
          eq(receiptVouchers.amount, num(line.credit)),
          gte(receiptVouchers.receiptDate, from),
          lte(receiptVouchers.receiptDate, to),
          notMatched('receipt', receiptVouchers.id),
        ),
      )
    return rows.map((r) => ({
      type: 'receipt' as const,
      ...r,
      amount: num(r.amount),
    }))
  }

  const payments = await db
    .select({
      id: paymentVouchers.id,
      number: sql<string>`coalesce(${suppliers.name}, ${paymentVouchers.payeeName}, '')`,
      date: paymentVouchers.paymentDate,
      amount: paymentVouchers.amount,
    })
    .from(paymentVouchers)
    .leftJoin(suppliers, eq(suppliers.id, paymentVouchers.supplierId))
    .where(
      and(
        eq(paymentVouchers.amount, num(line.debit)),
        gte(paymentVouchers.paymentDate, from),
        lte(paymentVouchers.paymentDate, to),
        notMatched('payment', paymentVouchers.id),
      ),
    )
  const loans = await db
    .select({
      id: loanRepayments.id,
      number: loanContracts.contractNumber,
      date: loanRepayments.paymentDate,
      amount: sql<string>`${loanRepayments.principalAmount} + ${loanRepayments.interestAmount}`,
    })
    .from(loanRepayments)
    .innerJoin(
      loanContracts,
      eq(loanContracts.id, loanRepayments.loanContractId),
    )
    .where(
      and(
        sql`${loanRepayments.principalAmount} + ${loanRepayments.interestAmount} = ${num(line.debit)}`,
        gte(loanRepayments.paymentDate, from),
        lte(loanRepayments.paymentDate, to),
        notMatched('loan_repayment', loanRepayments.id),
      ),
    )
  return [
    ...payments.map((r) => ({
      type: 'payment' as const,
      ...r,
      amount: num(r.amount),
    })),
    ...loans.map((r) => ({
      type: 'loan_repayment' as const,
      ...r,
      amount: num(r.amount),
    })),
  ]
}

export async function matchStatementLine(
  lineId: number,
  matchedType: MatchType,
  matchedId: number,
) {
  await db
    .update(bankStatementLines)
    .set({ status: 'matched', matchedType, matchedId })
    .where(eq(bankStatementLines.id, lineId))
}

export async function setStatementLineStatus(
  lineId: number,
  status: 'unmatched' | 'ignored',
) {
  await db
    .update(bankStatementLines)
    .set({ status, matchedType: null, matchedId: null })
    .where(eq(bankStatementLines.id, lineId))
}

/** A matched line is tied to a voucher / repayment: it must be un-matched first */
async function getEditableLine(lineId: number) {
  const [line] = await db
    .select({ id: bankStatementLines.id, status: bankStatementLines.status })
    .from(bankStatementLines)
    .where(eq(bankStatementLines.id, lineId))
  if (!line) throw new BusinessError('Không tìm thấy dòng sao kê')
  if (line.status === 'matched')
    throw new BusinessError('Dòng đã khớp: hãy hủy khớp trước khi sửa hoặc xóa')
  return line
}

export async function updateStatementLine(
  lineId: number,
  v: {
    transactionDate: string
    description: string | null
    debit: number
    credit: number
  },
) {
  await getEditableLine(lineId)
  if (v.debit > 0 === v.credit > 0)
    throw new BusinessError('Nhập tiền ra hoặc tiền vào (chỉ một bên)')
  await db
    .update(bankStatementLines)
    .set(v)
    .where(eq(bankStatementLines.id, lineId))
}

export async function deleteStatementLine(lineId: number) {
  await getEditableLine(lineId)
  await db.delete(bankStatementLines).where(eq(bankStatementLines.id, lineId))
}

/** A voucher matched to a bank statement line must be un-matched there first */
async function assertNotMatched(type: 'receipt' | 'payment', id: number) {
  const [m] = await db
    .select({ id: bankStatementLines.id })
    .from(bankStatementLines)
    .where(
      and(
        eq(bankStatementLines.status, 'matched'),
        eq(bankStatementLines.matchedType, type),
        eq(bankStatementLines.matchedId, id),
      ),
    )
    .limit(1)
  if (m)
    throw new BusinessError(
      'Phiếu đã khớp với sao kê: hãy hủy khớp ở mục Đối chiếu sao kê trước',
    )
}

export async function updateReceiptVoucher(
  id: number,
  input: {
    receiptDate: string
    customerId: number
    branchId?: number | null
    amount: number
    companyBankAccountId?: number | null
  },
) {
  await assertNotMatched('receipt', id)
  if (input.amount <= 0) throw new BusinessError('Số tiền phải lớn hơn 0')
  if (input.branchId) {
    const [b] = await db
      .select({ customerId: posBranches.customerId })
      .from(posBranches)
      .where(eq(posBranches.id, input.branchId))
    if (!b || b.customerId !== input.customerId)
      throw new BusinessError('Điểm bán không thuộc khách hàng')
  }
  await db
    .update(receiptVouchers)
    .set({
      receiptDate: input.receiptDate,
      customerId: input.customerId,
      branchId: input.branchId ?? null,
      amount: input.amount,
      companyBankAccountId: input.companyBankAccountId ?? null,
    })
    .where(eq(receiptVouchers.id, id))
}

export async function deleteReceiptVoucher(id: number) {
  await assertNotMatched('receipt', id)
  await db.delete(receiptVouchers).where(eq(receiptVouchers.id, id))
}

export async function updatePaymentVoucher(
  id: number,
  input: {
    paymentDate: string
    supplierId: number
    amount: number
    companyBankAccountId?: number | null
    description?: string | null
  },
) {
  await assertNotMatched('payment', id)
  if (input.amount <= 0) throw new BusinessError('Số tiền phải lớn hơn 0')
  await db
    .update(paymentVouchers)
    .set({
      paymentDate: input.paymentDate,
      supplierId: input.supplierId,
      amount: input.amount,
      companyBankAccountId: input.companyBankAccountId ?? null,
      description: input.description ?? null,
    })
    .where(eq(paymentVouchers.id, id))
}

export async function deletePaymentVoucher(id: number) {
  await assertNotMatched('payment', id)
  await db.delete(paymentVouchers).where(eq(paymentVouchers.id, id))
}
