import { hashPassword } from '../../server/services/auth.ts'
import { db } from '../index.ts'
import { users } from '../schema.ts'
import { seedRoles } from './role.seed.ts'

/**
 * Seeds the default roles and the first administrator.
 * Credentials: admin / Admin@123 (change it after the first login).
 *
 * Idempotent: roles are created only when missing and the admin account is
 * created only when `users` is empty.
 */
export async function seedUsers() {
  const roleIds = await seedRoles()
  const adminRoleId = roleIds.get('Quản trị')
  if (!adminRoleId) throw new Error('Role "Quản trị" not found')

  const existingUsers = await db.select().from(users)
  if (existingUsers.length > 0) {
    console.log(' -> Users already seeded, skipping...')
    return
  }

  console.log(' -> Seeding the administrator account...')
  await db.insert(users).values({
    username: 'admin',
    email: 'admin@truongthinhphat.vn',
    passwordHash: await hashPassword('Admin@123'),
    fullName: 'Quản trị viên Hệ thống',
    phone: null,
    roleId: adminRoleId,
    isActive: true,
  })
}
