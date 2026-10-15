import { createServerFn } from '@tanstack/react-start'
import { asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { customers, posBranches } from '#/db/schema.ts'
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
        name: customers.name,
        branchCount: sql<number>`(select count(*) from ${posBranches} b where b.customer_id = ${customers.id})`,
      })
      .from(customers)
      .orderBy(asc(customers.name))
    return list.map((c) => ({ ...c, branchCount: Number(c.branchCount) }))
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
    // Independent queries run together: each one is a network round trip
    const [[customer], branches, statement, summary] = await Promise.all([
      db.select().from(customers).where(eq(customers.id, data.id)),
      db
        .select()
        .from(posBranches)
        .where(eq(posBranches.customerId, data.id))
        .orderBy(asc(posBranches.name)),
      getCustomerStatement(data.id),
      getReceivablesSummary(),
    ])
    if (!customer) throw new Error('Không tìm thấy khách hàng')
    const ar = summary.filter((r) => r.customerId === data.id)
    return { customer, branches, ...statement, receivables: ar }
  })

export const saveCustomerFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
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
