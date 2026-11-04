import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import {
  MATCH_TYPES,
  PAYEE_TYPES,
  bankStatementLines,
  bankStatements,
  banks,
  batchExpenses,
  importBatches,
  salesOrderItems,
  salesOrders,
  vehicles,
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
import { formatVnd } from '#/lib/business.ts'
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
        bankId: banks.id,
        bankName: banks.name,
        bankImage: banks.image,
        bankCode: banks.code,
        accountNumber: loanContracts.accountNumber,
        principalAmount: loanContracts.principalAmount,
        interestRate: loanContracts.interestRate,
        disbursementDate: loanContracts.disbursementDate,
        termMonths: loanContracts.termMonths,
        principalPaid: sql<string>`coalesce((select sum(r.principal_amount) from ${loanRepayments} r where r.loan_contract_id = ${loanContracts.id}),0)`,
        interestPaid: sql<string>`coalesce((select sum(r.interest_amount) from ${loanRepayments} r where r.loan_contract_id = ${loanContracts.id}),0)`,
      })
      .from(loanContracts)
      .leftJoin(banks, eq(banks.id, loanContracts.bankId))
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
      principalAmount: z.number().positive('Số tiền vay phải > 0'),
      interestRate: z.number().min(0, 'Lãi suất %/năm'),
      disbursementDate: z.string().min(10),
      termMonths: z.number().int().min(1).max(200),
      bankId: z.number().int({ message: 'Chọn ngân hàng' }),
      accountNumber: z.string().trim().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { id, accountNumber, ...v } = data
      const values = {
        ...v,
        accountNumber: accountNumber?.trim() ? accountNumber.trim() : null,
      }
      if (id) {
        await db.update(loanContracts).set(values).where(eq(loanContracts.id, id))
        return { id }
      }
      const [created] = await db.insert(loanContracts).values(values).$returningId()
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

const dateRangeInput = z
  .object({ from: z.string().optional(), to: z.string().optional() })
  .optional()

export const getReceivablesFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('finance.view')])
  .validator(dateRangeInput)
  .handler(async ({ data }) => {
    return getReceivablesSummary(data ?? {})
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
        note: receiptVouchers.note,
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
      note: z.string().max(255, 'Ghi chú tối đa 255 ký tự').nullable().optional(),
      createStatementLine: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const id = await createReceiptVoucher(data, context.user.id)
    return { id }
  })

/** Confirmed sales orders behind one receivable row (customer + receiving entity) */
export const listReceivableOrdersFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('finance.view')])
  .validator(
    z.object({
      customerId: z.number().int(),
      branchId: z.number().int().nullable(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const rows = await db
      .select({
        id: salesOrders.id,
        orderDate: salesOrders.orderDate,
        totalAmount: salesOrders.totalAmount,
        vehicleCount: sql<number>`count(${salesOrderItems.id})`,
        totalBeforeVat: sql<string>`coalesce(sum(${salesOrderItems.priceBeforeVat}),0)`,
        // Same cost basis as the /sales list and /reports (import price before VAT + allocated expense)
        totalCost: sql<string>`coalesce(sum(${salesOrderItems.costPrice} - greatest(${vehicles.importPriceWithVat} - ${vehicles.importPrice}, 0)),0)`,
        minVatRate: sql<string>`coalesce(min(${salesOrderItems.vatRate}),0)`,
        maxVatRate: sql<string>`coalesce(max(${salesOrderItems.vatRate}),0)`,
        deliveredCount: sql<number>`count(distinct case when ${vehicles.isDelivered} = 1 then ${vehicles.id} end)`,
        invoicedCount: sql<number>`count(distinct case when ${vehicles.isInvoiced} = 1 then ${vehicles.id} end)`,
      })
      .from(salesOrders)
      .leftJoin(
        salesOrderItems,
        eq(salesOrderItems.salesOrderId, salesOrders.id),
      )
      .leftJoin(vehicles, eq(vehicles.id, salesOrderItems.vehicleId))
      .where(
        and(
          eq(salesOrders.customerId, data.customerId),
          eq(salesOrders.status, 'confirmed'),
          data.from ? gte(salesOrders.orderDate, data.from) : undefined,
          data.to ? lte(salesOrders.orderDate, data.to) : undefined,
          data.branchId
            ? eq(salesOrders.branchId, data.branchId)
            : sql`${salesOrders.branchId} is null`,
        ),
      )
      .groupBy(salesOrders.id, salesOrders.orderDate, salesOrders.totalAmount)
      .orderBy(desc(salesOrders.orderDate), desc(salesOrders.id))
    return rows.map((r) => ({
      ...r,
      totalAmount: num(r.totalAmount),
      totalBeforeVat: num(r.totalBeforeVat),
      totalCost: num(r.totalCost),
      minVatRate: num(r.minVatRate),
      maxVatRate: num(r.maxVatRate),
      vehicleCount: Number(r.vehicleCount),
      deliveredCount: Number(r.deliveredCount),
      invoicedCount: Number(r.invoicedCount),
    }))
  })

/* -------------------------------------------------------------------------- */
/* 09. Accounts Payable (AP) & Payments                                       */
/* -------------------------------------------------------------------------- */

/** Import batches behind one payable row (one supplier) */
export const listSupplierBatchesFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('finance.view')])
  .validator(
    z.object({
      supplierId: z.number().int(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const rows = await db
      .select({
        id: importBatches.id,
        importDate: importBatches.importDate,
        loanContractId: importBatches.loanContractId,
        loanContractNumber: loanContracts.contractNumber,
        vehicleCount: sql<number>`count(${vehicles.id})`,
        totalBeforeVat: sql<string>`coalesce(sum(${vehicles.importPrice}),0)`,
        minVatRate: sql<string>`coalesce(min(${vehicles.vatRate}),0)`,
        maxVatRate: sql<string>`coalesce(max(${vehicles.vatRate}),0)`,
        deliveredCount: sql<number>`coalesce(sum(case when ${vehicles.isDelivered} = 1 then 1 else 0 end),0)`,
        invoicedCount: sql<number>`coalesce(sum(case when ${vehicles.isInvoiced} = 1 then 1 else 0 end),0)`,
        totalImport: sql<string>`coalesce(sum(${vehicles.importPriceWithVat}),0)`,
        totalExpense: sql<string>`coalesce((select sum(e.amount) from ${batchExpenses} e where e.batch_id = ${importBatches.id}),0)`,
      })
      .from(importBatches)
      .leftJoin(vehicles, eq(vehicles.batchId, importBatches.id))
      .leftJoin(
        loanContracts,
        eq(loanContracts.id, importBatches.loanContractId),
      )
      // Every batch of the supplier; loan-financed ones are shown with their
      // loan but do not count toward the supplier debt (Lesson 205)
      .where(
        and(
          eq(importBatches.supplierId, data.supplierId),
          data.from ? gte(importBatches.importDate, data.from) : undefined,
          data.to ? lte(importBatches.importDate, data.to) : undefined,
        ),
      )
      .groupBy(
        importBatches.id,
        importBatches.importDate,
        importBatches.loanContractId,
        loanContracts.contractNumber,
      )
      .orderBy(desc(importBatches.importDate), desc(importBatches.id))
    return rows.map((r) => ({
      ...r,
      vehicleCount: Number(r.vehicleCount),
      totalBeforeVat: num(r.totalBeforeVat),
      minVatRate: num(r.minVatRate),
      maxVatRate: num(r.maxVatRate),
      deliveredCount: Number(r.deliveredCount),
      invoicedCount: Number(r.invoicedCount),
      totalImport: num(r.totalImport),
      totalExpense: num(r.totalExpense),
      // Cost = import price before VAT + batch expenses (same basis as /sales and /reports)
      totalCost: num(r.totalBeforeVat) + num(r.totalExpense),
    }))
  })

export const getPayablesFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('finance.view')])
  .validator(dateRangeInput)
  .handler(async ({ data }) => {
    return getPayablesSummary(data ?? {})
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

export const listReconciliationLinesFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('reconcile.view')])
  .validator(
    z.object({
      accountId: z.number().int().optional(),
    }),
  )
  .handler(async ({ data }) => {
    // 1. Get active company bank accounts with counts
    const accounts = await db
      .select({
        id: companyBankAccounts.id,
        accountNumber: companyBankAccounts.accountNumber,
        accountName: companyBankAccounts.accountName,
        bankName: banks.name,
        bankShortName: banks.shortName,
        bankCode: banks.code,
        bankImage: banks.image,
        totalLines: sql<number>`count(${bankStatementLines.id})`,
        unmatchedLines: sql<number>`sum(case when ${bankStatementLines.status} = 'unmatched' then 1 else 0 end)`,
        matchedLines: sql<number>`sum(case when ${bankStatementLines.status} = 'matched' then 1 else 0 end)`,
      })
      .from(companyBankAccounts)
      .innerJoin(banks, eq(banks.id, companyBankAccounts.bankId))
      .leftJoin(
        bankStatements,
        eq(bankStatements.companyBankAccountId, companyBankAccounts.id),
      )
      .leftJoin(
        bankStatementLines,
        eq(bankStatementLines.statementId, bankStatements.id),
      )
      .where(eq(companyBankAccounts.isActive, true))
      .groupBy(
        companyBankAccounts.id,
        companyBankAccounts.accountNumber,
        companyBankAccounts.accountName,
        banks.name,
        banks.shortName,
        banks.code,
        banks.image,
      )
      .orderBy(asc(banks.name), asc(companyBankAccounts.accountNumber))

    // 2. Query statement lines
    const conditions = []
    if (data?.accountId) {
      conditions.push(eq(companyBankAccounts.id, data.accountId))
    }

    const lines = await db
      .select({
        id: bankStatementLines.id,
        statementId: bankStatementLines.statementId,
        transactionDate: bankStatementLines.transactionDate,
        description: bankStatementLines.description,
        debit: bankStatementLines.debit,
        credit: bankStatementLines.credit,
        balance: bankStatementLines.balance,
        status: bankStatementLines.status,
        matchedType: bankStatementLines.matchedType,
        matchedId: bankStatementLines.matchedId,
        createdAt: bankStatementLines.createdAt,
        companyBankAccountId: companyBankAccounts.id,
        accountNumber: companyBankAccounts.accountNumber,
        bankName: banks.name,
        bankShortName: banks.shortName,
        bankCode: banks.code,
        bankImage: banks.image,
        statementFileName: bankStatements.fileName,
      })
      .from(bankStatementLines)
      .innerJoin(
        bankStatements,
        eq(bankStatements.id, bankStatementLines.statementId),
      )
      .innerJoin(
        companyBankAccounts,
        eq(companyBankAccounts.id, bankStatements.companyBankAccountId),
      )
      .innerJoin(banks, eq(banks.id, companyBankAccounts.bankId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        desc(bankStatementLines.transactionDate),
        desc(bankStatementLines.id),
      )

    // 3. Batch enrich matched lines
    const receiptIds = lines
      .filter(
        (l) =>
          l.status === 'matched' &&
          l.matchedType === 'receipt' &&
          l.matchedId !== null,
      )
      .map((l) => l.matchedId as number)
    const paymentIds = lines
      .filter(
        (l) =>
          l.status === 'matched' &&
          l.matchedType === 'payment' &&
          l.matchedId !== null,
      )
      .map((l) => l.matchedId as number)
    const loanIds = lines
      .filter(
        (l) =>
          l.status === 'matched' &&
          l.matchedType === 'loan_repayment' &&
          l.matchedId !== null,
      )
      .map((l) => l.matchedId as number)

    const [receiptRows, paymentRows, loanRows] = await Promise.all([
      receiptIds.length > 0
        ? db
            .select({
              id: receiptVouchers.id,
              date: receiptVouchers.receiptDate,
              amount: receiptVouchers.amount,
              customerName: customers.name,
              branchName: posBranches.name,
              salesOrderId: receiptVouchers.salesOrderId,
            })
            .from(receiptVouchers)
            .innerJoin(customers, eq(customers.id, receiptVouchers.customerId))
            .leftJoin(posBranches, eq(posBranches.id, receiptVouchers.branchId))
            .where(inArray(receiptVouchers.id, receiptIds))
        : [],
      paymentIds.length > 0
        ? db
            .select({
              id: paymentVouchers.id,
              date: paymentVouchers.paymentDate,
              amount: paymentVouchers.amount,
              payeeType: paymentVouchers.payeeType,
              supplierName: suppliers.name,
              payeeName: paymentVouchers.payeeName,
              description: paymentVouchers.description,
            })
            .from(paymentVouchers)
            .leftJoin(suppliers, eq(suppliers.id, paymentVouchers.supplierId))
            .where(inArray(paymentVouchers.id, paymentIds))
        : [],
      loanIds.length > 0
        ? db
            .select({
              id: loanRepayments.id,
              date: loanRepayments.paymentDate,
              principalAmount: loanRepayments.principalAmount,
              interestAmount: loanRepayments.interestAmount,
              note: loanRepayments.note,
              contractNumber: loanContracts.contractNumber,
              bankName: banks.name,
              loanContractId: loanContracts.id,
            })
            .from(loanRepayments)
            .innerJoin(
              loanContracts,
              eq(loanContracts.id, loanRepayments.loanContractId),
            )
            .leftJoin(banks, eq(banks.id, loanContracts.bankId))
            .where(inArray(loanRepayments.id, loanIds))
        : [],
    ])

    const receiptMap = new Map(receiptRows.map((r) => [r.id, r]))
    const paymentMap = new Map(paymentRows.map((p) => [p.id, p]))
    const loanMap = new Map(loanRows.map((m) => [m.id, m]))

    const enrichedLines = lines.map((l) => {
      let matchedInfo: {
        type: 'receipt' | 'payment' | 'loan_repayment'
        typeLabel: string
        id: number
        date: string
        party: string
        amount: number
        principalAmount?: number
        interestAmount?: number
        details: string
        targetUrl: string
      } | null = null

      if (l.status === 'matched' && l.matchedId) {
        if (l.matchedType === 'receipt') {
          const r = receiptMap.get(l.matchedId)
          if (r) {
            matchedInfo = {
              type: 'receipt',
              typeLabel: 'Phiếu thu',
              id: r.id,
              date: r.date,
              party: r.branchName
                ? `${r.customerName} (${r.branchName})`
                : r.customerName,
              amount: num(r.amount),
              details: r.salesOrderId
                ? `Đơn hàng #${r.salesOrderId}`
                : 'Thu công nợ khách hàng',
              targetUrl: '/finance?tab=receipts',
            }
          }
        } else if (l.matchedType === 'payment') {
          const p = paymentMap.get(l.matchedId)
          if (p) {
            matchedInfo = {
              type: 'payment',
              typeLabel: 'Phiếu chi',
              id: p.id,
              date: p.date,
              party: p.supplierName || p.payeeName || 'Khác',
              amount: num(p.amount),
              details: p.description || 'Chi thanh toán',
              targetUrl: '/finance?tab=payments',
            }
          }
        } else if (l.matchedType === 'loan_repayment') {
          const m = loanMap.get(l.matchedId)
          if (m) {
            const principal = num(m.principalAmount)
            const interest = num(m.interestAmount)
            matchedInfo = {
              type: 'loan_repayment',
              typeLabel: 'Trả nợ khế ước',
              id: m.id,
              date: m.date,
              party: `HĐ ${m.contractNumber} · ${m.bankName}`,
              amount: principal + interest,
              principalAmount: principal,
              interestAmount: interest,
              details:
                m.note ||
                `Gốc: ${formatVnd(principal)} · Lãi: ${formatVnd(interest)}`,
              targetUrl: '/loans',
            }
          }
        }
      }

      return {
        ...l,
        debit: num(l.debit),
        credit: num(l.credit),
        balance: l.balance !== null ? num(l.balance) : null,
        matchedInfo,
      }
    })

    return {
      accounts: accounts.map((a) => ({
        ...a,
        totalLines: num(a.totalLines),
        unmatchedLines: num(a.unmatchedLines),
        matchedLines: num(a.matchedLines),
      })),
      lines: enrichedLines,
    }
  })

export const listBankStatementsFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('reconcile.view')])
  .handler(async () => {
    const list = await db
      .select({
        id: bankStatements.id,
        fileName: bankStatements.fileName,
        accountNumber: companyBankAccounts.accountNumber,
        bankName: banks.name,
        bankShortName: banks.shortName,
        bankCode: banks.code,
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
        banks.shortName,
        banks.code,
        banks.image,
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
        bankShortName: banks.shortName,
        bankCode: banks.code,
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

    const receiptIds = lines
      .filter(
        (l) =>
          l.status === 'matched' &&
          l.matchedType === 'receipt' &&
          l.matchedId !== null,
      )
      .map((l) => l.matchedId as number)
    const paymentIds = lines
      .filter(
        (l) =>
          l.status === 'matched' &&
          l.matchedType === 'payment' &&
          l.matchedId !== null,
      )
      .map((l) => l.matchedId as number)
    const loanIds = lines
      .filter(
        (l) =>
          l.status === 'matched' &&
          l.matchedType === 'loan_repayment' &&
          l.matchedId !== null,
      )
      .map((l) => l.matchedId as number)

    const [receiptRows, paymentRows, loanRows] = await Promise.all([
      receiptIds.length > 0
        ? db
            .select({
              id: receiptVouchers.id,
              date: receiptVouchers.receiptDate,
              amount: receiptVouchers.amount,
              customerName: customers.name,
              branchName: posBranches.name,
              salesOrderId: receiptVouchers.salesOrderId,
            })
            .from(receiptVouchers)
            .innerJoin(customers, eq(customers.id, receiptVouchers.customerId))
            .leftJoin(posBranches, eq(posBranches.id, receiptVouchers.branchId))
            .where(inArray(receiptVouchers.id, receiptIds))
        : [],
      paymentIds.length > 0
        ? db
            .select({
              id: paymentVouchers.id,
              date: paymentVouchers.paymentDate,
              amount: paymentVouchers.amount,
              payeeType: paymentVouchers.payeeType,
              supplierName: suppliers.name,
              payeeName: paymentVouchers.payeeName,
              description: paymentVouchers.description,
            })
            .from(paymentVouchers)
            .leftJoin(suppliers, eq(suppliers.id, paymentVouchers.supplierId))
            .where(inArray(paymentVouchers.id, paymentIds))
        : [],
      loanIds.length > 0
        ? db
            .select({
              id: loanRepayments.id,
              date: loanRepayments.paymentDate,
              principalAmount: loanRepayments.principalAmount,
              interestAmount: loanRepayments.interestAmount,
              note: loanRepayments.note,
              contractNumber: loanContracts.contractNumber,
              bankName: banks.name,
              loanContractId: loanContracts.id,
            })
            .from(loanRepayments)
            .innerJoin(
              loanContracts,
              eq(loanContracts.id, loanRepayments.loanContractId),
            )
            .leftJoin(banks, eq(banks.id, loanContracts.bankId))
            .where(inArray(loanRepayments.id, loanIds))
        : [],
    ])

    const receiptMap = new Map(receiptRows.map((r) => [r.id, r]))
    const paymentMap = new Map(paymentRows.map((p) => [p.id, p]))
    const loanMap = new Map(loanRows.map((m) => [m.id, m]))

    return {
      statement,
      lines: lines.map((l) => {
        let matchedInfo: {
          type: 'receipt' | 'payment' | 'loan_repayment'
          typeLabel: string
          id: number
          date: string
          party: string
          amount: number
          principalAmount?: number
          interestAmount?: number
          details: string
          targetUrl: string
        } | null = null

        if (l.status === 'matched' && l.matchedId) {
          if (l.matchedType === 'receipt') {
            const r = receiptMap.get(l.matchedId)
            if (r) {
              matchedInfo = {
                type: 'receipt',
                typeLabel: 'Phiếu thu',
                id: r.id,
                date: r.date,
                party: r.branchName
                  ? `${r.customerName} (${r.branchName})`
                  : r.customerName,
                amount: num(r.amount),
                details: r.salesOrderId
                  ? `Đơn hàng #${r.salesOrderId}`
                  : 'Thu công nợ khách hàng',
                targetUrl: '/finance?tab=receipts',
              }
            }
          } else if (l.matchedType === 'payment') {
            const p = paymentMap.get(l.matchedId)
            if (p) {
              matchedInfo = {
                type: 'payment',
                typeLabel: 'Phiếu chi',
                id: p.id,
                date: p.date,
                party: p.supplierName || p.payeeName || 'Khác',
                amount: num(p.amount),
                details: p.description || 'Chi thanh toán',
                targetUrl: '/finance?tab=payments',
              }
            }
          } else if (l.matchedType === 'loan_repayment') {
            const m = loanMap.get(l.matchedId)
            if (m) {
              const principal = num(m.principalAmount)
              const interest = num(m.interestAmount)
              matchedInfo = {
                type: 'loan_repayment',
                typeLabel: 'Trả nợ khế ước',
                id: m.id,
                date: m.date,
                party: `HĐ ${m.contractNumber} · ${m.bankName}`,
                amount: principal + interest,
                principalAmount: principal,
                interestAmount: interest,
                details:
                  m.note ||
                  `Gốc: ${formatVnd(principal)} · Lãi: ${formatVnd(interest)}`,
                targetUrl: '/loans',
              }
            }
          }
        }

        return {
          ...l,
          debit: num(l.debit),
          credit: num(l.credit),
          balance: l.balance !== null ? num(l.balance) : null,
          matchedInfo,
        }
      }),
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
      note: z.string().max(255, 'Ghi chú tối đa 255 ký tự').nullable().optional(),
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
