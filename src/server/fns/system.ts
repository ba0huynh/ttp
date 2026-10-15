import { createServerFn } from '@tanstack/react-start'
import { asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import {
  companyInfo,
  rolePermissions,
  roles,
  sessions,
  users,
} from '#/db/schema.ts'
import { ALL_PERMISSIONS } from '#/lib/permissions.ts'
import type { PermissionKey } from '#/lib/permissions.ts'
import { hashPassword } from '#/server/services/auth.ts'
import { isDuplicateError } from '#/server/services/common.ts'
import { authMiddleware, requirePermission } from './middleware.ts'

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
  .middleware([requirePermission('company.manage')])
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
  .middleware([requirePermission('users.manage')])
  .handler(async () =>
    db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        roleId: users.roleId,
        roleName: roles.name,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .orderBy(asc(users.id)),
  )

export const saveUserFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('users.manage')])
  .validator(
    z.object({
      id: z.number().int().optional(),
      username: z.string().trim().min(3),
      email: z.email(),
      fullName: z.string().trim().min(2),
      phone: z.string().trim().nullable(),
      roleId: z.number().int(),
      isActive: z.boolean(),
      password: z.string().min(8).optional().or(z.literal('')),
    }),
  )
  .handler(async ({ data, context }) => {
    const { id, password, ...rest } = data
    if (id) {
      if (id === context.user.id) {
        const [newRole] = await db
          .select({ isAdmin: roles.isAdmin })
          .from(roles)
          .where(eq(roles.id, rest.roleId))
        if (!rest.isActive || !newRole?.isAdmin)
          throw new Error(
            'Không thể tự hạ quyền hoặc khóa tài khoản của chính mình',
          )
      }
      await db
        .update(users)
        .set({
          ...rest,
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        })
        .where(eq(users.id, id))
      // A deactivated account, or one whose password an admin just reset, must
      // not keep working (or come back to life when re-activated) with an old
      // session. Its next request gets UNAUTHENTICATED and the client logs out.
      if (!rest.isActive || password)
        await db.delete(sessions).where(eq(sessions.userId, id))
    } else {
      if (!password) throw new Error('Nhập mật khẩu cho tài khoản mới')
      await db
        .insert(users)
        .values({ ...rest, passwordHash: await hashPassword(password) })
    }
    return { ok: true }
  })

/* ------------------------------ Roles & Permissions ------------------------------ */

/** Roles with their permission keys and how many users hold each */
export const listRolesFn = createServerFn({ method: 'GET' })
  .middleware([requirePermission('users.manage', 'roles.manage')])
  .handler(async () => {
    const [list, perms] = await Promise.all([
      db
        .select({
          id: roles.id,
          name: roles.name,
          description: roles.description,
          isAdmin: roles.isAdmin,
          userCount: sql<number>`(select count(*) from users u where u.role_id = roles.id)`,
        })
        .from(roles)
        .orderBy(asc(roles.id)),
      db.select().from(rolePermissions),
    ])
    return list.map((r) => ({
      ...r,
      userCount: Number(r.userCount),
      permissions: perms
        .filter((p) => p.roleId === r.id)
        .map((p) => p.permission),
    }))
  })

export const saveRoleFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('roles.manage')])
  .validator(
    z.object({
      id: z.number().int().optional(),
      name: z.string().trim().min(2, 'Nhập tên vai trò'),
      description: z.string().trim().nullable(),
      permissions: z.array(
        z.enum(ALL_PERMISSIONS as [PermissionKey, ...PermissionKey[]]),
      ),
    }),
  )
  .handler(async ({ data }) => {
    const { id, permissions, ...info } = data
    const keys = [...new Set(permissions)]
    try {
      await db.transaction(async (tx) => {
        let roleId = id
        if (roleId) {
          const [role] = await tx
            .select({ isAdmin: roles.isAdmin })
            .from(roles)
            .where(eq(roles.id, roleId))
          if (!role) throw new Error('Không tìm thấy vai trò')
          if (role.isAdmin)
            throw new Error(
              'Vai trò Quản trị luôn có toàn quyền, không thể sửa',
            )
          await tx.update(roles).set(info).where(eq(roles.id, roleId))
          await tx
            .delete(rolePermissions)
            .where(eq(rolePermissions.roleId, roleId))
        } else {
          const [created] = await tx.insert(roles).values(info).$returningId()
          roleId = created.id
        }
        if (keys.length > 0)
          await tx
            .insert(rolePermissions)
            .values(keys.map((permission) => ({ roleId, permission })))
      })
    } catch (e) {
      if (isDuplicateError(e)) throw new Error('Tên vai trò đã tồn tại')
      throw e
    }
    return { ok: true }
  })

export const deleteRoleFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('roles.manage')])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const [role] = await db
      .select({
        isAdmin: roles.isAdmin,
        userCount: sql<number>`(select count(*) from users u where u.role_id = roles.id)`,
      })
      .from(roles)
      .where(eq(roles.id, data.id))
    if (!role) throw new Error('Không tìm thấy vai trò')
    if (role.isAdmin) throw new Error('Không thể xóa vai trò Quản trị')
    if (Number(role.userCount) > 0)
      throw new Error('Vai trò đang được gán cho người dùng, không thể xóa')
    await db.delete(roles).where(eq(roles.id, data.id))
    return { ok: true }
  })
