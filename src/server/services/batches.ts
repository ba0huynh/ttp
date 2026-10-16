import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '../../db/index.ts'
import {
  batchExpenses,
  importBatches,
  salesOrderItems,
  vehicles,
} from '../../db/schema.ts'
import type { PricingBase, PricingMethod } from '../../db/schema.ts'
import {
  allocateBatchExpenses,
  computeSellingPrice,
} from '../../lib/business.ts'
import { BusinessError, isDuplicateError, num } from './common.ts'
import type { Exec } from './common.ts'

export interface VehicleInput {
  modelId: number
  colorId: number
  chassisNumber: string
  engineNumber: string
  importPrice: number
}

export interface ExpenseInput {
  expenseTypeId: number
  description?: string | null
  amount: number
}

export interface CreateBatchInput {
  supplierId: number
  loanContractId?: number | null
  importDate: string
  pricingBase: PricingBase
  pricingMethod: PricingMethod
  pricingValue: number
  note?: string | null
  vehicles: VehicleInput[]
  expenses: ExpenseInput[]
}

/**
 * Tính lại chi phí phân bổ, giá vốn, giá bán cho TOÀN BỘ xe trong lô.
 * PHẢI gọi sau mọi thay đổi: thêm/xóa xe, thêm/xóa chi phí, đổi cấu hình giá.
 */
export async function recalculateBatch(exec: Exec, batchId: number) {
  const [batch] = await exec
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
  if (!batch) throw new BusinessError('Không tìm thấy lô nhập')

  const [exp] = await exec
    .select({ total: sql<string>`coalesce(sum(${batchExpenses.amount}),0)` })
    .from(batchExpenses)
    .where(eq(batchExpenses.batchId, batchId))
  const totalExpense = num(exp?.total)

  const list = await exec
    .select({ id: vehicles.id, importPrice: vehicles.importPrice })
    .from(vehicles)
    .where(eq(vehicles.batchId, batchId))
    .orderBy(vehicles.id)

  const allocated = allocateBatchExpenses(
    list.map((v) => ({ id: v.id, importPrice: num(v.importPrice) })),
    totalExpense,
  )
  for (const v of allocated) {
    await exec
      .update(vehicles)
      .set({
        allocatedExpense: v.allocatedExpense,
        costPrice: v.costPrice,
        sellingPrice: computeSellingPrice(v, {
          pricingBase: batch.pricingBase,
          pricingMethod: batch.pricingMethod,
          pricingValue: num(batch.pricingValue),
        }),
      })
      .where(eq(vehicles.id, v.id))
  }
  return { totalExpense, vehicleCount: allocated.length }
}

function assertNoDuplicateInput(list: VehicleInput[]) {
  const seenC = new Set<string>()
  const seenE = new Set<string>()
  for (const v of list) {
    const c = v.chassisNumber.trim().toUpperCase()
    const e = v.engineNumber.trim().toUpperCase()
    if (seenC.has(c))
      throw new BusinessError(`Số khung bị trùng trong danh sách: ${c}`)
    if (seenE.has(e))
      throw new BusinessError(`Số máy bị trùng trong danh sách: ${e}`)
    seenC.add(c)
    seenE.add(e)
  }
}

async function assertNotInDb(exec: Exec, list: VehicleInput[]) {
  if (list.length === 0) return
  const chassis = list.map((v) => v.chassisNumber.trim().toUpperCase())
  const existing = await exec
    .select({ c: vehicles.chassisNumber })
    .from(vehicles)
    .where(inArray(vehicles.chassisNumber, chassis))
  if (existing.length > 0) {
    throw new BusinessError(
      `Số khung đã tồn tại trong hệ thống: ${existing.map((x) => x.c).join(', ')}`,
    )
  }
}

const normalizeVehicle = (batchId: number, v: VehicleInput) => ({
  batchId,
  modelId: v.modelId,
  colorId: v.colorId,
  chassisNumber: v.chassisNumber.trim().toUpperCase(),
  engineNumber: v.engineNumber.trim().toUpperCase(),
  importPrice: v.importPrice,
})

/** Batch import = vehicles immediately in inventory (no detached intake step) */
export async function createBatch(input: CreateBatchInput, userId?: number) {
  if (input.vehicles.length === 0)
    throw new BusinessError('Lô nhập phải có ít nhất 1 xe')
  assertNoDuplicateInput(input.vehicles)
  try {
    return await db.transaction(async (tx) => {
      await assertNotInDb(tx, input.vehicles)
      const [created] = await tx
        .insert(importBatches)
        .values({
          supplierId: input.supplierId,
          loanContractId: input.loanContractId ?? null,
          importDate: input.importDate,
          pricingBase: input.pricingBase,
          pricingMethod: input.pricingMethod,
          pricingValue: input.pricingValue,
          note: input.note ?? null,
          createdBy: userId ?? null,
        })
        .$returningId()
      const batchId = created.id
      await tx
        .insert(vehicles)
        .values(input.vehicles.map((v) => normalizeVehicle(batchId, v)))
      if (input.expenses.length > 0) {
        await tx.insert(batchExpenses).values(
          input.expenses.map((e) => ({
            batchId,
            expenseTypeId: e.expenseTypeId,
            description: e.description ?? null,
            amount: e.amount,
          })),
        )
      }
      await recalculateBatch(tx, batchId)
      return batchId
    })
  } catch (e) {
    if (isDuplicateError(e))
      throw new BusinessError('Mã lô, số khung hoặc số máy đã tồn tại')
    throw e
  }
}

export async function addVehiclesToBatch(
  batchId: number,
  list: VehicleInput[],
) {
  assertNoDuplicateInput(list)
  try {
    await db.transaction(async (tx) => {
      await assertNotInDb(tx, list)
      await tx
        .insert(vehicles)
        .values(list.map((v) => normalizeVehicle(batchId, v)))
      await recalculateBatch(tx, batchId)
    })
  } catch (e) {
    if (isDuplicateError(e))
      throw new BusinessError('Số khung hoặc số máy đã tồn tại')
    throw e
  }
}

export async function removeVehicle(vehicleId: number) {
  await db.transaction(async (tx) => {
    const [v] = await tx
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
    if (!v) throw new BusinessError('Không tìm thấy xe')
    const [sold] = await tx
      .select({ id: salesOrderItems.id })
      .from(salesOrderItems)
      .where(eq(salesOrderItems.vehicleId, vehicleId))
    if (sold || v.isDelivered || v.isInvoiced)
      throw new BusinessError('Xe đã bán/giao/xuất hóa đơn — không thể xóa')
    await tx.delete(vehicles).where(eq(vehicles.id, vehicleId))
    await recalculateBatch(tx, v.batchId)
  })
}

/** Deletes a batch with its vehicles and expenses; refused once any vehicle was sold, delivered or invoiced */
export async function deleteBatch(batchId: number) {
  await db.transaction(async (tx) => {
    const list = await tx
      .select({
        id: vehicles.id,
        isDelivered: vehicles.isDelivered,
        isInvoiced: vehicles.isInvoiced,
      })
      .from(vehicles)
      .where(eq(vehicles.batchId, batchId))
    const ids = list.map((v) => v.id)
    const sold =
      ids.length > 0
        ? await tx
            .select({ id: salesOrderItems.id })
            .from(salesOrderItems)
            .where(inArray(salesOrderItems.vehicleId, ids))
            .limit(1)
        : []
    if (sold.length > 0 || list.some((v) => v.isDelivered || v.isInvoiced))
      throw new BusinessError(
        'Lô có xe đã bán/giao/xuất hóa đơn nên không thể xóa',
      )
    // Vehicles and expenses are removed by their ON DELETE CASCADE
    await tx.delete(importBatches).where(eq(importBatches.id, batchId))
  })
}

export async function addBatchExpense(batchId: number, e: ExpenseInput) {
  await db.transaction(async (tx) => {
    await tx.insert(batchExpenses).values({
      batchId,
      expenseTypeId: e.expenseTypeId,
      description: e.description ?? null,
      amount: e.amount,
    })
    await recalculateBatch(tx, batchId)
  })
}

export async function removeBatchExpense(expenseId: number) {
  await db.transaction(async (tx) => {
    const [e] = await tx
      .select()
      .from(batchExpenses)
      .where(eq(batchExpenses.id, expenseId))
    if (!e) throw new BusinessError('Không tìm thấy chi phí')
    await tx.delete(batchExpenses).where(eq(batchExpenses.id, expenseId))
    await recalculateBatch(tx, e.batchId)
  })
}

export async function updateBatchPricing(
  batchId: number,
  p: {
    pricingBase: PricingBase
    pricingMethod: PricingMethod
    pricingValue: number
  },
) {
  await db.transaction(async (tx) => {
    await tx.update(importBatches).set(p).where(eq(importBatches.id, batchId))
    await recalculateBatch(tx, batchId)
  })
}

export async function updateBatchInfo(
  batchId: number,
  p: {
    loanContractId: number | null
    importDate: string
  },
) {
  await db
    .update(importBatches)
    .set(p)
    .where(and(eq(importBatches.id, batchId)))
}
