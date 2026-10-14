import { createServerFn } from '@tanstack/react-start'
import { asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { customers, posBranches, salesOrders } from '#/db/schema.ts'
import { isDuplicateError } from '#/server/services/common.ts'
import {
  getCustomerStatement,
  getReceivablesSummary,
} from '#/server/services/reports.ts'
import { authMiddleware } from './middleware.ts'

const opt = z.string().trim().nullable().optional()

export const listCustomersFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const list = await db
      .select({
        id: customers.id,
        code: customers.code,
        name: customers.name,
        taxCode: customers.taxCode,
        phone: customers.phone,
        address: customers.address,
        contactPerson: customers.contactPerson,
        branchCount: sql<number>`(select count(*) from ${posBranches} b where b.customer_id = ${customers.id})`,
        revenue: sql<string>`coalesce((select sum(o.total_amount) from ${salesOrders} o where o.customer_id = ${customers.id} and o.status = 'confirmed'),0)`,
      })
      .from(customers)
      .orderBy(asc(customers.name))
    const ar = await getReceivablesSummary()
    return list.map((c) => ({
      ...c,
      branchCount: Number(c.branchCount),
      revenue: Number(c.revenue),
      balance: ar
        .filter((r) => r.customerId === c.id)
        .reduce((s, r) => s + r.balance, 0),
    }))
  })

/** KH + điểm bán — dùng cho dropdown phiếu bán / phiếu thu */
export const listCustomerOptionsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const cs = await db
      .select({ id: customers.id, code: customers.code, name: customers.name })
      .from(customers)
      .orderBy(asc(customers.name))
    const bs = await db
      .select({
        id: posBranches.id,
        customerId: posBranches.customerId,
        code: posBranches.code,
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
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, data.id))
    if (!customer) throw new Error('Không tìm thấy khách hàng')
    const branches = await db
      .select()
      .from(posBranches)
      .where(eq(posBranches.customerId, data.id))
      .orderBy(asc(posBranches.name))
    const statement = await getCustomerStatement(data.id)
    const ar = (await getReceivablesSummary()).filter(
      (r) => r.customerId === data.id,
    )
    return { customer, branches, ...statement, receivables: ar }
  })

export const saveCustomerFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().optional(),
      code: z.string().trim().min(1, 'Nhập mã KH'),
      name: z.string().trim().min(1, 'Nhập tên KH'),
      taxCode: opt,
      address: opt,
      phone: opt,
      email: opt,
      contactPerson: opt,
      note: opt,
    }),
  )
  .handler(async ({ data: { id, ...v } }) => {
    try {
      if (id) {
        await db.update(customers).set(v).where(eq(customers.id, id))
        return { id }
      }
      const [r] = await db.insert(customers).values(v).$returningId()
      return { id: r.id }
    } catch (e) {
      if (isDuplicateError(e)) throw new Error('Mã khách hàng đã tồn tại')
      throw e
    }
  })

export const saveBranchFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().optional(),
      customerId: z.number(),
      code: z.string().trim().min(1, 'Nhập mã điểm bán'),
      name: z.string().trim().min(1, 'Nhập tên pháp nhân điểm bán'),
      taxCode: opt,
      address: opt,
      phone: opt,
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
