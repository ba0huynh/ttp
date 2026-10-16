import { createServerFn } from '@tanstack/react-start'
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import {
  PRICING_BASES,
  PRICING_METHODS,
  batchExpenses,
  colors,
  expenseTypes,
  importBatches,
  loanContracts,
  motorcycleModels,
  salesOrderItems,
  suppliers,
  vehicles,
} from '#/db/schema.ts'
import {
  addBatchExpense,
  addVehiclesToBatch,
  createBatch,
  removeBatchExpense,
  removeVehicle,
  updateBatchInfo,
  updateBatchPricing,
} from '#/server/services/batches.ts'
import { num } from '#/server/services/common.ts'
import { requirePermission } from './middleware.ts'

export const listBatchesFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('batches.view')])
  .handler(async () => {
    const rows = await db
      .select({
        id: importBatches.id,
        importDate: importBatches.importDate,
        pricingBase: importBatches.pricingBase,
        pricingMethod: importBatches.pricingMethod,
        pricingValue: importBatches.pricingValue,
        note: importBatches.note,
        supplierName: suppliers.name,
        loanContractNumber: loanContracts.contractNumber,
        vehicleCount: sql<number>`count(distinct ${vehicles.id})`,
        totalImport: sql<string>`coalesce(sum(${vehicles.importPrice}),0)`,
        totalExpense: sql<string>`coalesce((select sum(e.amount) from ${batchExpenses} e where e.batch_id = ${importBatches.id}),0)`,
      })
      .from(importBatches)
      .innerJoin(suppliers, eq(suppliers.id, importBatches.supplierId))
      .leftJoin(
        loanContracts,
        eq(loanContracts.id, importBatches.loanContractId),
      )
      .leftJoin(vehicles, eq(vehicles.batchId, importBatches.id))
      .groupBy(
        importBatches.id,
        importBatches.importDate,
        importBatches.pricingBase,
        importBatches.pricingMethod,
        importBatches.pricingValue,
        importBatches.note,
        suppliers.name,
        loanContracts.contractNumber,
      )
      .orderBy(desc(importBatches.importDate), desc(importBatches.id))

    return rows.map((r) => {
      const imp = num(r.totalImport)
      const exp = num(r.totalExpense)
      return {
        ...r,
        vehicleCount: num(r.vehicleCount),
        totalImport: imp,
        totalExpense: exp,
        totalCost: imp + exp,
        pricingValue: num(r.pricingValue),
      }
    })
  })

export const getBatchDetailFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('batches.view')])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const [batch] = await db
      .select({
        id: importBatches.id,
        supplierId: importBatches.supplierId,
        supplierName: suppliers.name,
        loanContractId: importBatches.loanContractId,
        loanContractNumber: loanContracts.contractNumber,
        importDate: importBatches.importDate,
        pricingBase: importBatches.pricingBase,
        pricingMethod: importBatches.pricingMethod,
        pricingValue: importBatches.pricingValue,
        note: importBatches.note,
      })
      .from(importBatches)
      .innerJoin(suppliers, eq(suppliers.id, importBatches.supplierId))
      .leftJoin(
        loanContracts,
        eq(loanContracts.id, importBatches.loanContractId),
      )
      .where(eq(importBatches.id, data.id))

    if (!batch) throw new Error('Không tìm thấy lô nhập')

    const vList = await db
      .select({
        id: vehicles.id,
        chassisNumber: vehicles.chassisNumber,
        engineNumber: vehicles.engineNumber,
        importPrice: vehicles.importPrice,
        allocatedExpense: vehicles.allocatedExpense,
        costPrice: vehicles.costPrice,
        sellingPrice: vehicles.sellingPrice,
        isDelivered: vehicles.isDelivered,
        isInvoiced: vehicles.isInvoiced,
        isSold: sql<number>`exists (select 1 from ${salesOrderItems} i where i.vehicle_id = ${vehicles.id})`,
        modelId: vehicles.modelId,
        modelName: motorcycleModels.name,
        colorId: vehicles.colorId,
        colorName: colors.name,
      })
      .from(vehicles)
      .innerJoin(motorcycleModels, eq(motorcycleModels.id, vehicles.modelId))
      .innerJoin(colors, eq(colors.id, vehicles.colorId))
      .where(eq(vehicles.batchId, data.id))
      .orderBy(vehicles.id)

    const expList = await db
      .select({
        id: batchExpenses.id,
        batchId: batchExpenses.batchId,
        expenseTypeId: batchExpenses.expenseTypeId,
        expenseTypeName: expenseTypes.name,
        description: batchExpenses.description,
        amount: batchExpenses.amount,
      })
      .from(batchExpenses)
      .innerJoin(expenseTypes, eq(expenseTypes.id, batchExpenses.expenseTypeId))
      .where(eq(batchExpenses.batchId, data.id))
      .orderBy(batchExpenses.id)

    return {
      batch: {
        ...batch,
        pricingValue: num(batch.pricingValue),
      },
      vehicles: vList.map((v) => ({
        ...v,
        isSold: Boolean(num(v.isSold)),
        importPrice: num(v.importPrice),
        allocatedExpense: num(v.allocatedExpense),
        costPrice: num(v.costPrice),
        sellingPrice: num(v.sellingPrice),
      })),
      expenses: expList.map((e) => ({
        ...e,
        amount: num(e.amount),
      })),
    }
  })

export const createBatchFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('batches.manage')])
  .validator(
    z.object({
      supplierId: z.number().int(),
      loanContractId: z.number().int().nullable().optional(),
      importDate: z.string().min(10),
      pricingBase: z.enum(PRICING_BASES),
      pricingMethod: z.enum(PRICING_METHODS),
      pricingValue: z.number().min(0),
      note: z.string().trim().nullable().optional(),
      vehicles: z.array(
        z.object({
          modelId: z.number().int(),
          colorId: z.number().int(),
          chassisNumber: z.string().trim().min(1),
          engineNumber: z.string().trim().min(1),
          importPrice: z.number().positive('Đơn giá nhập phải > 0'),
        }),
      ),
      expenses: z.array(
        z.object({
          expenseTypeId: z
            .number()
            .int()
            .positive('Vui lòng chọn loại chi phí'),
          description: z.string().trim().nullable().optional(),
          amount: z.number().positive('Số tiền chi phí phải > 0'),
        }),
      ),
    }),
  )
  .handler(async ({ data, context }) => {
    const id = await createBatch(data, context.user.id)
    return { id }
  })

export const addVehiclesToBatchFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('batches.manage')])
  .validator(
    z.object({
      batchId: z.number().int(),
      vehicles: z.array(
        z.object({
          modelId: z.number().int(),
          colorId: z.number().int(),
          chassisNumber: z.string().trim().min(1),
          engineNumber: z.string().trim().min(1),
          importPrice: z.number().positive(),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => {
    await addVehiclesToBatch(data.batchId, data.vehicles)
    return { ok: true }
  })

export const removeVehicleFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('batches.manage')])
  .validator(z.object({ vehicleId: z.number().int() }))
  .handler(async ({ data }) => {
    await removeVehicle(data.vehicleId)
    return { ok: true }
  })

export const addBatchExpenseFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('batches.manage')])
  .validator(
    z.object({
      batchId: z.number().int(),
      expense: z.object({
        expenseTypeId: z.number().int().positive('Vui lòng chọn loại chi phí'),
        description: z.string().trim().nullable().optional(),
        amount: z.number().positive(),
      }),
    }),
  )
  .handler(async ({ data }) => {
    await addBatchExpense(data.batchId, data.expense)
    return { ok: true }
  })

export const removeBatchExpenseFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('batches.manage')])
  .validator(z.object({ expenseId: z.number().int() }))
  .handler(async ({ data }) => {
    await removeBatchExpense(data.expenseId)
    return { ok: true }
  })

export const updateBatchPricingFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('batches.manage')])
  .validator(
    z.object({
      batchId: z.number().int(),
      pricingBase: z.enum(PRICING_BASES),
      pricingMethod: z.enum(PRICING_METHODS),
      pricingValue: z.number().min(0),
    }),
  )
  .handler(async ({ data }) => {
    await updateBatchPricing(data.batchId, {
      pricingBase: data.pricingBase,
      pricingMethod: data.pricingMethod,
      pricingValue: data.pricingValue,
    })
    return { ok: true }
  })

/** Module 04: link / re-link a batch to the loan contract that financed it */
export const updateBatchInfoFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('batches.manage')])
  .validator(
    z.object({
      batchId: z.number().int(),
      loanContractId: z.number().int().nullable(),
      importDate: z.string().min(10),
    }),
  )
  .handler(async ({ data }) => {
    const { batchId, ...info } = data
    await updateBatchInfo(batchId, info)
    return { ok: true }
  })
