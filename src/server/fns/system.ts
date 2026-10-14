import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { USER_ROLES, companyInfo, users } from '#/db/schema.ts'
import { hashPassword } from '#/server/services/auth.ts'
import { adminMiddleware, authMiddleware } from './middleware.ts'

/* ------------------------------ Company Profile ------------------------------ */

export const getCompanyProfileFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const [row] = await db.select().from(companyInfo).limit(1)
    return row ?? null
  })

const companySchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên công ty'),
  taxCode: z.string().trim().min(1, 'Nhập mã số thuế'),
  address: z.string().trim().min(1, 'Nhập địa chỉ'),
  phone: z.string().trim().nullable(),
  email: z.string().trim().nullable(),
  representative: z.string().trim().nullable(),
  website: z.string().trim().nullable(),
})

export const updateCompanyProfileFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(companySchema)
  .handler(async ({ data }) => {
    const [row] = await db
      .select({ id: companyInfo.id })
      .from(companyInfo)
      .limit(1)
    if (row)
      await db.update(companyInfo).set(data).where(eq(companyInfo.id, row.id))
    else await db.insert(companyInfo).values(data)
    return { ok: true }
  })

/* ----------------------------------- Users ---------------------------------- */

export const listUsersFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async () =>
    db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.id)),
  )

export const saveUserFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      id: z.number().int().optional(),
      username: z.string().trim().min(3),
      email: z.email(),
      fullName: z.string().trim().min(2),
      phone: z.string().trim().nullable(),
      role: z.enum(USER_ROLES),
      isActive: z.boolean(),
      password: z.string().min(8).optional().or(z.literal('')),
    }),
  )
  .handler(async ({ data, context }) => {
    const { id, password, ...rest } = data
    if (id) {
      if (id === context.user.id && (!rest.isActive || rest.role !== 'admin'))
        throw new Error(
          'Không thể tự hạ quyền hoặc khóa tài khoản của chính mình',
        )
      await db
        .update(users)
        .set({
          ...rest,
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        })
        .where(eq(users.id, id))
    } else {
      if (!password) throw new Error('Nhập mật khẩu cho tài khoản mới')
      await db
        .insert(users)
        .values({ ...rest, passwordHash: await hashPassword(password) })
    }
    return { ok: true }
  })
