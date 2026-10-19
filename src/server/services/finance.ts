import { and, eq, gte, isNull, lte, ne, sql } from 'drizzle-orm'

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
  salesOrders,
  suppliers,
  vehicles,
} from '../../db/schema.ts'
import type { MatchType } from '../../db/schema.ts'
import {
  calculateLoanInterest,
  formatDate,
  formatVnd,
  todayIso,
} from '../../lib/business.ts'
import { BusinessError, num } from './common.ts'
import type { Exec } from './common.ts'

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
    asOf,
    principalPaid,
    interestPaid,
    outstanding,
    accruedInterest: interest.totalInterest,
    interestDue: interest.totalInterest - interestPaid,
    segments: interest.segments,
  }
}

/** A voucher/repayment matched to a bank statement line must be un-matched there first */
async function assertNotMatched(type: MatchType, id: number) {
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
      'Khoản này đã khớp với sao kê: hãy hủy khớp ở mục Đối chiếu sao kê trước',
    )
}

export async function recordLoanRepayment(input: {
  loanContractId: number
  paymentDate: string
  principalAmount: number
  interestAmount: number
  companyBankAccountId?: number | null
  note?: string | null
}) {
  const [loan] = await db
    .select()
    .from(loanContracts)
    .where(eq(loanContracts.id, input.loanContractId))
  if (!loan) throw new BusinessError('Không tìm thấy khế ước')

  if (input.paymentDate < loan.disbursementDate) {
    throw new BusinessError(
      `Ngày thanh toán (${formatDate(input.paymentDate)}) không thể trước ngày giải ngân (${formatDate(loan.disbursementDate)})`,
    )
  }

  if (input.principalAmount <= 0 && input.interestAmount <= 0)
    throw new BusinessError('Số tiền trả phải lớn hơn 0')

  const existingRepayments = await db
    .select()
    .from(loanRepayments)
    .where(eq(loanRepayments.loanContractId, input.loanContractId))

  const totalPrincipalPaid = existingRepayments.reduce(
    (s, r) => s + num(r.principalAmount),
    0,
  )
  const remainingPrincipal = num(loan.principalAmount) - totalPrincipalPaid
  if (input.principalAmount > remainingPrincipal + 0.5) {
    throw new BusinessError(
      `Số tiền trả gốc (${formatVnd(input.principalAmount)}) vượt quá dư nợ còn lại (${formatVnd(remainingPrincipal)})`,
    )
  }

  // Calculate accrued interest from disbursement date up to input.paymentDate
  const interestAtPaymentDate = calculateLoanInterest({
    principal: num(loan.principalAmount),
    annualRatePercent: num(loan.interestRate),
    disbursementDate: loan.disbursementDate,
    asOf: input.paymentDate,
    principalRepayments: existingRepayments.map((r) => ({
      date: r.paymentDate,
      amount: num(r.principalAmount),
    })),
  })

  const otherInterestPaid = existingRepayments.reduce(
    (s, r) => s + num(r.interestAmount),
    0,
  )
  const maxAllowedInterest = Math.max(
    0,
    interestAtPaymentDate.totalInterest - otherInterestPaid,
  )

  if (input.interestAmount > maxAllowedInterest + 1.0) {
    throw new BusinessError(
      `Số tiền trả lãi (${formatVnd(input.interestAmount)}) vượt quá số lãi phát sinh lũy kế đến ngày ${formatDate(input.paymentDate)} (tối đa có thể trả: ${formatVnd(maxAllowedInterest)})`,
    )
  }

  await db.insert(loanRepayments).values({
    loanContractId: input.loanContractId,
    paymentDate: input.paymentDate,
    principalAmount: input.principalAmount,
    interestAmount: input.interestAmount,
    companyBankAccountId: input.companyBankAccountId ?? null,
    note: input.note ?? null,
  })
}

export async function updateLoanRepayment(
  id: number,
  input: {
    paymentDate: string
    principalAmount: number
    interestAmount: number
    companyBankAccountId?: number | null
    note?: string | null
  },
) {
  await assertNotMatched('loan_repayment', id)
  const [repayment] = await db
    .select()
    .from(loanRepayments)
    .where(eq(loanRepayments.id, id))
  if (!repayment) throw new BusinessError('Không tìm thấy đợt thanh toán này')

  const [loan] = await db
    .select()
    .from(loanContracts)
    .where(eq(loanContracts.id, repayment.loanContractId))
  if (!loan) throw new BusinessError('Không tìm thấy khế ước')

  if (input.paymentDate < loan.disbursementDate) {
    throw new BusinessError(
      `Ngày thanh toán (${formatDate(input.paymentDate)}) không thể trước ngày giải ngân (${formatDate(loan.disbursementDate)})`,
    )
  }

  if (input.principalAmount <= 0 && input.interestAmount <= 0)
    throw new BusinessError('Số tiền trả phải lớn hơn 0')

  const allRepayments = await db
    .select()
    .from(loanRepayments)
    .where(eq(loanRepayments.loanContractId, repayment.loanContractId))

  const otherRepayments = allRepayments.filter((r) => r.id !== id)

  const otherPrincipalPaid = otherRepayments.reduce(
    (s, r) => s + num(r.principalAmount),
    0,
  )
  const remainingPrincipal = num(loan.principalAmount) - otherPrincipalPaid
  if (input.principalAmount > remainingPrincipal + 0.5) {
    throw new BusinessError(
      `Số tiền trả gốc (${formatVnd(input.principalAmount)}) vượt quá dư nợ còn lại (${formatVnd(remainingPrincipal)})`,
    )
  }

  // Calculate accrued interest from disbursement date up to input.paymentDate
  const interestAtPaymentDate = calculateLoanInterest({
    principal: num(loan.principalAmount),
    annualRatePercent: num(loan.interestRate),
    disbursementDate: loan.disbursementDate,
    asOf: input.paymentDate,
    principalRepayments: otherRepayments.map((r) => ({
      date: r.paymentDate,
      amount: num(r.principalAmount),
    })),
  })

  const otherInterestPaid = otherRepayments.reduce(
    (s, r) => s + num(r.interestAmount),
    0,
  )
  const maxAllowedInterest = Math.max(
    0,
    interestAtPaymentDate.totalInterest - otherInterestPaid,
  )

  if (input.interestAmount > maxAllowedInterest + 1.0) {
    throw new BusinessError(
      `Số tiền trả lãi (${formatVnd(input.interestAmount)}) vượt quá số lãi phát sinh lũy kế đến ngày ${formatDate(input.paymentDate)} (tối đa có thể trả: ${formatVnd(maxAllowedInterest)})`,
    )
  }

  await db
    .update(loanRepayments)
    .set({
      paymentDate: input.paymentDate,
      principalAmount: input.principalAmount,
      interestAmount: input.interestAmount,
      companyBankAccountId: input.companyBankAccountId ?? null,
      note: input.note ?? null,
    })
    .where(eq(loanRepayments.id, id))
}

export async function deleteLoanRepayment(id: number) {
  await assertNotMatched('loan_repayment', id)
  const [repayment] = await db
    .select({ id: loanRepayments.id })
    .from(loanRepayments)
    .where(eq(loanRepayments.id, id))
  if (!repayment) throw new BusinessError('Không tìm thấy đợt thanh toán này')

  await db.delete(loanRepayments).where(eq(loanRepayments.id, id))
}

/* -------------------------------------------------------------------------- */
/* Debt guard: a voucher may never push a balance below zero                  */
/* -------------------------------------------------------------------------- */

/**
 * Refuses a receipt that is larger than what the customer / point of sale
 * still owes. `excludeId` is the voucher being edited (its old amount is not
 * counted as already paid).
 */
async function assertReceiptWithinDebt(
  customerId: number,
  branchId: number | null | undefined,
  amount: number,
  excludeId?: number,
) {
  const branchSold = branchId
    ? eq(salesOrders.branchId, branchId)
    : isNull(salesOrders.branchId)
  const branchPaid = branchId
    ? eq(receiptVouchers.branchId, branchId)
    : isNull(receiptVouchers.branchId)
  const [[sold], [paid], [customer], branch] = await Promise.all([
    db
      .select({ t: sql<string>`coalesce(sum(${salesOrders.totalAmount}),0)` })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.status, 'confirmed'),
          eq(salesOrders.customerId, customerId),
          branchSold,
        ),
      ),
    db
      .select({ t: sql<string>`coalesce(sum(${receiptVouchers.amount}),0)` })
      .from(receiptVouchers)
      .where(
        and(
          eq(receiptVouchers.customerId, customerId),
          branchPaid,
          excludeId ? ne(receiptVouchers.id, excludeId) : undefined,
        ),
      ),
    db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.id, customerId)),
    branchId
      ? db
          .select({ name: posBranches.name })
          .from(posBranches)
          .where(eq(posBranches.id, branchId))
      : Promise.resolve([]),
  ])
  const owed = Math.max(0, num(sold?.t) - num(paid?.t))
  if (amount > owed + 0.5) {
    const who =
      branch[0]?.name ?? `${customer?.name ?? 'khách hàng'} (pháp nhân chính)`
    throw new BusinessError(
      owed <= 0.5
        ? `${who} hiện không còn nợ, không thể lập phiếu thu ${formatVnd(amount)}.`
        : `Số tiền thu ${formatVnd(amount)} vượt quá công nợ còn lại của ${who}: ${formatVnd(owed)} (vượt ${formatVnd(amount - owed)}). Chỉ có thể thu tối đa ${formatVnd(owed)}.`,
    )
  }
}

/** Same for a payment to a supplier: never pay more than is still owed */
async function assertPaymentWithinDebt(
  supplierId: number,
  amount: number,
  excludeId?: number,
) {
  const [[bought], [paid], [supplier]] = await Promise.all([
    db
      .select({ t: sql<string>`coalesce(sum(${vehicles.importPrice}),0)` })
      .from(vehicles)
      .innerJoin(importBatches, eq(importBatches.id, vehicles.batchId))
      .where(eq(importBatches.supplierId, supplierId)),
    db
      .select({ t: sql<string>`coalesce(sum(${paymentVouchers.amount}),0)` })
      .from(paymentVouchers)
      .where(
        and(
          eq(paymentVouchers.payeeType, 'supplier'),
          eq(paymentVouchers.supplierId, supplierId),
          excludeId ? ne(paymentVouchers.id, excludeId) : undefined,
        ),
      ),
    db
      .select({ name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.id, supplierId)),
  ])
  const owed = Math.max(0, num(bought?.t) - num(paid?.t))
  if (amount > owed + 0.5) {
    const who = supplier?.name ?? 'nhà cung cấp'
    throw new BusinessError(
      owed <= 0.5
        ? `Không còn nợ ${who}, không thể lập phiếu chi ${formatVnd(amount)}.`
        : `Số tiền chi ${formatVnd(amount)} vượt quá công nợ còn lại với ${who}: ${formatVnd(owed)} (vượt ${formatVnd(amount - owed)}). Chỉ có thể chi tối đa ${formatVnd(owed)}.`,
    )
  }
}

/**
 * Records the bank movement of a voucher as a statement line that is already
 * matched to it. All such lines of an account go into one "manual" statement.
 */
const MANUAL_STATEMENT_NAME = 'Tạo từ phiếu thu/chi'
async function addMatchedStatementLine(
  tx: Exec,
  v: {
    accountId: number
    date: string
    description: string
    direction: 'in' | 'out'
    amount: number
    type: 'receipt' | 'payment'
    voucherId: number
    userId?: number
  },
) {
  let [statement] = await tx
    .select({ id: bankStatements.id })
    .from(bankStatements)
    .where(
      and(
        eq(bankStatements.companyBankAccountId, v.accountId),
        eq(bankStatements.fileName, MANUAL_STATEMENT_NAME),
      ),
    )
    .limit(1)
  if (!statement) {
    const [created] = await tx
      .insert(bankStatements)
      .values({
        companyBankAccountId: v.accountId,
        fileName: MANUAL_STATEMENT_NAME,
        createdBy: v.userId ?? null,
      })
      .$returningId()
    statement = { id: created.id }
  }
  await tx.insert(bankStatementLines).values({
    statementId: statement.id,
    transactionDate: v.date,
    description: v.description,
    debit: v.direction === 'out' ? v.amount : 0,
    credit: v.direction === 'in' ? v.amount : 0,
    status: 'matched',
    matchedType: v.type,
    matchedId: v.voucherId,
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
    /** Also add a bank statement line, already matched to this receipt */
    createStatementLine?: boolean
  },
  userId?: number,
) {
  const { createStatementLine, ...fields } = input
  if (input.amount <= 0) throw new BusinessError('Số tiền phải lớn hơn 0')
  if (createStatementLine && !input.companyBankAccountId)
    throw new BusinessError('Chọn tài khoản ngân hàng để tạo dòng sao kê')
  if (input.branchId) {
    const [b] = await db
      .select({ customerId: posBranches.customerId })
      .from(posBranches)
      .where(eq(posBranches.id, input.branchId))
    if (!b || b.customerId !== input.customerId)
      throw new BusinessError('Điểm bán không thuộc khách hàng')
  }
  await assertReceiptWithinDebt(input.customerId, input.branchId, input.amount)
  return db.transaction(async (tx) => {
    const [r] = await tx
      .insert(receiptVouchers)
      .values({
        ...fields,
        branchId: input.branchId ?? null,
        salesOrderId: input.salesOrderId ?? null,
        companyBankAccountId: input.companyBankAccountId ?? null,
        createdBy: userId ?? null,
      })
      .$returningId()
    if (createStatementLine && input.companyBankAccountId) {
      const [c] = await tx
        .select({ name: customers.name })
        .from(customers)
        .where(eq(customers.id, input.customerId))
      await addMatchedStatementLine(tx, {
        accountId: input.companyBankAccountId,
        date: input.receiptDate,
        description: `Thu tiền ${c?.name ?? ''}`.trim(),
        direction: 'in',
        amount: input.amount,
        type: 'receipt',
        voucherId: r.id,
        userId,
      })
    }
    return r.id
  })
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
    /** Also add a bank statement line, already matched to this payment */
    createStatementLine?: boolean
  },
  userId?: number,
) {
  const { createStatementLine, ...fields } = input
  if (createStatementLine && !input.companyBankAccountId)
    throw new BusinessError('Chọn tài khoản ngân hàng để tạo dòng sao kê')
  if (input.amount <= 0) throw new BusinessError('Số tiền phải lớn hơn 0')
  if (input.payeeType === 'supplier' && !input.supplierId)
    throw new BusinessError('Chưa chọn nhà cung cấp')
  if (input.payeeType === 'supplier' && input.supplierId)
    await assertPaymentWithinDebt(input.supplierId, input.amount)
  return db.transaction(async (tx) => {
    const [r] = await tx
      .insert(paymentVouchers)
      .values({
        ...fields,
        supplierId:
          input.payeeType === 'supplier' ? (input.supplierId ?? null) : null,
        payeeName: input.payeeName ?? null,
        companyBankAccountId: input.companyBankAccountId ?? null,
        description: input.description ?? null,
        createdBy: userId ?? null,
      })
      .$returningId()
    if (createStatementLine && input.companyBankAccountId) {
      let who = input.payeeName ?? ''
      if (input.payeeType === 'supplier' && input.supplierId) {
        const [s] = await tx
          .select({ name: suppliers.name })
          .from(suppliers)
          .where(eq(suppliers.id, input.supplierId))
        who = s?.name ?? who
      }
      await addMatchedStatementLine(tx, {
        accountId: input.companyBankAccountId,
        date: input.paymentDate,
        description: input.description?.trim() || `Chi tiền ${who}`.trim(),
        direction: 'out',
        amount: input.amount,
        type: 'payment',
        voucherId: r.id,
        userId,
      })
    }
    return r.id
  })
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
  const from = sql`DATE_SUB(${d}, INTERVAL 60 DAY)`
  const to = sql`DATE_ADD(${d}, INTERVAL 60 DAY)`

  const notMatched = (type: MatchType, idCol: unknown) =>
    sql`NOT EXISTS (SELECT 1 FROM ${bankStatementLines} l WHERE l.matched_type = ${type} AND l.matched_id = ${idCol})`

  if (num(line.credit) > 0) {
    const rows = await db
      .select({
        id: receiptVouchers.id,
        number: customers.name,
        date: receiptVouchers.receiptDate,
        amount: receiptVouchers.amount,
        description: sql<string | null>`NULL`,
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
      description: paymentVouchers.description,
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
      description: loanRepayments.note,
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
  await assertReceiptWithinDebt(
    input.customerId,
    input.branchId,
    input.amount,
    id,
  )
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
  await assertPaymentWithinDebt(input.supplierId, input.amount, id)
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
