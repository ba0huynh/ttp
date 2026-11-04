import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm'

import { db } from '../../db/index.ts'
import {
  banks,
  batchExpenses,
  expenseTypes,
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
/* 08. Accounts Receivable (AR) — billed to the legal entity of branch        */
/* -------------------------------------------------------------------------- */

export async function getReceivablesSummary() {
  // Independent queries run concurrently: each one costs a network round trip
  const [sold, paid, custs, branches] = await Promise.all([
    db
      .select({
        customerId: salesOrders.customerId,
        branchId: salesOrders.branchId,
        total: sql<string>`sum(${salesOrders.totalAmount})`,
      })
      .from(salesOrders)
      .where(eq(salesOrders.status, 'confirmed'))
      .groupBy(salesOrders.customerId, salesOrders.branchId),
    db
      .select({
        customerId: receiptVouchers.customerId,
        branchId: receiptVouchers.branchId,
        total: sql<string>`sum(${receiptVouchers.amount})`,
      })
      .from(receiptVouchers)
      .groupBy(receiptVouchers.customerId, receiptVouchers.branchId),
    db.select().from(customers),
    db.select().from(posBranches),
  ])
  const cMap = new Map(custs.map((c) => [c.id, c]))
  const bMap = new Map(branches.map((b) => [b.id, b]))

  const rows = new Map<
    string,
    {
      customerId: number
      branchId: number | null
      customerName: string
      entityName: string
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
  const ordersQuery = db
    .select({
      id: salesOrders.id,
      date: salesOrders.orderDate,
      branchId: salesOrders.branchId,
      amount: salesOrders.totalAmount,
      status: salesOrders.status,
    })
    .from(salesOrders)
    .where(eq(salesOrders.customerId, customerId))
    .orderBy(desc(salesOrders.orderDate))
  const receiptsQuery = db
    .select()
    .from(receiptVouchers)
    .where(eq(receiptVouchers.customerId, customerId))
    .orderBy(desc(receiptVouchers.receiptDate))
  // Independent queries: run them together instead of one round trip each
  const [orders, receipts] = await Promise.all([ordersQuery, receiptsQuery])
  return { orders, receipts }
}

/* -------------------------------------------------------------------------- */
/* 09. Accounts Payable (AP)                                                  */
/* -------------------------------------------------------------------------- */

export async function getPayablesSummary() {
  const [purchased, paid, sups] = await Promise.all([
    db
      .select({
        supplierId: importBatches.supplierId,
        total: sql<string>`coalesce(sum(${vehicles.importPriceWithVat}),0)`,
      })
      .from(importBatches)
      .leftJoin(vehicles, eq(vehicles.batchId, importBatches.id))
      // A batch financed by a bank loan is owed to the bank, not to the supplier
      .where(isNull(importBatches.loanContractId))
      .groupBy(importBatches.supplierId),
    db
      .select({
        supplierId: paymentVouchers.supplierId,
        total: sql<string>`sum(${paymentVouchers.amount})`,
      })
      .from(paymentVouchers)
      .where(eq(paymentVouchers.payeeType, 'supplier'))
      .groupBy(paymentVouchers.supplierId),
    db.select().from(suppliers).orderBy(asc(suppliers.name)),
  ])
  const pMap = new Map(purchased.map((p) => [p.supplierId, p]))
  const paidMap = new Map(paid.map((p) => [p.supplierId, num(p.total)]))
  return sups
    .map((s) => {
      const purchasedTotal = num(pMap.get(s.id)?.total)
      const paidTotal = paidMap.get(s.id) ?? 0
      return {
        supplierId: s.id,
        supplierName: s.name,
        purchased: purchasedTotal,
        paid: paidTotal,
        balance: purchasedTotal - paidTotal,
      }
    })
    .filter((r) => r.purchased > 0 || r.paid > 0)
}

/* -------------------------------------------------------------------------- */
/* 06. Inventory (Dual Independent Inventories)                               */
/* -------------------------------------------------------------------------- */

export async function getInventorySummary() {
  const [[totals], byModel] = await Promise.all([
    getInventoryTotals(),
    getInventoryByModel(),
  ])
  return summarizeInventory(totals, byModel)
}

function getInventoryTotals() {
  return db
    .select({
      total: sql<number>`count(*)`,
      importValue: sql<string>`coalesce(sum(${vehicles.importPriceWithVat}),0)`,
      physical: sql<number>`sum(case when ${vehicles.isDelivered} = 0 then 1 else 0 end)`,
      invoiced: sql<number>`sum(case when ${vehicles.isInvoiced} = 0 then 1 else 0 end)`,
      physicalValue: sql<string>`coalesce(sum(case when ${vehicles.isDelivered} = 0 then ${vehicles.costPrice} else 0 end),0)`,
      invoicedValue: sql<string>`coalesce(sum(case when ${vehicles.isInvoiced} = 0 then ${vehicles.costPrice} else 0 end),0)`,
      invoicedNotDelivered: sql<number>`sum(case when ${vehicles.isInvoiced} = 1 and ${vehicles.isDelivered} = 0 then 1 else 0 end)`,
      deliveredNotInvoiced: sql<number>`sum(case when ${vehicles.isDelivered} = 1 and ${vehicles.isInvoiced} = 0 then 1 else 0 end)`,
      unsold: sql<number>`sum(case when not exists (select 1 from ${salesOrderItems} i where i.vehicle_id = vehicles.id) then 1 else 0 end)`,
    })
    .from(vehicles)
}

function getInventoryByModel() {
  return db
    .select({
      modelId: sql<number>`coalesce(${motorcycleModels.id}, 0)`,
      modelName: sql<string>`coalesce(${motorcycleModels.name}, 'Chưa rõ dòng xe')`,
      physical: sql<number>`sum(case when ${vehicles.isDelivered} = 0 then 1 else 0 end)`,
      invoiced: sql<number>`sum(case when ${vehicles.isInvoiced} = 0 then 1 else 0 end)`,
    })
    .from(vehicles)
    .leftJoin(motorcycleModels, eq(motorcycleModels.id, vehicles.modelId))
    .groupBy(motorcycleModels.id, motorcycleModels.name)
    .orderBy(asc(motorcycleModels.name))
}

function summarizeInventory(
  totals: Awaited<ReturnType<typeof getInventoryTotals>>[number] | undefined,
  byModel: Awaited<ReturnType<typeof getInventoryByModel>>,
) {
  return {
    total: num(totals?.total),
    importValue: num(totals?.importValue),
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
      year: vehicles.year,
      note: vehicles.note,
      importPrice: vehicles.importPrice,
      vatRate: vehicles.vatRate,
      importPriceWithVat: vehicles.importPriceWithVat,
      allocatedExpense: vehicles.allocatedExpense,
      costPrice: vehicles.costPrice,
      sellingPrice: vehicles.sellingPrice,
      isDelivered: vehicles.isDelivered,
      deliveredAt: vehicles.deliveredAt,
      isInvoiced: vehicles.isInvoiced,
      invoicedAt: vehicles.invoicedAt,
      batchId: importBatches.id,
      importDate: importBatches.importDate,
      supplierName: suppliers.name,
      modelId: vehicles.modelId,
      modelName: sql<string>`coalesce(${motorcycleModels.name}, '')`,
      colorId: vehicles.colorId,
      colorName: colors.name,
      colorHex: colors.hex,
      salesOrderId: salesOrderItems.salesOrderId,
    })
    .from(vehicles)
    .innerJoin(importBatches, eq(importBatches.id, vehicles.batchId))
    .leftJoin(suppliers, eq(suppliers.id, importBatches.supplierId))
    .leftJoin(motorcycleModels, eq(motorcycleModels.id, vehicles.modelId))
    .innerJoin(colors, eq(colors.id, vehicles.colorId))
    .leftJoin(salesOrderItems, eq(salesOrderItems.vehicleId, vehicles.id))
    .leftJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(importBatches.importDate), asc(vehicles.id))
    .limit(1000)
  return rows.map((r) => ({
    ...r,
    importPrice: num(r.importPrice),
    vatRate: num(r.vatRate),
    importPriceWithVat: num(r.importPriceWithVat),
    allocatedExpense: num(r.allocatedExpense),
    costPrice: num(r.costPrice),
    sellingPrice: num(r.sellingPrice),
  }))
}

/* -------------------------------------------------------------------------- */
/* 11. Reports & Analytics                                                    */
/* -------------------------------------------------------------------------- */

export async function getReports(from: string, to: string) {
  const inRange = and(
    eq(salesOrders.status, 'confirmed'),
    gte(salesOrders.orderDate, from),
    lte(salesOrders.orderDate, to),
  )

  // One round trip serves all three revenue breakdowns (customer / month /
  // model); rows are aggregated in memory. Revenue is attributed to the
  // PARENT CUSTOMER.
  const soldRows = db
    .select({
      customerId: customers.id,
      customerName: customers.name,
      month: sql<string>`date_format(${salesOrders.orderDate}, '%Y-%m')`,
      modelName: sql<string>`coalesce(${motorcycleModels.name}, '')`,
      // Revenue excludes VAT (VAT is not income). Cost is the cost price
      // captured at sale: import price incl. VAT + allocated batch expenses.
      revenue: salesOrderItems.priceBeforeVat,
      cost: salesOrderItems.costPrice,
    })
    .from(salesOrderItems)
    .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
    .innerJoin(customers, eq(customers.id, salesOrders.customerId))
    .innerJoin(vehicles, eq(vehicles.id, salesOrderItems.vehicleId))
    .leftJoin(motorcycleModels, eq(motorcycleModels.id, vehicles.modelId))
    .where(inRange)

  const expensesByType = db
    .select({
      expenseTypeId: batchExpenses.expenseTypeId,
      expenseTypeName: expenseTypes.name,
      total: sql<string>`sum(${batchExpenses.amount})`,
    })
    .from(batchExpenses)
    .innerJoin(importBatches, eq(importBatches.id, batchExpenses.batchId))
    .innerJoin(expenseTypes, eq(expenseTypes.id, batchExpenses.expenseTypeId))
    .where(
      and(
        gte(importBatches.importDate, from),
        lte(importBatches.importDate, to),
      ),
    )
    .groupBy(batchExpenses.expenseTypeId, expenseTypes.name)

  const interestPaid = db
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

  const loans = db
    .select({
      id: loanContracts.id,
      contractNumber: loanContracts.contractNumber,
      bankName: banks.name,
      principal: loanContracts.principalAmount,
      rate: loanContracts.interestRate,
      principalPaid: sql<string>`coalesce((select sum(r.principal_amount) from ${loanRepayments} r where r.loan_contract_id = ${loanContracts.id}),0)`,
    })
    .from(loanContracts)
    .leftJoin(banks, eq(banks.id, loanContracts.bankId))
    .orderBy(asc(loanContracts.disbursementDate))

  // All independent: run them concurrently (each is a network round trip)
  const [
    sold,
    expenses,
    [interest],
    loanRows,
    receivables,
    payables,
    inventory,
  ] = await Promise.all([
    soldRows,
    expensesByType,
    interestPaid,
    loans,
    getReceivablesSummary(),
    getPayablesSummary(),
    getInventorySummary(),
  ])

  interface Bucket {
    vehicles: number
    revenue: number
    cost: number
  }
  const group = <TKey extends string | number>(
    key: (r: (typeof sold)[number]) => TKey,
  ) => {
    const map = new Map<TKey, Bucket>()
    for (const r of sold) {
      const k = key(r)
      const b = map.get(k) ?? { vehicles: 0, revenue: 0, cost: 0 }
      b.vehicles += 1
      b.revenue += num(r.revenue)
      b.cost += num(r.cost)
      map.set(k, b)
    }
    return map
  }
  const withProfit = (b: Bucket) => ({ ...b, profit: b.revenue - b.cost })

  const customerNames = new Map(sold.map((r) => [r.customerId, r.customerName]))
  const revenueByCustomer = [...group((r) => r.customerId)]
    .map(([customerId, b]) => ({
      customerId,
      customerName: customerNames.get(customerId) ?? '?',
      ...withProfit(b),
    }))
    .sort((a, b) => b.revenue - a.revenue)
  const revenueByMonth = [...group((r) => r.month)]
    .map(([month, b]) => ({ month, ...withProfit(b) }))
    .sort((a, b) => a.month.localeCompare(b.month))
  const revenueByModel = [...group((r) => r.modelName)]
    .map(([modelName, b]) => ({ modelName, ...withProfit(b) }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    from,
    to,
    revenueByCustomer,
    revenueByMonth,
    revenueByModel,
    expensesByType: expenses.map((e) => ({ ...e, total: num(e.total) })),
    interestPaid: num(interest?.total),
    loans: loanRows.map((l) => ({
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
