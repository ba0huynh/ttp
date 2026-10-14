import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm'

import { db } from '../../db/index.ts'
import {
  bankStatementLines,
  bankStatements,
  loanContracts,
  loanRepayments,
  paymentVouchers,
  posBranches,
  receiptVouchers,
} from '../../db/schema.ts'
import type { MatchType } from '../../db/schema.ts'
import { calculateLoanInterest, todayIso } from '../../lib/business.ts'
import { BusinessError, nextDocNumber, num } from './common.ts'

/* -------------------------------------------------------------------------- */
/* 04. Khoản vay                                                              */
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
  return {
    loan,
    repayments,
    asOf,
    principalPaid,
    interestPaid,
    outstanding: num(loan.principalAmount) - principalPaid,
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
  await db.transaction(async (tx) => {
    await tx.insert(loanRepayments).values({
      loanContractId: input.loanContractId,
      paymentDate: input.paymentDate,
      principalAmount: input.principalAmount,
      interestAmount: input.interestAmount,
      companyBankAccountId: input.companyBankAccountId ?? null,
      note: input.note ?? null,
    })
    const remaining = status.outstanding - input.principalAmount
    await tx
      .update(loanContracts)
      .set({ status: remaining <= 0.5 ? 'settled' : 'active' })
      .where(eq(loanContracts.id, input.loanContractId))
  })
}

/* -------------------------------------------------------------------------- */
/* 08. Phiếu thu                                                              */
/* -------------------------------------------------------------------------- */

export async function createReceiptVoucher(
  input: {
    receiptDate: string
    customerId: number
    branchId?: number | null
    salesOrderId?: number | null
    amount: number
    method: 'cash' | 'bank_transfer'
    companyBankAccountId?: number | null
    note?: string | null
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
  const voucherNumber = await nextDocNumber(
    db,
    receiptVouchers,
    receiptVouchers.voucherNumber,
    'PT',
    input.receiptDate,
  )
  const [r] = await db
    .insert(receiptVouchers)
    .values({
      ...input,
      voucherNumber,
      branchId: input.branchId ?? null,
      salesOrderId: input.salesOrderId ?? null,
      companyBankAccountId:
        input.method === 'bank_transfer'
          ? (input.companyBankAccountId ?? null)
          : null,
      note: input.note ?? null,
      createdBy: userId ?? null,
    })
    .$returningId()
  return r.id
}

/* -------------------------------------------------------------------------- */
/* 09. Phiếu chi                                                              */
/* -------------------------------------------------------------------------- */

export async function createPaymentVoucher(
  input: {
    paymentDate: string
    payeeType: 'supplier' | 'other'
    supplierId?: number | null
    batchId?: number | null
    payeeName?: string | null
    amount: number
    method: 'cash' | 'bank_transfer'
    companyBankAccountId?: number | null
    description?: string | null
  },
  userId?: number,
) {
  if (input.amount <= 0) throw new BusinessError('Số tiền phải lớn hơn 0')
  if (input.payeeType === 'supplier' && !input.supplierId)
    throw new BusinessError('Chưa chọn nhà cung cấp')
  const voucherNumber = await nextDocNumber(
    db,
    paymentVouchers,
    paymentVouchers.voucherNumber,
    'PC',
    input.paymentDate,
  )
  const [r] = await db
    .insert(paymentVouchers)
    .values({
      ...input,
      voucherNumber,
      supplierId:
        input.payeeType === 'supplier' ? (input.supplierId ?? null) : null,
      batchId: input.batchId ?? null,
      payeeName: input.payeeName ?? null,
      companyBankAccountId:
        input.method === 'bank_transfer'
          ? (input.companyBankAccountId ?? null)
          : null,
      description: input.description ?? null,
      createdBy: userId ?? null,
    })
    .$returningId()
  return r.id
}

/* -------------------------------------------------------------------------- */
/* 10. Sao kê ngân hàng                                                       */
/* -------------------------------------------------------------------------- */

export interface StatementLineInput {
  transactionDate: string
  reference?: string | null
  description?: string | null
  debit: number
  credit: number
  balance?: number | null
}

export async function importBankStatement(
  input: {
    companyBankAccountId: number
    periodFrom: string
    periodTo: string
    fileName?: string | null
    note?: string | null
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
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        fileName: input.fileName ?? null,
        note: input.note ?? null,
        createdBy: userId ?? null,
      })
      .$returningId()
    await tx.insert(bankStatementLines).values(
      input.lines.map((l) => ({
        statementId: s.id,
        transactionDate: l.transactionDate,
        reference: l.reference ?? null,
        description: l.description ?? null,
        debit: l.debit,
        credit: l.credit,
        balance: l.balance ?? null,
      })),
    )
    return s.id
  })
}

/** Gợi ý chứng từ khớp: cùng số tiền, lệch ≤ 5 ngày, chưa được khớp */
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
        number: receiptVouchers.voucherNumber,
        date: receiptVouchers.receiptDate,
        amount: receiptVouchers.amount,
      })
      .from(receiptVouchers)
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
      number: paymentVouchers.voucherNumber,
      date: paymentVouchers.paymentDate,
      amount: paymentVouchers.amount,
    })
    .from(paymentVouchers)
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

/** Tự động khớp các dòng có đúng 1 gợi ý duy nhất */
export async function autoMatchStatement(statementId: number) {
  const lines = await db
    .select({ id: bankStatementLines.id })
    .from(bankStatementLines)
    .where(
      and(
        eq(bankStatementLines.statementId, statementId),
        eq(bankStatementLines.status, 'unmatched'),
        isNull(bankStatementLines.matchedId),
      ),
    )
  let matched = 0
  for (const l of lines) {
    const s = await suggestMatches(l.id)
    if (s.length === 1) {
      await matchStatementLine(l.id, s[0].type, s[0].id)
      matched++
    }
  }
  return { matched, total: lines.length }
}
