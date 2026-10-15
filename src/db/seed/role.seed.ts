import { eq } from 'drizzle-orm'

import { DEFAULT_ROLES } from '../../lib/permissions.ts'
import { db } from '../index.ts'
import { rolePermissions, roles } from '../schema.ts'

/**
 * Seeds the default roles (Quản trị / Kế toán / Kinh doanh / Thủ kho) with
 * their permissions and returns a `name -> id` map. Idempotent: a role that
 * already exists (for instance created by the migration) is left untouched.
 */
export async function seedRoles() {
  const existing = await db.select().from(roles)
  const ids = new Map(existing.map((r) => [r.name, r.id]))

  for (const def of DEFAULT_ROLES) {
    if (ids.has(def.name)) continue
    console.log(` -> Seeding role "${def.name}"...`)
    const [created] = await db
      .insert(roles)
      .values({
        name: def.name,
        description: def.description,
        isAdmin: def.isAdmin,
      })
      .$returningId()
    ids.set(def.name, created.id)
    if (def.permissions.length > 0)
      await db.insert(rolePermissions).values(
        def.permissions.map((permission) => ({
          roleId: created.id,
          permission,
        })),
      )
  }
  return ids
}

export async function roleIdByName(name: string) {
  const [row] = await db.select().from(roles).where(eq(roles.name, name))
  if (!row) throw new Error(`Role "${name}" not found`)
  return row.id
}
