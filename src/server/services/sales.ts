import { and, eq, inArray } from 'drizzle-orm'

import { db } from '../../db/index.ts'
import {
  deliveryNoteItems,
  deliveryNotes,
  invoiceItems,
  invoices,
  posBranches,
  salesOrderItems,
  salesOrders,
  vehicles,
} from '../../db/schema.ts'
import {
  BusinessError,
  isDuplicateError,
  nextDocNumber,
  num,
} from './common.ts'

export interface CreateSalesOrderInput {
  orderDate: string
  customerId: number
  branchId?: number | null
  items: { vehicleId: number; unitPrice?: number | null }[]
}

/**
 * Lập phiếu bán: chọn xe cụ thể từ kho.
 * Chặn bán trùng 2 lớp: kiểm tra ứng dụng + UNIQUE(sales_order_items.vehicle_id).
 */
export async function createSalesOrder(
  input: CreateSalesOrderInput,
  userId?: number,
) {
  const ids = [...new Set(input.items.map((i) => i.vehicleId))]
  if (ids.length === 0)
    throw new BusinessError('Phiếu bán phải có ít nhất 1 xe')
  if (ids.length !== input.items.length)
    throw new BusinessError('Một xe bị chọn nhiều lần trong phiếu')

  try {
    return await db.transaction(async (tx) => {
      if (input.branchId) {
        const [b] = await tx
          .select({ customerId: posBranches.customerId })
          .from(posBranches)
          .where(eq(posBranches.id, input.branchId))
        if (!b || b.customerId !== input.customerId)
          throw new BusinessError('Điểm bán không thuộc khách hàng đã chọn')
      }

      const list = await tx
        .select()
        .from(vehicles)
        .where(inArray(vehicles.id, ids))
      if (list.length !== ids.length)
        throw new BusinessError('Có xe không tồn tại')

      const sold = await tx
        .select({ c: vehicles.chassisNumber })
        .from(salesOrderItems)
        .innerJoin(vehicles, eq(vehicles.id, salesOrderItems.vehicleId))
        .where(inArray(salesOrderItems.vehicleId, ids))
      if (sold.length > 0)
        throw new BusinessError(
          `Xe đã được bán, không thể bán lại: ${sold.map((s) => s.c).join(', ')}`,
        )

      const priceMap = new Map(
        input.items.map((i) => [i.vehicleId, i.unitPrice]),
      )
      const rows = list.map((v) => ({
        vehicleId: v.id,
        unitPrice: num(priceMap.get(v.id) ?? v.sellingPrice),
        costPrice: num(v.costPrice),
      }))
      const total = rows.reduce((s, r) => s + r.unitPrice, 0)

      const [created] = await tx
        .insert(salesOrders)
        .values({
          orderDate: input.orderDate,
          customerId: input.customerId,
          branchId: input.branchId ?? null,
          totalAmount: total,
          createdBy: userId ?? null,
        })
        .$returningId()
      const orderId = created.id
      await tx
        .insert(salesOrderItems)
        .values(rows.map((r) => ({ ...r, salesOrderId: orderId })))
      return orderId
    })
  } catch (e) {
    if (isDuplicateError(e))
      throw new BusinessError('Xe vừa được bán ở phiếu khác — vui lòng tải lại')
    throw e
  }
}

async function loadOrderVehicleIds(orderId: number) {
  const [order] = await db
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.id, orderId))
  if (!order) throw new BusinessError('Không tìm thấy phiếu bán')
  if (order.status === 'cancelled') throw new BusinessError('Phiếu bán đã hủy')
  const items = await db
    .select({
      vehicleId: salesOrderItems.vehicleId,
      unitPrice: salesOrderItems.unitPrice,
    })
    .from(salesOrderItems)
    .where(eq(salesOrderItems.salesOrderId, orderId))
  return { order, items }
}

/** PHYSICAL DELIVERY — only modifies is_delivered flag (DOES NOT touch is_invoiced) */
export async function recordDelivery(
  input: {
    salesOrderId: number
    vehicleIds: number[]
    deliveryDate: string
    receiverName?: string | null
    transportInfo?: string | null
    note?: string | null
  },
  userId?: number,
) {
  const { items } = await loadOrderVehicleIds(input.salesOrderId)
  const allowed = new Set(items.map((i) => i.vehicleId))
  if (input.vehicleIds.length === 0)
    throw new BusinessError('Chưa chọn xe để giao')
  for (const id of input.vehicleIds)
    if (!allowed.has(id)) throw new BusinessError('Có xe không thuộc phiếu bán')

  try {
    return await db.transaction(async (tx) => {
      const already = await tx
        .select({ c: vehicles.chassisNumber })
        .from(vehicles)
        .where(
          and(
            inArray(vehicles.id, input.vehicleIds),
            eq(vehicles.isDelivered, true),
          ),
        )
      if (already.length)
        throw new BusinessError(
          `Xe đã giao trước đó: ${already.map((a) => a.c).join(', ')}`,
        )

      const noteNumber = await nextDocNumber(
        tx,
        deliveryNotes,
        deliveryNotes.noteNumber,
        'PGX',
        input.deliveryDate,
      )
      const [created] = await tx
        .insert(deliveryNotes)
        .values({
          noteNumber,
          salesOrderId: input.salesOrderId,
          deliveryDate: input.deliveryDate,
          receiverName: input.receiverName ?? null,
          transportInfo: input.transportInfo ?? null,
          note: input.note ?? null,
          createdBy: userId ?? null,
        })
        .$returningId()
      await tx.insert(deliveryNoteItems).values(
        input.vehicleIds.map((vehicleId) => ({
          deliveryNoteId: created.id,
          vehicleId,
        })),
      )
      await tx
        .update(vehicles)
        .set({ isDelivered: true, deliveredAt: input.deliveryDate })
        .where(inArray(vehicles.id, input.vehicleIds))
      return created.id
    })
  } catch (e) {
    if (isDuplicateError(e))
      throw new BusinessError('Xe đã nằm trong phiếu giao khác')
    throw e
  }
}

/** INTERNAL INVOICING — only modifies is_invoiced flag (DOES NOT touch is_delivered) */
export async function recordInvoice(
  input: {
    salesOrderId: number
    vehicleIds: number[]
    invoiceDate: string
    invoiceNumber?: string | null
    note?: string | null
  },
  userId?: number,
) {
  const { order, items } = await loadOrderVehicleIds(input.salesOrderId)
  const priceMap = new Map(items.map((i) => [i.vehicleId, num(i.unitPrice)]))
  if (input.vehicleIds.length === 0)
    throw new BusinessError('Chưa chọn xe để xuất hóa đơn')
  for (const id of input.vehicleIds)
    if (!priceMap.has(id))
      throw new BusinessError('Có xe không thuộc phiếu bán')

  try {
    return await db.transaction(async (tx) => {
      const already = await tx
        .select({ c: vehicles.chassisNumber })
        .from(vehicles)
        .where(
          and(
            inArray(vehicles.id, input.vehicleIds),
            eq(vehicles.isInvoiced, true),
          ),
        )
      if (already.length)
        throw new BusinessError(
          `Xe đã xuất hóa đơn: ${already.map((a) => a.c).join(', ')}`,
        )

      const invoiceNumber =
        input.invoiceNumber?.trim() ||
        (await nextDocNumber(
          tx,
          invoices,
          invoices.invoiceNumber,
          'HD',
          input.invoiceDate,
        ))
      const total = input.vehicleIds.reduce(
        (s, id) => s + (priceMap.get(id) ?? 0),
        0,
      )
      const [created] = await tx
        .insert(invoices)
        .values({
          invoiceNumber,
          salesOrderId: order.id,
          invoiceDate: input.invoiceDate,
          branchId: order.branchId,
          totalAmount: total,
          note: input.note ?? null,
          createdBy: userId ?? null,
        })
        .$returningId()
      await tx.insert(invoiceItems).values(
        input.vehicleIds.map((vehicleId) => ({
          invoiceId: created.id,
          vehicleId,
          amount: priceMap.get(vehicleId) ?? 0,
        })),
      )
      await tx
        .update(vehicles)
        .set({ isInvoiced: true, invoicedAt: input.invoiceDate })
        .where(inArray(vehicles.id, input.vehicleIds))
      return created.id
    })
  } catch (e) {
    if (isDuplicateError(e))
      throw new BusinessError('Số hóa đơn đã tồn tại hoặc xe đã có hóa đơn')
    throw e
  }
}

/** Cancels order: only permitted when no vehicles have been delivered or invoiced. Releases vehicles back to inventory. */
export async function cancelSalesOrder(orderId: number) {
  await db.transaction(async (tx) => {
    const [d] = await tx
      .select({ id: deliveryNotes.id })
      .from(deliveryNotes)
      .where(eq(deliveryNotes.salesOrderId, orderId))
      .limit(1)
    const [i] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.salesOrderId, orderId))
      .limit(1)
    if (d || i)
      throw new BusinessError(
        'Phiếu đã có giao xe hoặc hóa đơn — không thể hủy',
      )
    await tx
      .delete(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, orderId))
    await tx
      .update(salesOrders)
      .set({ status: 'cancelled', totalAmount: 0 })
      .where(eq(salesOrders.id, orderId))
  })
}

/** Changes the header of an order (date, customer, branch) while nothing was delivered or invoiced */
export async function updateSalesOrder(
  orderId: number,
  input: { orderDate: string; customerId: number; branchId?: number | null },
) {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ status: salesOrders.status })
      .from(salesOrders)
      .where(eq(salesOrders.id, orderId))
    if (!order) throw new BusinessError('Không tìm thấy phiếu bán')
    if (order.status === 'cancelled')
      throw new BusinessError('Phiếu đã hủy — không thể sửa')
    const [d] = await tx
      .select({ id: deliveryNotes.id })
      .from(deliveryNotes)
      .where(eq(deliveryNotes.salesOrderId, orderId))
      .limit(1)
    const [i] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.salesOrderId, orderId))
      .limit(1)
    if (d || i)
      throw new BusinessError(
        'Phiếu đã có giao xe hoặc hóa đơn — không thể sửa',
      )
    if (input.branchId) {
      const [b] = await tx
        .select({ customerId: posBranches.customerId })
        .from(posBranches)
        .where(eq(posBranches.id, input.branchId))
      if (!b || b.customerId !== input.customerId)
        throw new BusinessError('Điểm bán không thuộc khách hàng')
    }
    await tx
      .update(salesOrders)
      .set({
        orderDate: input.orderDate,
        customerId: input.customerId,
        branchId: input.branchId ?? null,
      })
      .where(eq(salesOrders.id, orderId))
  })
}
