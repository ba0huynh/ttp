import { createServerFn } from '@tanstack/react-start'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { customers, posBranches } from '#/db/schema.ts'
import {
  isDuplicateError,
  isReferencedError,
} from '#/server/services/common.ts'
import {
  getCustomerStatement,
  getReceivablesSummary,
} from '#/server/services/reports.ts'
import { authMiddleware, requirePermission } from './middleware.ts'

const opt = z.string().trim().nullable().optional()

export const listCustomersFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('customers.view')])
  .handler(async () => {
    // Independent queries run together (each one is a network round trip)
    const [list, ar] = await Promise.all([
      db
        .select({
          id: customers.id,
          name: customers.name,
          branchCount: sql<number>`(select count(*) from ${posBranches} b where b.customer_id = customers.id)`,
        })
        .from(customers)
        .orderBy(desc(customers.id)),
      getReceivablesSummary(),
    ])
    // Still owed per PARENT customer = sum over all its branch entities
    return list.map((c) => {
      const rows = ar.filter((r) => r.customerId === c.id)
      return {
        ...c,
        branchCount: Number(c.branchCount),
        balance: rows.reduce((s, r) => s + r.balance, 0),
      }
    })
  })

/** Customers + branches — used for sales order / receipt dropdowns */
export const listCustomerOptionsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const cs = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .orderBy(asc(customers.name))
    const bs = await db
      .select({
        id: posBranches.id,
        customerId: posBranches.customerId,
        name: posBranches.name,
        isActive: posBranches.isActive,
      })
      .from(posBranches)
      .orderBy(asc(posBranches.name))
    return cs.map((c) => ({
      ...c,
      branches: bs.filter((b) => b.customerId === c.id && b.isActive),
    }))
  })

export const getCustomerDetailFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('customers.view')])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    // Independent queries run together: each one is a network round trip
    const [[customer], branches, statement, summary] = await Promise.all([
      db.select().from(customers).where(eq(customers.id, data.id)),
      db
        .select()
        .from(posBranches)
        .where(eq(posBranches.customerId, data.id))
        .orderBy(desc(posBranches.id)),
      getCustomerStatement(data.id),
      getReceivablesSummary(),
    ])
    if (!customer) throw new Error('Không tìm thấy khách hàng')
    const ar = summary.filter((r) => r.customerId === data.id)
    return { customer, branches, ...statement, receivables: ar }
  })

export const saveCustomerFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('customers.manage')])
  .validator(
    z.object({
      id: z.number().optional(),
      name: z.string().trim().min(1, 'Nhập tên KH'),
      email: opt,
      note: opt,
    }),
  )
  .handler(async ({ data: { id, ...v } }) => {
    if (id) {
      await db.update(customers).set(v).where(eq(customers.id, id))
      return { id }
    }
    const [r] = await db.insert(customers).values(v).$returningId()
    return { id: r.id }
  })

export const saveBranchFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('customers.manage')])
  .validator(
    z.object({
      id: z.number().optional(),
      customerId: z.number(),
      name: z.string().trim().min(1, 'Nhập tên điểm bán'),
      address: opt,
      contactPerson: opt,
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ data: { id, ...v } }) => {
    try {
      if (id) await db.update(posBranches).set(v).where(eq(posBranches.id, id))
      else await db.insert(posBranches).values(v)
      return { ok: true }
    } catch (e) {
      if (isDuplicateError(e)) throw new Error('Mã điểm bán đã tồn tại')
      throw e
    }
  })

const IN_USE = 'Đang được dùng ở phiếu bán hoặc phiếu thu nên không thể xóa'

/** Deletes a customer and its branches; refused while sales or receipts use them */
export const deleteCustomerFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('customers.manage')])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    try {
      await db.delete(customers).where(eq(customers.id, data.id))
      return { ok: true }
    } catch (e) {
      if (isReferencedError(e)) throw new Error(IN_USE)
      throw e
    }
  })

export const deleteBranchFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('customers.manage')])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    try {
      await db.delete(posBranches).where(eq(posBranches.id, data.id))
      return { ok: true }
    } catch (e) {
      if (isReferencedError(e)) throw new Error(IN_USE)
      throw e
    }
  })
