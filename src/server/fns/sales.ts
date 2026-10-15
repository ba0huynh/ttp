import { createServerFn } from '@tanstack/react-start'
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import {
  colors,
  customers,
  deliveryNoteItems,
  deliveryNotes,
  invoiceItems,
  invoices,
  motorcycleModels,
  posBranches,
  salesOrderItems,
  salesOrders,
  vehicles,
} from '#/db/schema.ts'
import { num } from '#/server/services/common.ts'
import {
  cancelSalesOrder,
  createSalesOrder,
  recordDelivery,
  recordInvoice,
} from '#/server/services/sales.ts'
import { authMiddleware } from './middleware.ts'

export const listSalesOrdersFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const list = await db
      .select({
        id: salesOrders.id,
        orderDate: salesOrders.orderDate,
        status: salesOrders.status,
        totalAmount: salesOrders.totalAmount,
        note: salesOrders.note,
        customerId: salesOrders.customerId,
        customerName: customers.name,
        branchId: salesOrders.branchId,
        branchName: posBranches.name,
        vehicleCount: sql<number>`count(distinct ${salesOrderItems.id})`,
        deliveredCount: sql<number>`count(distinct case when ${vehicles.isDelivered} = 1 then ${vehicles.id} end)`,
        invoicedCount: sql<number>`count(distinct case when ${vehicles.isInvoiced} = 1 then ${vehicles.id} end)`,
      })
      .from(salesOrders)
      .innerJoin(customers, eq(customers.id, salesOrders.customerId))
      .leftJoin(posBranches, eq(posBranches.id, salesOrders.branchId))
      .leftJoin(
        salesOrderItems,
        eq(salesOrderItems.salesOrderId, salesOrders.id),
      )
      .leftJoin(vehicles, eq(vehicles.id, salesOrderItems.vehicleId))
      .groupBy(
        salesOrders.id,
        salesOrders.orderDate,
        salesOrders.status,
        salesOrders.totalAmount,
        salesOrders.note,
        salesOrders.customerId,
        customers.name,
        salesOrders.branchId,
        posBranches.name,
      )
      .orderBy(desc(salesOrders.orderDate), desc(salesOrders.id))

    return list.map((o) => ({
      ...o,
      totalAmount: num(o.totalAmount),
      vehicleCount: num(o.vehicleCount),
      deliveredCount: num(o.deliveredCount),
      invoicedCount: num(o.invoicedCount),
    }))
  })

export const getSalesOrderDetailFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const [order] = await db
      .select({
        id: salesOrders.id,
        orderDate: salesOrders.orderDate,
        status: salesOrders.status,
        totalAmount: salesOrders.totalAmount,
        note: salesOrders.note,
        customerId: salesOrders.customerId,
        customerName: customers.name,
        branchId: salesOrders.branchId,
        branchName: posBranches.name,
      })
      .from(salesOrders)
      .innerJoin(customers, eq(customers.id, salesOrders.customerId))
      .leftJoin(posBranches, eq(posBranches.id, salesOrders.branchId))
      .where(eq(salesOrders.id, data.id))

    if (!order) throw new Error('Không tìm thấy phiếu bán')

    const items = await db
      .select({
        id: salesOrderItems.id,
        vehicleId: vehicles.id,
        unitPrice: salesOrderItems.unitPrice,
        costPrice: salesOrderItems.costPrice,
        chassisNumber: vehicles.chassisNumber,
        engineNumber: vehicles.engineNumber,
        isDelivered: vehicles.isDelivered,
        deliveredAt: vehicles.deliveredAt,
        isInvoiced: vehicles.isInvoiced,
        invoicedAt: vehicles.invoicedAt,
        modelName: motorcycleModels.name,
        colorName: colors.name,
      })
      .from(salesOrderItems)
      .innerJoin(vehicles, eq(vehicles.id, salesOrderItems.vehicleId))
      .innerJoin(motorcycleModels, eq(motorcycleModels.id, vehicles.modelId))
      .innerJoin(colors, eq(colors.id, vehicles.colorId))
      .where(eq(salesOrderItems.salesOrderId, data.id))
      .orderBy(salesOrderItems.id)

    const deliveries = await db
      .select({
        id: deliveryNotes.id,
        noteNumber: deliveryNotes.noteNumber,
        deliveryDate: deliveryNotes.deliveryDate,
        receiverName: deliveryNotes.receiverName,
        transportInfo: deliveryNotes.transportInfo,
        itemCount: sql<number>`count(${deliveryNoteItems.id})`,
      })
      .from(deliveryNotes)
      .leftJoin(
        deliveryNoteItems,
        eq(deliveryNoteItems.deliveryNoteId, deliveryNotes.id),
      )
      .where(eq(deliveryNotes.salesOrderId, data.id))
      .groupBy(
        deliveryNotes.id,
        deliveryNotes.noteNumber,
        deliveryNotes.deliveryDate,
        deliveryNotes.receiverName,
        deliveryNotes.transportInfo,
      )
      .orderBy(desc(deliveryNotes.deliveryDate))

    const orderInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        totalAmount: invoices.totalAmount,
        itemCount: sql<number>`count(${invoiceItems.id})`,
      })
      .from(invoices)
      .leftJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
      .where(eq(invoices.salesOrderId, data.id))
      .groupBy(
        invoices.id,
        invoices.invoiceNumber,
        invoices.invoiceDate,
        invoices.totalAmount,
      )
      .orderBy(desc(invoices.invoiceDate))

    return {
      order: {
        ...order,
        totalAmount: num(order.totalAmount),
      },
      items: items.map((i) => ({
        ...i,
        unitPrice: num(i.unitPrice),
        costPrice: num(i.costPrice),
      })),
      deliveries: deliveries.map((d) => ({
        ...d,
        itemCount: num(d.itemCount),
      })),
      invoices: orderInvoices.map((inv) => ({
        ...inv,
        totalAmount: num(inv.totalAmount),
        itemCount: num(inv.itemCount),
      })),
    }
  })

export const createSalesOrderFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orderDate: z.string().min(10),
      customerId: z.number().int(),
      branchId: z.number().int().nullable().optional(),
      items: z.array(
        z.object({
          vehicleId: z.number().int(),
          unitPrice: z.number().positive().optional(),
        }),
      ),
      note: z.string().trim().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const id = await createSalesOrder(data, context.user.id)
    return { id }
  })

export const recordDeliveryFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      salesOrderId: z.number().int(),
      vehicleIds: z.array(z.number().int()).min(1, 'Chọn ít nhất 1 xe'),
      deliveryDate: z.string().min(10),
      receiverName: z.string().trim().nullable().optional(),
      transportInfo: z.string().trim().nullable().optional(),
      note: z.string().trim().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const id = await recordDelivery(data, context.user.id)
    return { id }
  })

export const recordInvoiceFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      salesOrderId: z.number().int(),
      vehicleIds: z.array(z.number().int()).min(1, 'Chọn ít nhất 1 xe'),
      invoiceDate: z.string().min(10),
      invoiceNumber: z.string().trim().nullable().optional(),
      note: z.string().trim().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const id = await recordInvoice(data, context.user.id)
    return { id }
  })

export const cancelSalesOrderFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ orderId: z.number().int() }))
  .handler(async ({ data }) => {
    await cancelSalesOrder(data.orderId)
    return { ok: true }
  })
