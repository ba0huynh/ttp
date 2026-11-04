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
  updateSalesOrder,
  updateSalesOrderPricing,
  createSalesOrder,
  recordDelivery,
  recordInvoice,
  revertInvoice,
  updateInvoice,
  updateDeliveryNote,
  revertDeliveryNote,
} from '#/server/services/sales.ts'
import { requirePermission } from './middleware.ts'

export const listSalesOrdersFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('sales.view', 'dashboard.view')])
  .handler(async () => {
    const list = await db
      .select({
        id: salesOrders.id,
        orderDate: salesOrders.orderDate,
        status: salesOrders.status,
        totalAmount: salesOrders.totalAmount,
        customerId: salesOrders.customerId,
        customerName: customers.name,
        branchId: salesOrders.branchId,
        branchName: posBranches.name,
        vehicleCount: sql<number>`count(distinct ${salesOrderItems.id})`,
        totalBeforeVat: sql<string>`coalesce(sum(${salesOrderItems.priceBeforeVat}),0)`,
        // Cost = import price before VAT + allocated batch expense (same basis as /reports)
        totalCost: sql<string>`coalesce(sum(${salesOrderItems.costPrice} - greatest(${vehicles.importPriceWithVat} - ${vehicles.importPrice}, 0)),0)`,
        minVatRate: sql<string>`coalesce(min(${salesOrderItems.vatRate}),0)`,
        maxVatRate: sql<string>`coalesce(max(${salesOrderItems.vatRate}),0)`,
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
        salesOrders.customerId,
        customers.name,
        salesOrders.branchId,
        posBranches.name,
      )
      .orderBy(desc(salesOrders.orderDate), desc(salesOrders.id))

    return list.map((o) => ({
      ...o,
      totalAmount: num(o.totalAmount),
      totalBeforeVat: num(o.totalBeforeVat),
      totalCost: num(o.totalCost),
      minVatRate: num(o.minVatRate),
      maxVatRate: num(o.maxVatRate),
      vehicleCount: num(o.vehicleCount),
      deliveredCount: num(o.deliveredCount),
      invoicedCount: num(o.invoicedCount),
    }))
  })

export const getSalesOrderDetailFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('sales.view')])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const [order] = await db
      .select({
        id: salesOrders.id,
        orderDate: salesOrders.orderDate,
        status: salesOrders.status,
        totalAmount: salesOrders.totalAmount,
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
        priceBeforeVat: salesOrderItems.priceBeforeVat,
        vatRate: salesOrderItems.vatRate,
        costPrice: salesOrderItems.costPrice,
        chassisNumber: vehicles.chassisNumber,
        engineNumber: vehicles.engineNumber,
        isDelivered: vehicles.isDelivered,
        deliveredAt: vehicles.deliveredAt,
        isInvoiced: vehicles.isInvoiced,
        invoicedAt: vehicles.invoicedAt,
        modelName: sql<string>`coalesce(${motorcycleModels.name}, '')`,
        colorName: colors.name,
        colorHex: colors.hex,
        deliveryNoteId: deliveryNotes.id,
        deliveryNoteNumber: deliveryNotes.noteNumber,
        deliveryDate: deliveryNotes.deliveryDate,
        receiverName: deliveryNotes.receiverName,
        transportInfo: deliveryNotes.transportInfo,
        deliveryNoteContent: deliveryNotes.note,
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
      })
      .from(salesOrderItems)
      .innerJoin(vehicles, eq(vehicles.id, salesOrderItems.vehicleId))
      .leftJoin(motorcycleModels, eq(motorcycleModels.id, vehicles.modelId))
      .innerJoin(colors, eq(colors.id, vehicles.colorId))
      .leftJoin(deliveryNoteItems, eq(deliveryNoteItems.vehicleId, vehicles.id))
      .leftJoin(deliveryNotes, eq(deliveryNotes.id, deliveryNoteItems.deliveryNoteId))
      .leftJoin(invoiceItems, eq(invoiceItems.vehicleId, vehicles.id))
      .leftJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
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
        priceBeforeVat: num(i.priceBeforeVat),
        vatRate: num(i.vatRate),
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
  .middleware([requirePermission('sales.create')])
  .validator(
    z.object({
      orderDate: z.string().min(10, 'Vui lòng chọn ngày lập phiếu'),
      customerId: z.number().int({ message: 'Vui lòng chọn khách hàng' }),
      branchId: z.number().int().nullable().optional(),
      items: z
        .array(
          z.object({
            vehicleId: z.number().int(),
            priceBeforeVat: z
              .number({ message: 'Vui lòng nhập đơn giá chưa VAT' })
              .positive('Phải lớn hơn 0')
              .optional(),
            vatRate: z
              .number({ message: 'Vui lòng nhập thuế VAT' })
              .min(0, 'Thuế VAT không được âm')
              .max(100, 'Thuế VAT tối đa 100%')
              .optional(),
          }),
        )
        .min(1, 'Vui lòng chọn ít nhất một chiếc xe từ kho để bán'),
    }),
  )
  .handler(async ({ data, context }) => {
    const id = await createSalesOrder(data, context.user.id)
    return { id }
  })

export const recordDeliveryFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('sales.deliver')])
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

export const updateDeliveryNoteFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('sales.deliver')])
  .validator(
    z.object({
      salesOrderId: z.number().int(),
      deliveryNoteId: z.number().int(),
      deliveryDate: z.string().min(10, 'Ngày giao hàng không hợp lệ'),
      receiverName: z.string().trim().nullable().optional(),
      transportInfo: z.string().trim().nullable().optional(),
      note: z.string().trim().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await updateDeliveryNote(data, context.user.id)
    return { ok: true }
  })

export const revertDeliveryNoteFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('sales.deliver')])
  .validator(
    z.object({
      salesOrderId: z.number().int(),
      deliveryNoteId: z.number().int().optional().nullable(),
      vehicleId: z.number().int().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await revertDeliveryNote(data, context.user.id)
    return { ok: true }
  })

export const recordInvoiceFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('sales.invoice')])
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
    const ids = await recordInvoice(data, context.user.id)
    return { ids }
  })

export const revertInvoiceFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('sales.invoice')])
  .validator(
    z.object({
      salesOrderId: z.number().int(),
      vehicleId: z.number().int(),
    }),
  )
  .handler(async ({ data }) => {
    await revertInvoice(data)
    return { ok: true }
  })

export const updateInvoiceFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('sales.invoice')])
  .validator(
    z.object({
      salesOrderId: z.number().int(),
      vehicleId: z.number().int(),
      invoiceNumber: z.string().trim().min(1, 'Nhập số hóa đơn'),
      invoiceDate: z.string().min(10, 'Ngày xuất hóa đơn không hợp lệ'),
    }),
  )
  .handler(async ({ data }) => {
    await updateInvoice(data)
    return { ok: true }
  })

export const cancelSalesOrderFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('sales.create')])
  .validator(z.object({ orderId: z.number().int() }))
  .handler(async ({ data }) => {
    await cancelSalesOrder(data.orderId)
    return { ok: true }
  })

export const updateSalesOrderFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('sales.create')])
  .validator(
    z.object({
      orderId: z.number().int(),
      orderDate: z.string().min(10),
      customerId: z.number().int(),
      branchId: z.number().int().nullable().optional(),
    }),
  )
  .handler(async ({ data: { orderId, ...v } }) => {
    await updateSalesOrder(orderId, v)
    return { ok: true }
  })

export const updateSalesOrderPricingFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('sales.create')])
  .validator(
    z.object({
      salesOrderId: z.number().int(),
      items: z.array(
        z.object({
          itemId: z.number().int(),
          priceBeforeVat: z.number().min(0, 'Đơn giá chưa VAT không hợp lệ'),
          vatRate: z.number().min(0, 'VAT không được âm').max(100, 'VAT tối đa 100%'),
        }),
      ).min(1, 'Chọn ít nhất 1 dòng xe để cập nhật giá'),
    }),
  )
  .handler(async ({ data, context }) => {
    return await updateSalesOrderPricing(data, context.user.id)
  })
