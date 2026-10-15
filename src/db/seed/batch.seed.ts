import { asc, eq } from 'drizzle-orm'

import { db } from '../index.ts'
import { importBatches, batchExpenses, vehicles } from '../schema.ts'
import {
  allocateBatchExpenses,
  computeSellingPrice,
} from '../../lib/business.ts'

interface SeedBatchesParams {
  adminId: number
  suppliers: {
    supplierThai: { id: number }
    supplierIndo: { id: number }
  }
  loans: {
    loanVcb: { id: number }
    loanBidv: { id: number }
  }
  models: {
    modelSh: { id: number }
    modelWave: { id: number }
    modelVario: { id: number }
    modelScoopy: { id: number }
  }
  colors: {
    cRed: { id: number }
    cWhite: { id: number }
    cBlack: { id: number }
    cGrey: { id: number }
  }
}

/**
 * Seeds import batches, batch expenses, and motorcycle units with automated cost price allocation.
 * Idempotent: skips the insert (both batches + all vehicles, seeded together)
 * if `import_batches` already has rows.
 */
export async function seedBatches({
  adminId,
  suppliers,
  loans,
  models,
  colors,
}: SeedBatchesParams) {
  const existingBatches = await db.select().from(importBatches)
  if (existingBatches.length > 0) {
    console.log(' -> Import batches already seeded, skipping...')
    const batch1 = existingBatches.find((b) => b.importDate === '2026-01-15')!
    const batch2 = existingBatches.find((b) => b.importDate === '2026-02-20')!

    // Preserve the original insertion order (batch1's 10 vehicles, then
    // batch2's 4 vehicles): sales.ts indexes vIds by fixed position.
    const batch1Vehicles = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.batchId, batch1.id))
      .orderBy(asc(vehicles.id))
    const batch2Vehicles = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.batchId, batch2.id))
      .orderBy(asc(vehicles.id))
    const allVehicles = [...batch1Vehicles, ...batch2Vehicles]

    return {
      batches: { batch1, batch2 },
      vehicles: allVehicles,
      vIds: allVehicles.map((v) => v.id),
    }
  }

  console.log(' -> Seeding Batch 1 (Thailand) and expense allocation...')
  const [batch1] = await db
    .insert(importBatches)
    .values({
      supplierId: suppliers.supplierThai.id,
      loanContractId: loans.loanVcb.id,
      importDate: '2026-01-15',
      pricingBase: 'cost_price',
      pricingMethod: 'percent',
      pricingValue: 8, // 8% profit margin on cost price
      note: 'Lô xe nhập từ Thai Honda Manufacturing',
      createdBy: adminId,
    })
    .$returningId()

  // Batch 1 expenses: Total = 170,000,000 VND
  await db.insert(batchExpenses).values([
    {
      batchId: batch1.id,
      expenseType: 'import_tax',
      description: 'Thuế nhập khẩu và thuế TTĐB theo tờ khai',
      amount: 110_000_000,
    },
    {
      batchId: batch1.id,
      expenseType: 'shipping_international',
      description: 'Cước vận chuyển container đường biển Bangkok - Cát Lái',
      amount: 35_000_000,
    },
    {
      batchId: batch1.id,
      expenseType: 'customs_fee',
      description: 'Phí làm thủ tục hải quan và kiểm định khí thải',
      amount: 15_000_000,
    },
    {
      batchId: batch1.id,
      expenseType: 'shipping_domestic',
      description: 'Vận chuyển xe lồng từ cảng Cát Lái về kho Lê Văn Sỹ',
      amount: 10_000_000,
    },
  ])

  // Vehicles in Batch 1: 10 units (5 SH 150i @ 82M import, 5 Wave 125i @ 48M import)
  const batch1RawVehicles = [
    // 5 units SH 150i ABS
    {
      modelId: models.modelSh.id,
      colorId: colors.cBlack.id,
      chassisNumber: 'KF20E-001001',
      engineNumber: 'KF20M-001001',
      importPrice: 82_000_000,
    },
    {
      modelId: models.modelSh.id,
      colorId: colors.cWhite.id,
      chassisNumber: 'KF20E-001002',
      engineNumber: 'KF20M-001002',
      importPrice: 82_000_000,
    },
    {
      modelId: models.modelSh.id,
      colorId: colors.cGrey.id,
      chassisNumber: 'KF20E-001003',
      engineNumber: 'KF20M-001003',
      importPrice: 82_000_000,
    },
    {
      modelId: models.modelSh.id,
      colorId: colors.cRed.id,
      chassisNumber: 'KF20E-001004',
      engineNumber: 'KF20M-001004',
      importPrice: 82_000_000,
    },
    {
      modelId: models.modelSh.id,
      colorId: colors.cWhite.id,
      chassisNumber: 'KF20E-001005',
      engineNumber: 'KF20M-001005',
      importPrice: 82_000_000,
    },
    // 5 units Wave 125i Thai
    {
      modelId: models.modelWave.id,
      colorId: colors.cRed.id,
      chassisNumber: 'MLHJ-002001',
      engineNumber: 'MLHM-002001',
      importPrice: 48_000_000,
    },
    {
      modelId: models.modelWave.id,
      colorId: colors.cBlack.id,
      chassisNumber: 'MLHJ-002002',
      engineNumber: 'MLHM-002002',
      importPrice: 48_000_000,
    },
    {
      modelId: models.modelWave.id,
      colorId: colors.cWhite.id,
      chassisNumber: 'MLHJ-002003',
      engineNumber: 'MLHM-002003',
      importPrice: 48_000_000,
    },
    {
      modelId: models.modelWave.id,
      colorId: colors.cGrey.id,
      chassisNumber: 'MLHJ-002004',
      engineNumber: 'MLHM-002004',
      importPrice: 48_000_000,
    },
    {
      modelId: models.modelWave.id,
      colorId: colors.cRed.id,
      chassisNumber: 'MLHJ-002005',
      engineNumber: 'MLHM-002005',
      importPrice: 48_000_000,
    },
  ]

  // Automated cost allocation for Batch 1
  const totalExpenseBatch1 = 170_000_000
  const allocatedBatch1 = allocateBatchExpenses(
    batch1RawVehicles.map((v, i) => ({
      id: i + 1,
      importPrice: v.importPrice,
    })),
    totalExpenseBatch1,
  )

  const insertedVehiclesBatch1 = await db
    .insert(vehicles)
    .values(
      batch1RawVehicles.map((v, i) => {
        const alloc = allocatedBatch1[i]
        const selling = computeSellingPrice(alloc, {
          pricingBase: 'cost_price',
          pricingMethod: 'percent',
          pricingValue: 8,
        })
        return {
          batchId: batch1.id,
          modelId: v.modelId,
          colorId: v.colorId,
          chassisNumber: v.chassisNumber,
          engineNumber: v.engineNumber,
          importPrice: v.importPrice,
          allocatedExpense: alloc.allocatedExpense,
          costPrice: alloc.costPrice,
          sellingPrice: selling,
          isDelivered: false,
          isInvoiced: false,
        }
      }),
    )
    .$returningId()

  const vIds = insertedVehiclesBatch1.map((v) => v.id)

  console.log(' -> Seeding Batch 2 (Indonesia) and expense allocation...')
  const [batch2] = await db
    .insert(importBatches)
    .values({
      supplierId: suppliers.supplierIndo.id,
      loanContractId: loans.loanBidv.id,
      importDate: '2026-02-20',
      pricingBase: 'cost_price',
      pricingMethod: 'fixed_amount',
      pricingValue: 3_500_000, // Fixed 3.5M markup on cost price
      note: 'Lô Vario 160 và Scoopy nhập từ PT Astra Honda Motor',
      createdBy: adminId,
    })
    .$returningId()

  await db.insert(batchExpenses).values([
    {
      batchId: batch2.id,
      expenseType: 'import_tax',
      description: 'Thuế nhập khẩu và VAT',
      amount: 75_000_000,
    },
    {
      batchId: batch2.id,
      expenseType: 'shipping_international',
      description: 'Cước vận chuyển container Jakarta - TP.HCM',
      amount: 25_000_000,
    },
  ])

  const batch2RawVehicles = [
    {
      modelId: models.modelVario.id,
      colorId: colors.cBlack.id,
      chassisNumber: 'MH1KF-003001',
      engineNumber: 'KF16E-003001',
      importPrice: 42_000_000,
    },
    {
      modelId: models.modelVario.id,
      colorId: colors.cGrey.id,
      chassisNumber: 'MH1KF-003002',
      engineNumber: 'KF16E-003002',
      importPrice: 42_000_000,
    },
    {
      modelId: models.modelScoopy.id,
      colorId: colors.cWhite.id,
      chassisNumber: 'MH1JM-004001',
      engineNumber: 'JM11E-004001',
      importPrice: 35_000_000,
    },
    {
      modelId: models.modelScoopy.id,
      colorId: colors.cRed.id,
      chassisNumber: 'MH1JM-004002',
      engineNumber: 'JM11E-004002',
      importPrice: 35_000_000,
    },
  ]

  const allocatedBatch2 = allocateBatchExpenses(
    batch2RawVehicles.map((v, i) => ({
      id: i + 1,
      importPrice: v.importPrice,
    })),
    100_000_000,
  )

  const insertedVehiclesBatch2 = await db
    .insert(vehicles)
    .values(
      batch2RawVehicles.map((v, i) => {
        const alloc = allocatedBatch2[i]
        const selling = computeSellingPrice(alloc, {
          pricingBase: 'cost_price',
          pricingMethod: 'fixed_amount',
          pricingValue: 3_500_000,
        })
        return {
          batchId: batch2.id,
          modelId: v.modelId,
          colorId: v.colorId,
          chassisNumber: v.chassisNumber,
          engineNumber: v.engineNumber,
          importPrice: v.importPrice,
          allocatedExpense: alloc.allocatedExpense,
          costPrice: alloc.costPrice,
          sellingPrice: selling,
          isDelivered: false,
          isInvoiced: false,
        }
      }),
    )
    .$returningId()

  return {
    batches: { batch1, batch2 },
    vehicles: [...insertedVehiclesBatch1, ...insertedVehiclesBatch2],
    vIds,
  }
}
