import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import {
  banks,
  colors,
  companyBankAccounts,
  expenseTypes,
  motorcycleModels,
  suppliers,
} from '#/db/schema.ts'
import {
  isDuplicateError,
  isReferencedError,
  isTooLongError,
} from '#/server/services/common.ts'
import { deleteImage, isUploadKey } from '#/server/services/uploads.ts'
import { authMiddleware, requirePermission } from './middleware.ts'

const opt = z.string().trim().nullable().optional()

// https address or a key path made by the upload route
const imageField = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v) || isUploadKey(v), 'Ảnh không hợp lệ')
  .nullable()
  .optional()

const wrapDup = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn()
  } catch (e) {
    if (isDuplicateError(e)) throw new Error('Dữ liệu này đã tồn tại')
    if (isTooLongError(e))
      throw new Error('Nội dung nhập quá dài, vui lòng rút gọn lại')
    if (isReferencedError(e))
      throw new Error(
        'Không thể xóa vì đang được sử dụng ở lô nhập, phiếu bán hoặc chứng từ khác',
      )
    throw e
  }
}

/** All master catalog data — used for UI dropdowns */
export const getMasterDataFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const [b, a, s, m, c, x] = await Promise.all([
      db.select().from(banks).orderBy(desc(banks.id)),
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
          bankCode: banks.code,
          bankShortName: banks.shortName,
        })
        .from(companyBankAccounts)
        .innerJoin(banks, eq(banks.id, companyBankAccounts.bankId))
        .orderBy(desc(companyBankAccounts.id)),
      db.select().from(suppliers).orderBy(desc(suppliers.id)),
      db.select().from(motorcycleModels).orderBy(desc(motorcycleModels.id)),
      db.select().from(colors).orderBy(desc(colors.id)),
      db.select().from(expenseTypes).orderBy(desc(expenseTypes.id)),
    ])
    return {
      banks: b,
      bankAccounts: a,
      suppliers: s,
      models: m,
      colors: c,
      expenseTypes: x,
    }
  })

/* ----------------------------------- Banks ---------------------------------- */
export const saveBankFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('master-data.manage')])
  .validator(
    z.object({
      id: z.number().optional(),
      name: z.string().trim().min(1, 'Tên ngân hàng không được để trống hoặc chỉ chứa khoảng trắng'),
      image: imageField,
    }),
  )
  .handler(({ data: { id, ...v } }) =>
    wrapDup(async () => {
      const trimmedName = v.name.trim().replace(/\s+/g, ' ').normalize('NFC')
      const [existing] = await db
        .select({ id: banks.id })
        .from(banks)
        .where(
          and(
            sql`lower(trim(${banks.name})) = ${trimmedName.toLowerCase()}`,
            id ? ne(banks.id, id) : undefined,
          ),
        )
        .limit(1)

      if (existing) {
        throw new Error(`Ngân hàng "${trimmedName}" đã tồn tại trong hệ thống`)
      }

      if (id) {
        const [old] = await db
          .select({ image: banks.image })
          .from(banks)
          .where(eq(banks.id, id))
        await db.update(banks).set({ ...v, name: trimmedName }).where(eq(banks.id, id))
        // A replaced or removed logo no longer needs its file
        if (old?.image && old.image !== (v.image ?? null))
          await deleteImage(old.image)
      } else await db.insert(banks).values({ ...v, name: trimmedName })
      return { ok: true }
    }),
  )

/* --------------------------- Company Bank Accounts --------------------------- */
export const saveBankAccountFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('master-data.manage')])
  .validator(
    z.object({
      id: z.number().optional(),
      bankId: z.number(),
      // Same limits as the columns (50 / 255 / 150)
      accountNumber: z
        .string()
        .trim()
        .min(1, 'Số tài khoản không được để trống hoặc chỉ chứa khoảng trắng')
        .max(50, 'Số tài khoản tối đa 50 ký tự')
        .regex(/^\d+$/, 'Số tài khoản chỉ được chứa các chữ số'),
      accountName: z
        .string()
        .trim()
        .min(1, 'Tên tài khoản không được để trống hoặc chỉ chứa khoảng trắng')
        .max(255, 'Tên tài khoản tối đa 255 ký tự'),
      branch: z.string().trim().max(150, 'Chi nhánh tối đa 150 ký tự').nullable().optional(),
      isActive: z.boolean(),
    }),
  )
  .handler(({ data: { id, ...v } }) =>
    wrapDup(async () => {
      const cleanNumber = v.accountNumber.trim()
      const cleanName = v.accountName.trim().replace(/\s+/g, ' ').normalize('NFC')
      const [existing] = await db
        .select({ id: companyBankAccounts.id })
        .from(companyBankAccounts)
        .where(
          and(
            eq(companyBankAccounts.accountNumber, cleanNumber),
            eq(companyBankAccounts.bankId, v.bankId),
            id ? ne(companyBankAccounts.id, id) : undefined,
          ),
        )
        .limit(1)

      if (existing) {
        throw new Error(
          `Số tài khoản "${cleanNumber}" đã tồn tại cho ngân hàng này`,
        )
      }

      if (id) {
        await db
          .update(companyBankAccounts)
          .set({ ...v, accountNumber: cleanNumber, accountName: cleanName })
          .where(eq(companyBankAccounts.id, id))
        return { ok: true, id }
      }
      const [res] = await db.insert(companyBankAccounts).values({
        ...v,
        accountNumber: cleanNumber,
        accountName: cleanName,
      })
      return { ok: true, id: Number(res.insertId) }
    }),
  )

/* --------------------------------- Suppliers --------------------------------- */
export const saveSupplierFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('master-data.manage')])
  .validator(
    z.object({
      id: z.number().optional(),
      // Same limits as the columns (255 / 255)
      name: z
        .string()
        .trim()
        .min(1, 'Tên nhà cung cấp không được để trống hoặc chỉ chứa khoảng trắng')
        .max(255, 'Tên nhà cung cấp tối đa 255 ký tự'),
      taxCode: opt,
      email: opt,
      note: opt,
      image: imageField,
    }),
  )
  .handler(({ data: { id, ...v } }) =>
    wrapDup(async () => {
      const trimmedName = v.name.trim().replace(/\s+/g, ' ').normalize('NFC')
      if (id) {
        const [old] = await db
          .select({ image: suppliers.image })
          .from(suppliers)
          .where(eq(suppliers.id, id))
        await db
          .update(suppliers)
          .set({ ...v, name: trimmedName })
          .where(eq(suppliers.id, id))
        // A replaced or removed logo no longer needs its file
        if (old?.image && old.image !== (v.image ?? null))
          await deleteImage(old.image)
        return { ok: true, id }
      }
      const [res] = await db.insert(suppliers).values({ ...v, name: trimmedName })
      return { ok: true, id: Number(res.insertId) }
    }),
  )

/* ----------------------------- Motorcycle Models ----------------------------- */
export const saveModelFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('master-data.manage')])
  .validator(
    z.object({
      id: z.number().optional(),
      brand: opt,
      name: z.string().trim().min(1, 'Tên dòng xe không được để trống hoặc chỉ chứa khoảng trắng'),
      description: opt,
    }),
  )
  .handler(({ data: { id, ...v } }) =>
    wrapDup(async () => {
      const trimmedName = v.name.trim().replace(/\s+/g, ' ').normalize('NFC')
      const [existing] = await db
        .select({ id: motorcycleModels.id })
        .from(motorcycleModels)
        .where(
          and(
            sql`lower(trim(${motorcycleModels.name})) = ${trimmedName.toLowerCase()}`,
            id ? ne(motorcycleModels.id, id) : undefined,
          ),
        )
        .limit(1)

      if (existing) {
        throw new Error(`Dòng xe "${trimmedName}" đã tồn tại trong hệ thống`)
      }

      if (id) {
        await db
          .update(motorcycleModels)
          .set({ ...v, name: trimmedName })
          .where(eq(motorcycleModels.id, id))
        return { ok: true, id }
      }
      const [res] = await db
        .insert(motorcycleModels)
        .values({ ...v, name: trimmedName })
      return { ok: true, id: Number(res.insertId) }
    }),
  )

/* ----------------------------------- Colors ---------------------------------- */
export const saveColorFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('master-data.manage')])
  .validator(
    z.object({
      id: z.number().optional(),
      name: z.string().trim().min(1, 'Tên màu sắc không được để trống hoặc chỉ chứa khoảng trắng'),
      hex: opt,
    }),
  )
  .handler(({ data: { id, ...v } }) =>
    wrapDup(async () => {
      const trimmedName = v.name.trim().replace(/\s+/g, ' ').normalize('NFC')
      const [existing] = await db
        .select({ id: colors.id })
        .from(colors)
        .where(
          and(
            sql`lower(trim(${colors.name})) = ${trimmedName.toLowerCase()}`,
            id ? ne(colors.id, id) : undefined,
          ),
        )
        .limit(1)

      if (existing) {
        throw new Error(`Màu sắc "${trimmedName}" đã tồn tại trong hệ thống`)
      }

      if (id) {
        await db.update(colors).set({ ...v, name: trimmedName }).where(eq(colors.id, id))
        return { ok: true, id }
      }
      const [res] = await db.insert(colors).values({ ...v, name: trimmedName })
      return { ok: true, id: Number(res.insertId) }
    }),
  )

/* ------------------------------- Expense Types ------------------------------- */
export const saveExpenseTypeFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('master-data.manage')])
  .validator(
    z.object({
      id: z.number().optional(),
      name: z.string().trim().min(1, 'Tên loại chi phí không được để trống hoặc chỉ chứa khoảng trắng'),
    }),
  )
  .handler(({ data: { id, ...v } }) =>
    wrapDup(async () => {
      const trimmedName = v.name.trim().replace(/\s+/g, ' ').normalize('NFC')
      const [existing] = await db
        .select({ id: expenseTypes.id })
        .from(expenseTypes)
        .where(
          and(
            sql`lower(trim(${expenseTypes.name})) = ${trimmedName.toLowerCase()}`,
            id ? ne(expenseTypes.id, id) : undefined,
          ),
        )
        .limit(1)

      if (existing) {
        throw new Error(`Loại chi phí "${trimmedName}" đã tồn tại trong hệ thống`)
      }

      if (id) {
        await db.update(expenseTypes).set({ ...v, name: trimmedName }).where(eq(expenseTypes.id, id))
        return { ok: true, id }
      }
      const [res] = await db.insert(expenseTypes).values({ ...v, name: trimmedName })
      return { ok: true, id: Number(res.insertId) }
    }),
  )

/* ----------------------------------- Delete ---------------------------------- */
const deletable = {
  banks,
  companyBankAccounts,
  suppliers,
  motorcycleModels,
  colors,
  expenseTypes,
}

export const deleteMasterDataFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('master-data.manage')])
  .validator(
    z.object({
      entity: z.enum([
        'banks',
        'companyBankAccounts',
        'suppliers',
        'motorcycleModels',
        'colors',
        'expenseTypes',
      ]),
      id: z.number(),
    }),
  )
  .handler(({ data }) =>
    wrapDup(async () => {
      const t = deletable[data.entity]
      // A deleted bank or supplier takes its uploaded logo with it
      const [owner] =
        data.entity === 'banks'
          ? await db
              .select({ image: banks.image })
              .from(banks)
              .where(eq(banks.id, data.id))
          : data.entity === 'suppliers'
            ? await db
                .select({ image: suppliers.image })
                .from(suppliers)
                .where(eq(suppliers.id, data.id))
            : []
      await db.delete(t).where(eq(t.id, data.id))
      await deleteImage(owner?.image)
      return { ok: true }
    }),
  )
