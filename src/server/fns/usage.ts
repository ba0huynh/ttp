import { createServerFn } from '@tanstack/react-start'
import { count, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import {
  bankStatements,
  companyBankAccounts,
  customers,
  deliveryNotes,
  importBatches,
  invoices,
  loanContracts,
  loanRepayments,
  paymentVouchers,
  receiptVouchers,
  salesOrderItems,
  salesOrders,
  suppliers,
  users,
  vehicles,
} from '#/db/schema.ts'
import { batchLabel, formatDate, formatVnd } from '#/lib/business.ts'
import { num } from '#/server/services/common.ts'
import { requirePermission } from './middleware.ts'

/** Things a row can be deleted from; see `getUsageFn` */
export const USAGE_ENTITIES = [
  'banks',
  'companyBankAccounts',
  'suppliers',
  'motorcycleModels',
  'colors',
  'roles',
  'vehicles',
  'loans',
  'users',
] as const

export interface UsageItem {
  label: string
  /** App path, optionally with a query string, e.g. `/batches/3` or `/finance?tab=payments` */
  href: string
}

export interface UsageGroup {
  title: string
  total: number
  items: UsageItem[]
}

const MAX_ITEMS = 30

const group = (title: string, items: UsageItem[]): UsageGroup => ({
  title,
  total: items.length,
  items: items.slice(0, MAX_ITEMS),
})

/** Records that still point to the row, so the UI can say why it cannot be deleted */
async function usageOf(
  entity: (typeof USAGE_ENTITIES)[number],
  id: number,
): Promise<UsageGroup[]> {
  switch (entity) {
    case 'banks': {
      const [loans, accounts] = await Promise.all([
        db
          .select({
            id: loanContracts.id,
            contractNumber: loanContracts.contractNumber,
          })
          .from(loanContracts)
          .where(eq(loanContracts.bankId, id)),
        db
          .select({
            accountNumber: companyBankAccounts.accountNumber,
            accountName: companyBankAccounts.accountName,
          })
          .from(companyBankAccounts)
          .where(eq(companyBankAccounts.bankId, id)),
      ])
      return [
        group(
          'Khế ước vay',
          loans.map((l) => ({
            label: `Khế ước ${l.contractNumber}`,
            href: `/loans/${l.id}`,
          })),
        ),
        group(
          'Tài khoản ngân hàng của công ty',
          accounts.map((a) => ({
            label: `${a.accountNumber} — ${a.accountName}`,
            href: '/master-data?tab=accounts',
          })),
        ),
      ]
    }

    case 'companyBankAccounts': {
      const [receipts, payments, repayments, statements] = await Promise.all([
        db
          .select({
            date: receiptVouchers.receiptDate,
            amount: receiptVouchers.amount,
            customer: customers.name,
          })
          .from(receiptVouchers)
          .innerJoin(customers, eq(customers.id, receiptVouchers.customerId))
          .where(eq(receiptVouchers.companyBankAccountId, id)),
        db
          .select({
            date: paymentVouchers.paymentDate,
            amount: paymentVouchers.amount,
            supplier: suppliers.name,
            payee: paymentVouchers.payeeName,
          })
          .from(paymentVouchers)
          .leftJoin(suppliers, eq(suppliers.id, paymentVouchers.supplierId))
          .where(eq(paymentVouchers.companyBankAccountId, id)),
        db
          .select({
            date: loanRepayments.paymentDate,
            loanId: loanContracts.id,
            contractNumber: loanContracts.contractNumber,
          })
          .from(loanRepayments)
          .innerJoin(
            loanContracts,
            eq(loanContracts.id, loanRepayments.loanContractId),
          )
          .where(eq(loanRepayments.companyBankAccountId, id)),
        db
          .select({ id: bankStatements.id, fileName: bankStatements.fileName })
          .from(bankStatements)
          .where(eq(bankStatements.companyBankAccountId, id)),
      ])
      return [
        group(
          'Phiếu thu',
          receipts.map((r) => ({
            label: `${formatDate(r.date)} — ${r.customer} — ${formatVnd(num(r.amount))}`,
            href: '/finance?tab=receipts',
          })),
        ),
        group(
          'Phiếu chi',
          payments.map((p) => ({
            label: `${formatDate(p.date)} — ${p.supplier ?? p.payee ?? 'Khác'} — ${formatVnd(num(p.amount))}`,
            href: '/finance?tab=payments',
          })),
        ),
        group(
          'Trả nợ khế ước',
          repayments.map((r) => ({
            label: `Khế ước ${r.contractNumber} — ${formatDate(r.date)}`,
            href: `/loans/${r.loanId}`,
          })),
        ),
        group(
          'Sao kê ngân hàng',
          statements.map((s) => ({
            label: s.fileName ?? `Sao kê #${s.id}`,
            href: '/reconcile',
          })),
        ),
      ]
    }

    case 'suppliers': {
      const [batches, payments] = await Promise.all([
        db
          .select({
            id: importBatches.id,
            importDate: importBatches.importDate,
          })
          .from(importBatches)
          .where(eq(importBatches.supplierId, id)),
        db
          .select({
            date: paymentVouchers.paymentDate,
            amount: paymentVouchers.amount,
          })
          .from(paymentVouchers)
          .where(eq(paymentVouchers.supplierId, id)),
      ])
      return [
        group(
          'Lô nhập',
          batches.map((b) => ({
            label: batchLabel({ importDate: b.importDate }),
            href: `/batches/${b.id}`,
          })),
        ),
        group(
          'Phiếu chi',
          payments.map((p) => ({
            label: `${formatDate(p.date)} — ${formatVnd(num(p.amount))}`,
            href: '/finance?tab=payments',
          })),
        ),
      ]
    }

    case 'motorcycleModels':
    case 'colors': {
      const column = entity === 'colors' ? vehicles.colorId : vehicles.modelId
      const rows = await db
        .select({
          id: importBatches.id,
          importDate: importBatches.importDate,
          supplierName: suppliers.name,
          n: count(vehicles.id),
        })
        .from(vehicles)
        .innerJoin(importBatches, eq(importBatches.id, vehicles.batchId))
        .innerJoin(suppliers, eq(suppliers.id, importBatches.supplierId))
        .where(eq(column, id))
        .groupBy(importBatches.id, importBatches.importDate, suppliers.name)
      return [
        group(
          'Lô nhập có xe dùng mục này',
          rows.map((r) => ({
            label: `${batchLabel(r)} — ${r.n} xe`,
            href: `/batches/${r.id}`,
          })),
        ),
      ]
    }

    case 'roles': {
      const rows = await db
        .select({ fullName: users.fullName, username: users.username })
        .from(users)
        .where(eq(users.roleId, id))
      return [
        group(
          'Người dùng đang giữ vai trò này',
          rows.map((u) => ({
            label: `${u.fullName} (${u.username})`,
            href: '/settings?tab=users',
          })),
        ),
      ]
    }

    case 'users': {
      const [
        batches,
        orders,
        deliveries,
        invoiceRows,
        receipts,
        payments,
        statements,
      ] = await Promise.all([
        db
          .select({
            id: importBatches.id,
            importDate: importBatches.importDate,
          })
          .from(importBatches)
          .where(eq(importBatches.createdBy, id)),
        db
          .select({
            id: salesOrders.id,
            date: salesOrders.orderDate,
            customer: customers.name,
          })
          .from(salesOrders)
          .innerJoin(customers, eq(customers.id, salesOrders.customerId))
          .where(eq(salesOrders.createdBy, id)),
        db
          .select({
            orderId: deliveryNotes.salesOrderId,
            number: deliveryNotes.noteNumber,
            date: deliveryNotes.deliveryDate,
          })
          .from(deliveryNotes)
          .where(eq(deliveryNotes.createdBy, id)),
        db
          .select({
            orderId: invoices.salesOrderId,
            number: invoices.invoiceNumber,
            date: invoices.invoiceDate,
          })
          .from(invoices)
          .where(eq(invoices.createdBy, id)),
        db
          .select({
            date: receiptVouchers.receiptDate,
            amount: receiptVouchers.amount,
            customer: customers.name,
          })
          .from(receiptVouchers)
          .innerJoin(customers, eq(customers.id, receiptVouchers.customerId))
          .where(eq(receiptVouchers.createdBy, id)),
        db
          .select({
            date: paymentVouchers.paymentDate,
            amount: paymentVouchers.amount,
          })
          .from(paymentVouchers)
          .where(eq(paymentVouchers.createdBy, id)),
        db
          .select({ id: bankStatements.id, fileName: bankStatements.fileName })
          .from(bankStatements)
          .where(eq(bankStatements.createdBy, id)),
      ])
      return [
        group(
          'Lô nhập do tài khoản này tạo',
          batches.map((b) => ({
            label: batchLabel(b),
            href: `/batches/${b.id}`,
          })),
        ),
        group(
          'Phiếu bán do tài khoản này lập',
          orders.map((o) => ({
            label: `Phiếu bán #${o.id} — ${o.customer} — ${formatDate(o.date)}`,
            href: `/sales/${o.id}`,
          })),
        ),
        group(
          'Phiếu giao xe do tài khoản này lập',
          deliveries.map((d) => ({
            label: `${d.number} — ${formatDate(d.date)}`,
            href: `/sales/${d.orderId}`,
          })),
        ),
        group(
          'Hóa đơn do tài khoản này xuất',
          invoiceRows.map((i) => ({
            label: `${i.number} — ${formatDate(i.date)}`,
            href: `/sales/${i.orderId}`,
          })),
        ),
        group(
          'Phiếu thu do tài khoản này lập',
          receipts.map((r) => ({
            label: `${formatDate(r.date)} — ${r.customer} — ${formatVnd(num(r.amount))}`,
            href: '/finance?tab=receipts',
          })),
        ),
        group(
          'Phiếu chi do tài khoản này lập',
          payments.map((p) => ({
            label: `${formatDate(p.date)} — ${formatVnd(num(p.amount))}`,
            href: '/finance?tab=payments',
          })),
        ),
        group(
          'Sao kê do tài khoản này nhập',
          statements.map((st) => ({
            label: st.fileName ?? `Sao kê #${st.id}`,
            href: '/reconcile',
          })),
        ),
      ]
    }

    case 'loans': {
      const [batches, repayments] = await Promise.all([
        db
          .select({
            id: importBatches.id,
            importDate: importBatches.importDate,
            supplierName: suppliers.name,
          })
          .from(importBatches)
          .innerJoin(suppliers, eq(suppliers.id, importBatches.supplierId))
          .where(eq(importBatches.loanContractId, id)),
        db
          .select({
            date: loanRepayments.paymentDate,
            principal: loanRepayments.principalAmount,
            interest: loanRepayments.interestAmount,
          })
          .from(loanRepayments)
          .where(eq(loanRepayments.loanContractId, id)),
      ])
      return [
        group(
          'Lô nhập được khế ước này tài trợ',
          batches.map((b) => ({
            label: batchLabel(b),
            href: `/batches/${b.id}`,
          })),
        ),
        group(
          'Các khoản đã trả nợ',
          repayments.map((r) => ({
            label: `${formatDate(r.date)} — gốc ${formatVnd(num(r.principal))}, lãi ${formatVnd(num(r.interest))}`,
            href: `/loans/${id}`,
          })),
        ),
      ]
    }

    case 'vehicles': {
      const rows = await db
        .select({
          orderId: salesOrders.id,
          orderDate: salesOrders.orderDate,
          customer: customers.name,
        })
        .from(salesOrderItems)
        .innerJoin(
          salesOrders,
          eq(salesOrders.id, salesOrderItems.salesOrderId),
        )
        .innerJoin(customers, eq(customers.id, salesOrders.customerId))
        .where(eq(salesOrderItems.vehicleId, id))
      return [
        group(
          'Phiếu bán chứa xe này',
          rows.map((o) => ({
            label: `Phiếu bán #${o.orderId} — ${o.customer} — ${formatDate(o.orderDate)}`,
            href: `/sales/${o.orderId}`,
          })),
        ),
      ]
    }
  }
}

/**
 * What still uses a row that could not be deleted. Called by the UI after a
 * failed delete to explain it with names and links; groups with no records
 * are left out, so an empty result means the failure had another cause.
 */
export const getUsageFn = createServerFn({ method: 'GET' })
  .middleware([
    requirePermission(
      'master-data.manage',
      'roles.manage',
      'batches.manage',
      'loans.manage',
      'users.manage',
    ),
  ])
  .validator(z.object({ entity: z.enum(USAGE_ENTITIES), id: z.number().int() }))
  .handler(async ({ data }) => {
    const groups = (await usageOf(data.entity, data.id)).filter(
      (g) => g.total > 0,
    )
    return { groups }
  })
