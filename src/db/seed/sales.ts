import { eq } from 'drizzle-orm'
import { db } from '../index.ts'
import {
  salesOrders,
  salesOrderItems,
  deliveryNotes,
  deliveryNoteItems,
  invoices,
  invoiceItems,
  vehicles,
} from '../schema.ts'

interface SeedSalesParams {
  adminId: number
  customers: {
    custNamAnh: { id: number }
    custThanhDat: { id: number }
  }
  branches: {
    branchNamAnhQ10: { id: number }
    branchNamAnhBD: { id: number }
    branchThanhDatTD: { id: number }
  }
  vIds: number[]
}

/**
 * Seeds wholesale sales orders, delivery notes, and commercial invoices.
 * Crucially illustrates all 3 operational permutations of the Dual Independent Inventory:
 * 1. Both Physically Delivered AND Financially Invoiced (Order 1)
 * 2. Invoiced but NOT YET Physically Delivered (Order 2 - financed bikes awaiting transport pickup)
 * 3. Physically Delivered but NOT YET Financially Invoiced (Order 3 - urgent display units billed monthly)
 *
 * Idempotent: skips the insert (orders, delivery notes, invoices, vehicle
 * flags, all seeded together) if `sales_orders` already has rows.
 */
export async function seedSales({
  adminId,
  customers,
  branches,
  vIds,
}: SeedSalesParams) {
  const existingOrders = await db.select().from(salesOrders)
  if (existingOrders.length > 0) {
    console.log(' -> Sales orders already seeded, skipping...')
    return {
      orders: {
        order1: existingOrders.find((o) => o.orderNumber === 'PBX-260120-001')!,
        order2: existingOrders.find((o) => o.orderNumber === 'PBX-260125-002')!,
        order3: existingOrders.find((o) => o.orderNumber === 'PBX-260205-003')!,
      },
    }
  }

  console.log(
    ' -> Seeding sales orders and Dual Independent Inventory demonstration...',
  )

  // SALES ORDER 1: Sell 3 vehicles to Nam Anh - Showroom Q10
  // Status: BOTH DELIVERED AND INVOICED
  const [order1] = await db
    .insert(salesOrders)
    .values({
      orderNumber: 'PBX-260120-001',
      orderDate: '2026-01-20',
      customerId: customers.custNamAnh.id,
      branchId: branches.branchNamAnhQ10.id,
      status: 'confirmed',
      totalAmount: 305_000_000,
      note: 'Đơn hàng bán sỉ 2 SH 150i và 1 Wave 125i',
      createdBy: adminId,
    })
    .$returningId()

  const order1Vehicles = [vIds[0], vIds[1], vIds[5]] // 2 SH + 1 Wave
  await db.insert(salesOrderItems).values([
    {
      salesOrderId: order1.id,
      vehicleId: vIds[0],
      unitPrice: 110_000_000,
      costPrice: 103_443_077,
    },
    {
      salesOrderId: order1.id,
      vehicleId: vIds[1],
      unitPrice: 110_000_000,
      costPrice: 103_443_077,
    },
    {
      salesOrderId: order1.id,
      vehicleId: vIds[5],
      unitPrice: 85_000_000,
      costPrice: 60_552_041,
    },
  ])

  // Delivery note for Order 1
  const [dn1] = await db
    .insert(deliveryNotes)
    .values({
      noteNumber: 'PGX-260121-001',
      salesOrderId: order1.id,
      deliveryDate: '2026-01-21',
      receiverName: 'Anh Hùng (Lái xe tải Nam Anh)',
      transportInfo: 'Xe tải biển số 51C-987.65',
      note: 'Giao đủ 3 xe kèm bộ khóa Smartkey và gương',
      createdBy: adminId,
    })
    .$returningId()

  await db.insert(deliveryNoteItems).values(
    order1Vehicles.map((vId) => ({
      deliveryNoteId: dn1.id,
      vehicleId: vId,
    })),
  )

  // Commercial invoice for Order 1
  const [inv1] = await db
    .insert(invoices)
    .values({
      invoiceNumber: 'HD-260121-001',
      salesOrderId: order1.id,
      invoiceDate: '2026-01-21',
      branchId: branches.branchNamAnhQ10.id,
      totalAmount: 305_000_000,
      note: 'Hóa đơn xuất bán cho Showroom Quận 10',
      createdBy: adminId,
    })
    .$returningId()

  await db.insert(invoiceItems).values(
    order1Vehicles.map((vId, idx) => ({
      invoiceId: inv1.id,
      vehicleId: vId,
      amount: idx === 2 ? 85_000_000 : 110_000_000,
    })),
  )

  // Update vehicles for Order 1: Delivered AND Invoiced
  for (const vId of order1Vehicles) {
    await db
      .update(vehicles)
      .set({
        isDelivered: true,
        deliveredAt: '2026-01-21',
        isInvoiced: true,
        invoicedAt: '2026-01-21',
      })
      .where(eq(vehicles.id, vId))
  }

  // SALES ORDER 2: Sell 2 vehicles to Nam Anh - Showroom Binh Duong
  // DUAL INVENTORY WORKFLOW: INVOICED BUT NOT YET DELIVERED!
  // (Customer requests invoice for financing/registration; vehicles remain stored at warehouse)
  const [order2] = await db
    .insert(salesOrders)
    .values({
      orderNumber: 'PBX-260125-002',
      orderDate: '2026-01-25',
      customerId: customers.custNamAnh.id,
      branchId: branches.branchNamAnhBD.id,
      status: 'confirmed',
      totalAmount: 195_000_000,
      note: 'Khách yêu cầu xuất hóa đơn trước để vay vốn, xe gửi kho chờ chở sau',
      createdBy: adminId,
    })
    .$returningId()

  const order2Vehicles = [vIds[2], vIds[6]] // 1 SH + 1 Wave
  await db.insert(salesOrderItems).values([
    {
      salesOrderId: order2.id,
      vehicleId: vIds[2],
      unitPrice: 110_000_000,
      costPrice: 103_443_077,
    },
    {
      salesOrderId: order2.id,
      vehicleId: vIds[6],
      unitPrice: 85_000_000,
      costPrice: 60_552_041,
    },
  ])

  // Issue invoice for Order 2 (DO NOT create delivery note!)
  const [inv2] = await db
    .insert(invoices)
    .values({
      invoiceNumber: 'HD-260125-002',
      salesOrderId: order2.id,
      invoiceDate: '2026-01-25',
      branchId: branches.branchNamAnhBD.id,
      totalAmount: 195_000_000,
      note: 'Hóa đơn xuất trước theo hợp đồng',
      createdBy: adminId,
    })
    .$returningId()

  await db.insert(invoiceItems).values([
    { invoiceId: inv2.id, vehicleId: vIds[2], amount: 110_000_000 },
    { invoiceId: inv2.id, vehicleId: vIds[6], amount: 85_000_000 },
  ])

  // Update vehicles for Order 2: isInvoiced = true, isDelivered = false!
  for (const vId of order2Vehicles) {
    await db
      .update(vehicles)
      .set({
        isDelivered: false,
        isInvoiced: true,
        invoicedAt: '2026-01-25',
      })
      .where(eq(vehicles.id, vId))
  }

  // SALES ORDER 3: Sell 2 vehicles to Thanh Dat Thu Duc
  // DUAL INVENTORY WORKFLOW: PHYSICALLY DELIVERED BUT NOT YET INVOICED!
  // (Dealer urgently needs bikes for showroom display, invoice billed at month end)
  const [order3] = await db
    .insert(salesOrders)
    .values({
      orderNumber: 'PBX-260205-003',
      orderDate: '2026-02-05',
      customerId: customers.custThanhDat.id,
      branchId: branches.branchThanhDatTD.id,
      status: 'confirmed',
      totalAmount: 195_000_000,
      note: 'Đã giao xe giao trước, hóa đơn xuất dồn cuối tháng',
      createdBy: adminId,
    })
    .$returningId()

  const order3Vehicles = [vIds[3], vIds[7]] // 1 SH + 1 Wave
  await db.insert(salesOrderItems).values([
    {
      salesOrderId: order3.id,
      vehicleId: vIds[3],
      unitPrice: 110_000_000,
      costPrice: 103_443_077,
    },
    {
      salesOrderId: order3.id,
      vehicleId: vIds[7],
      unitPrice: 85_000_000,
      costPrice: 60_552_041,
    },
  ])

  // Physical delivery for Order 3 (DO NOT create invoice!)
  const [dn3] = await db
    .insert(deliveryNotes)
    .values({
      noteNumber: 'PGX-260205-002',
      salesOrderId: order3.id,
      deliveryDate: '2026-02-05',
      receiverName: 'Anh Đạt',
      transportInfo: 'Khách tự lái xe tải đến kho lấy',
      note: 'Đã kiểm tra xe nguyên vẹn kèm sổ bảo hành',
      createdBy: adminId,
    })
    .$returningId()

  await db.insert(deliveryNoteItems).values(
    order3Vehicles.map((vId) => ({
      deliveryNoteId: dn3.id,
      vehicleId: vId,
    })),
  )

  // Update vehicles for Order 3: isDelivered = true, isInvoiced = false!
  for (const vId of order3Vehicles) {
    await db
      .update(vehicles)
      .set({
        isDelivered: true,
        deliveredAt: '2026-02-05',
        isInvoiced: false,
      })
      .where(eq(vehicles.id, vId))
  }

  return {
    orders: { order1, order2, order3 },
  }
}
