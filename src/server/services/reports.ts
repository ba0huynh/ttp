import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'

import { db } from '../../db/index.ts'
import {
  banks,
  batchExpenses,
  colors,
  customers,
  importBatches,
  loanContracts,
  loanRepayments,
  motorcycleModels,
  paymentVouchers,
  posBranches,
  receiptVouchers,
  salesOrderItems,
  salesOrders,
  suppliers,
  vehicles,
} from '../../db/schema.ts'
import { num } from './common.ts'

/* -------------------------------------------------------------------------- */
/* 08. Công nợ phải thu — ghi theo PHÁP NHÂN điểm bán nhận xe                 */
/* -------------------------------------------------------------------------- */

export async function getReceivablesSummary() {
  const sold = await db
    .select({
      customerId: salesOrders.customerId,
      branchId: salesOrders.branchId,
      total: sql<string>`sum(${salesOrders.totalAmount})`,
    })
    .from(salesOrders)
    .where(eq(salesOrders.status, 'confirmed'))
    .groupBy(salesOrders.customerId, salesOrders.branchId)

  const paid = await db
    .select({
      customerId: receiptVouchers.customerId,
      branchId: receiptVouchers.branchId,
      total: sql<string>`sum(${receiptVouchers.amount})`,
    })
    .from(receiptVouchers)
    .groupBy(receiptVouchers.customerId, receiptVouchers.branchId)

  const custs = await db.select().from(customers)
  const branches = await db.select().from(posBranches)
  const cMap = new Map(custs.map((c) => [c.id, c]))
  const bMap = new Map(branches.map((b) => [b.id, b]))

  const rows = new Map<
    string,
    {
      customerId: number
      branchId: number | null
      customerName: string
      entityName: string
      taxCode: string | null
      sold: number
      paid: number
    }
  >()
  const touch = (customerId: number, branchId: number | null) => {
    const key = `${customerId}:${branchId ?? 0}`
    let r = rows.get(key)
    if (!r) {
      const c = cMap.get(customerId)
      const b = branchId ? bMap.get(branchId) : undefined
      r = {
        customerId,
        branchId,
        customerName: c?.name ?? '?',
        entityName: b?.name ?? c?.name ?? '?',
        taxCode: b?.taxCode ?? c?.taxCode ?? null,
        sold: 0,
        paid: 0,
      }
      rows.set(key, r)
    }
    return r
  }
  for (const s of sold) touch(s.customerId, s.branchId).sold += num(s.total)
  for (const p of paid) touch(p.customerId, p.branchId).paid += num(p.total)

  return [...rows.values()]
    .map((r) => ({ ...r, balance: r.sold - r.paid }))
    .sort((a, b) => b.balance - a.balance)
}

export async function getCustomerStatement(customerId: number) {
  const orders = await db
    .select({
      id: salesOrders.id,
      date: salesOrders.orderDate,
      number: salesOrders.orderNumber,
      branchId: salesOrders.branchId,
      amount: salesOrders.totalAmount,
      status: salesOrders.status,
    })
    .from(salesOrders)
    .where(eq(salesOrders.customerId, customerId))
    .orderBy(desc(salesOrders.orderDate))
  const receipts = await db
    .select()
    .from(receiptVouchers)
    .where(eq(receiptVouchers.customerId, customerId))
    .orderBy(desc(receiptVouchers.receiptDate))
  return { orders, receipts }
}

/* -------------------------------------------------------------------------- */
/* 09. Công nợ phải trả                                                       */
/* -------------------------------------------------------------------------- */

export async function getPayablesSummary() {
  const purchased = await db
    .select({
      supplierId: importBatches.supplierId,
      total: sql<string>`coalesce(sum(${vehicles.importPrice}),0)`,
      batches: sql<number>`count(distinct ${importBatches.id})`,
    })
    .from(importBatches)
    .leftJoin(vehicles, eq(vehicles.batchId, importBatches.id))
    .groupBy(importBatches.supplierId)
  const paid = await db
    .select({
      supplierId: paymentVouchers.supplierId,
      total: sql<string>`sum(${paymentVouchers.amount})`,
    })
    .from(paymentVouchers)
    .where(eq(paymentVouchers.payeeType, 'supplier'))
    .groupBy(paymentVouchers.supplierId)
  const sups = await db.select().from(suppliers).orderBy(asc(suppliers.name))
  const pMap = new Map(purchased.map((p) => [p.supplierId, p]))
  const paidMap = new Map(paid.map((p) => [p.supplierId, num(p.total)]))
  return sups
    .map((s) => {
      const purchasedTotal = num(pMap.get(s.id)?.total)
      const paidTotal = paidMap.get(s.id) ?? 0
      return {
        supplierId: s.id,
        supplierName: s.name,
        country: s.country,
        batches: num(pMap.get(s.id)?.batches),
        purchased: purchasedTotal,
        paid: paidTotal,
        balance: purchasedTotal - paidTotal,
      }
    })
    .filter((r) => r.purchased > 0 || r.paid > 0)
}

/* -------------------------------------------------------------------------- */
/* 06. Kho (2 kho độc lập)                                                    */
/* -------------------------------------------------------------------------- */

export async function getInventorySummary() {
  const [totals] = await db
    .select({
      total: sql<number>`count(*)`,
      physical: sql<number>`sum(case when ${vehicles.isDelivered} = 0 then 1 else 0 end)`,
      invoiced: sql<number>`sum(case when ${vehicles.isInvoiced} = 0 then 1 else 0 end)`,
      physicalValue: sql<string>`coalesce(sum(case when ${vehicles.isDelivered} = 0 then ${vehicles.costPrice} else 0 end),0)`,
      invoicedValue: sql<string>`coalesce(sum(case when ${vehicles.isInvoiced} = 0 then ${vehicles.costPrice} else 0 end),0)`,
      invoicedNotDelivered: sql<number>`sum(case when ${vehicles.isInvoiced} = 1 and ${vehicles.isDelivered} = 0 then 1 else 0 end)`,
      deliveredNotInvoiced: sql<number>`sum(case when ${vehicles.isDelivered} = 1 and ${vehicles.isInvoiced} = 0 then 1 else 0 end)`,
      unsold: sql<number>`sum(case when not exists (select 1 from ${salesOrderItems} i where i.vehicle_id = ${vehicles.id}) then 1 else 0 end)`,
    })
    .from(vehicles)

  const byModel = await db
    .select({
      modelId: motorcycleModels.id,
      modelName: motorcycleModels.name,
      brand: motorcycleModels.brand,
      physical: sql<number>`sum(case when ${vehicles.isDelivered} = 0 then 1 else 0 end)`,
      invoiced: sql<number>`sum(case when ${vehicles.isInvoiced} = 0 then 1 else 0 end)`,
    })
    .from(vehicles)
    .innerJoin(motorcycleModels, eq(motorcycleModels.id, vehicles.modelId))
    .groupBy(motorcycleModels.id, motorcycleModels.name, motorcycleModels.brand)
    .orderBy(asc(motorcycleModels.name))

  return {
    total: num(totals?.total),
    physical: num(totals?.physical),
    invoiced: num(totals?.invoiced),
    physicalValue: num(totals?.physicalValue),
    invoicedValue: num(totals?.invoicedValue),
    invoicedNotDelivered: num(totals?.invoicedNotDelivered),
    deliveredNotInvoiced: num(totals?.deliveredNotInvoiced),
    unsold: num(totals?.unsold),
    byModel: byModel.map((m) => ({
      ...m,
      physical: num(m.physical),
      invoiced: num(m.invoiced),
    })),
  }
}

export async function listVehicles(filter: {
  batchId?: number
  modelId?: number
  stock?: 'all' | 'physical' | 'invoiced' | 'available'
  q?: string
}) {
  const conds = []
  if (filter.batchId) conds.push(eq(vehicles.batchId, filter.batchId))
  if (filter.modelId) conds.push(eq(vehicles.modelId, filter.modelId))
  if (filter.stock === 'physical') conds.push(eq(vehicles.isDelivered, false))
  if (filter.stock === 'invoiced') conds.push(eq(vehicles.isInvoiced, false))
  if (filter.stock === 'available')
    conds.push(sql`${salesOrderItems.id} is null`)
  if (filter.q) {
    const q = `%${filter.q.trim()}%`
    conds.push(
      sql`(${vehicles.chassisNumber} like ${q} or ${vehicles.engineNumber} like ${q})`,
    )
  }
  const rows = await db
    .select({
      id: vehicles.id,
      chassisNumber: vehicles.chassisNumber,
      engineNumber: vehicles.engineNumber,
      importPrice: vehicles.importPrice,
      allocatedExpense: vehicles.allocatedExpense,
      costPrice: vehicles.costPrice,
      sellingPrice: vehicles.sellingPrice,
      isDelivered: vehicles.isDelivered,
      deliveredAt: vehicles.deliveredAt,
      isInvoiced: vehicles.isInvoiced,
      invoicedAt: vehicles.invoicedAt,
      batchId: importBatches.id,
      batchCode: importBatches.batchCode,
      modelName: motorcycleModels.name,
      colorName: colors.name,
      colorHex: colors.hex,
      salesOrderId: salesOrderItems.salesOrderId,
      orderNumber: salesOrders.orderNumber,
    })
    .from(vehicles)
    .innerJoin(importBatches, eq(importBatches.id, vehicles.batchId))
    .innerJoin(motorcycleModels, eq(motorcycleModels.id, vehicles.modelId))
    .innerJoin(colors, eq(colors.id, vehicles.colorId))
    .leftJoin(salesOrderItems, eq(salesOrderItems.vehicleId, vehicles.id))
    .leftJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(importBatches.importDate), asc(vehicles.id))
    .limit(1000)
  return rows.map((r) => ({
    ...r,
    importPrice: num(r.importPrice),
    allocatedExpense: num(r.allocatedExpense),
    costPrice: num(r.costPrice),
    sellingPrice: num(r.sellingPrice),
  }))
}

/* -------------------------------------------------------------------------- */
/* 11. Báo cáo                                                                */
/* -------------------------------------------------------------------------- */

export async function getReports(from: string, to: string) {
  const inRange = and(
    eq(salesOrders.status, 'confirmed'),
    gte(salesOrders.orderDate, from),
    lte(salesOrders.orderDate, to),
  )

  /** Doanh thu quy về KHÁCH HÀNG MẸ */
  const revenueByCustomer = await db
    .select({
      customerId: customers.id,
      customerName: customers.name,
      vehicles: sql<number>`count(${salesOrderItems.id})`,
      revenue: sql<string>`coalesce(sum(${salesOrderItems.unitPrice}),0)`,
      cost: sql<string>`coalesce(sum(${salesOrderItems.costPrice}),0)`,
    })
    .from(salesOrderItems)
    .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
    .innerJoin(customers, eq(customers.id, salesOrders.customerId))
    .where(inRange)
    .groupBy(customers.id, customers.name)

  const revenueByMonth = await db
    .select({
      month: sql<string>`date_format(${salesOrders.orderDate}, '%Y-%m')`,
      vehicles: sql<number>`count(${salesOrderItems.id})`,
      revenue: sql<string>`coalesce(sum(${salesOrderItems.unitPrice}),0)`,
      cost: sql<string>`coalesce(sum(${salesOrderItems.costPrice}),0)`,
    })
    .from(salesOrderItems)
    .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
    .where(inRange)
    .groupBy(sql`date_format(${salesOrders.orderDate}, '%Y-%m')`)
    .orderBy(sql`date_format(${salesOrders.orderDate}, '%Y-%m')`)

  const revenueByModel = await db
    .select({
      modelName: motorcycleModels.name,
      vehicles: sql<number>`count(${salesOrderItems.id})`,
      revenue: sql<string>`coalesce(sum(${salesOrderItems.unitPrice}),0)`,
      cost: sql<string>`coalesce(sum(${salesOrderItems.costPrice}),0)`,
    })
    .from(salesOrderItems)
    .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
    .innerJoin(vehicles, eq(vehicles.id, salesOrderItems.vehicleId))
    .innerJoin(motorcycleModels, eq(motorcycleModels.id, vehicles.modelId))
    .where(inRange)
    .groupBy(motorcycleModels.name)

  const expensesByType = await db
    .select({
      expenseType: batchExpenses.expenseType,
      total: sql<string>`sum(${batchExpenses.amount})`,
    })
    .from(batchExpenses)
    .innerJoin(importBatches, eq(importBatches.id, batchExpenses.batchId))
    .where(
      and(
        gte(importBatches.importDate, from),
        lte(importBatches.importDate, to),
      ),
    )
    .groupBy(batchExpenses.expenseType)

  const [interestPaid] = await db
    .select({
      total: sql<string>`coalesce(sum(${loanRepayments.interestAmount}),0)`,
    })
    .from(loanRepayments)
    .where(
      and(
        gte(loanRepayments.paymentDate, from),
        lte(loanRepayments.paymentDate, to),
      ),
    )

  const loans = await db
    .select({
      id: loanContracts.id,
      contractNumber: loanContracts.contractNumber,
      bankName: banks.shortName,
      principal: loanContracts.principalAmount,
      rate: loanContracts.interestRate,
      status: loanContracts.status,
      maturityDate: loanContracts.maturityDate,
      principalPaid: sql<string>`coalesce((select sum(r.principal_amount) from ${loanRepayments} r where r.loan_contract_id = ${loanContracts.id}),0)`,
    })
    .from(loanContracts)
    .innerJoin(banks, eq(banks.id, loanContracts.bankId))
    .orderBy(asc(loanContracts.maturityDate))

  const mapRev = <
    T extends { revenue: string; cost: string; vehicles: number },
  >(
    r: T,
  ) => ({
    ...r,
    vehicles: num(r.vehicles),
    revenue: num(r.revenue),
    cost: num(r.cost),
    profit: num(r.revenue) - num(r.cost),
  })

  const receivables = await getReceivablesSummary()
  const payables = await getPayablesSummary()
  const inventory = await getInventorySummary()

  return {
    from,
    to,
    revenueByCustomer: revenueByCustomer
      .map(mapRev)
      .sort((a, b) => b.revenue - a.revenue),
    revenueByMonth: revenueByMonth.map(mapRev),
    revenueByModel: revenueByModel
      .map(mapRev)
      .sort((a, b) => b.revenue - a.revenue),
    expensesByType: expensesByType.map((e) => ({ ...e, total: num(e.total) })),
    interestPaid: num(interestPaid?.total),
    loans: loans.map((l) => ({
      ...l,
      principal: num(l.principal),
      rate: num(l.rate),
      principalPaid: num(l.principalPaid),
      outstanding: num(l.principal) - num(l.principalPaid),
    })),
    receivableTotal: receivables.reduce((s, r) => s + r.balance, 0),
    payableTotal: payables.reduce((s, r) => s + r.balance, 0),
    inventory,
  }
}
