import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import {
  banks,
  colors,
  companyBankAccounts,
  motorcycleModels,
  suppliers,
} from '#/db/schema.ts'
import { isDuplicateError } from '#/server/services/common.ts'
import { authMiddleware } from './middleware.ts'

const opt = z.string().trim().nullable().optional()

const wrapDup = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn()
  } catch (e) {
    if (isDuplicateError(e)) throw new Error('Mã/số hiệu đã tồn tại')
    const msg = String((e as Error).message ?? '')
    if (msg.includes('foreign key') || msg.includes('ER_ROW_IS_REFERENCED'))
      throw new Error('Không thể xóa vì đang được sử dụng ở chứng từ khác')
    throw e
  }
}

/** All master catalog data — used for UI dropdowns */
export const getMasterDataFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const [b, a, s, m, c] = await Promise.all([
      db.select().from(banks).orderBy(asc(banks.name)),
      db
        .select({
          id: companyBankAccounts.id,
          bankId: companyBankAccounts.bankId,
          accountNumber: companyBankAccounts.accountNumber,
          accountName: companyBankAccounts.accountName,
          branch: companyBankAccounts.branch,
          isActive: companyBankAccounts.isActive,
          bankName: banks.name,
          bankImage: banks.image,
        })
        .from(companyBankAccounts)
        .innerJoin(banks, eq(banks.id, companyBankAccounts.bankId))
        .orderBy(asc(banks.name)),
      db.select().from(suppliers).orderBy(asc(suppliers.name)),
      db.select().from(motorcycleModels).orderBy(asc(motorcycleModels.name)),
      db.select().from(colors).orderBy(asc(colors.name)),
    ])
    return { banks: b, bankAccounts: a, suppliers: s, models: m, colors: c }
  })

/* ----------------------------------- Banks ---------------------------------- */
export const saveBankFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().optional(),
      name: z.string().trim().min(1),
    }),
  )
  .handler(({ data: { id, ...v } }) =>
    wrapDup(async () => {
      if (id) await db.update(banks).set(v).where(eq(banks.id, id))
      else await db.insert(banks).values(v)
      return { ok: true }
    }),
  )

/* --------------------------- Company Bank Accounts --------------------------- */
export const saveBankAccountFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().optional(),
      bankId: z.number(),
      accountNumber: z.string().trim().min(1),
      accountName: z.string().trim().min(1),
      branch: opt,
      isActive: z.boolean(),
    }),
  )
  .handler(({ data: { id, ...v } }) =>
    wrapDup(async () => {
      if (id)
        await db
          .update(companyBankAccounts)
          .set(v)
          .where(eq(companyBankAccounts.id, id))
      else await db.insert(companyBankAccounts).values(v)
      return { ok: true }
    }),
  )

/* --------------------------------- Suppliers --------------------------------- */
export const saveSupplierFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().optional(),
      name: z.string().trim().min(1),
      taxCode: opt,
      address: opt,
      email: opt,
      note: opt,
    }),
  )
  .handler(({ data: { id, ...v } }) =>
    wrapDup(async () => {
      if (id) await db.update(suppliers).set(v).where(eq(suppliers.id, id))
      else await db.insert(suppliers).values(v)
      return { ok: true }
    }),
  )

/* ----------------------------- Motorcycle Models ----------------------------- */
export const saveModelFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().optional(),
      name: z.string().trim().min(1),
      description: opt,
    }),
  )
  .handler(({ data: { id, ...v } }) =>
    wrapDup(async () => {
      if (id)
        await db
          .update(motorcycleModels)
          .set(v)
          .where(eq(motorcycleModels.id, id))
      else await db.insert(motorcycleModels).values(v)
      return { ok: true }
    }),
  )

/* ----------------------------------- Colors ---------------------------------- */
export const saveColorFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().optional(),
      name: z.string().trim().min(1),
      hex: opt,
    }),
  )
  .handler(({ data: { id, ...v } }) =>
    wrapDup(async () => {
      if (id) await db.update(colors).set(v).where(eq(colors.id, id))
      else await db.insert(colors).values(v)
      return { ok: true }
    }),
  )

/* ----------------------------------- Delete ---------------------------------- */
const deletable = {
  banks,
  companyBankAccounts,
  suppliers,
  motorcycleModels,
  colors,
}

export const deleteMasterDataFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      entity: z.enum([
        'banks',
        'companyBankAccounts',
        'suppliers',
        'motorcycleModels',
        'colors',
      ]),
      id: z.number(),
    }),
  )
  .handler(({ data }) =>
    wrapDup(async () => {
      const t = deletable[data.entity]
      await db.delete(t).where(eq(t.id, data.id))
      return { ok: true }
    }),
  )
