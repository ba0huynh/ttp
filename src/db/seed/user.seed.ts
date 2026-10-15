import { hashPassword } from '../../server/services/auth.ts'
import { db } from '../index.ts'
import { users } from '../schema.ts'
import { seedRoles } from './role.seed.ts'

/**
 * Seeds internal user accounts with hashed credentials.
 * Credentials:
 * - Admin:      admin      / Admin@123
 * - Accountant: ketoan     / Ktp@12345
 * - Sales:      kinhdoanh  / Sale@12345
 * - Warehouse:  kho        / Kho@12345
 *
 * Idempotent: skips the insert if `users` already has rows.
 */
export async function seedUsers() {
  const roleIds = await seedRoles()
  const roleId = (name: string) => {
    const id = roleIds.get(name)
    if (!id) throw new Error(`Role "${name}" not found`)
    return id
  }
  const existingUsers = await db.select().from(users)
  if (existingUsers.length > 0) {
    console.log(' -> Users already seeded, skipping...')
    const admin =
      existingUsers.find((u) => u.username === 'admin') ?? existingUsers[0]
    return { adminId: admin.id }
  }

  console.log(' -> Seeding internal user accounts...')
  const insertedUsers = await db
    .insert(users)
    .values([
      {
        username: 'admin',
        email: 'admin@truongthinhphat.vn',
        passwordHash: await hashPassword('Admin@123'),
        fullName: 'Quản trị viên Hệ thống',
        phone: '0901 888 999',
        roleId: roleId('Quản trị'),
        isActive: true,
      },
      {
        username: 'ketoan',
        email: 'ketoan@truongthinhphat.vn',
        passwordHash: await hashPassword('Ktp@12345'),
        fullName: 'Trần Thị Thu Thảo (Kế toán)',
        phone: '0902 123 456',
        roleId: roleId('Kế toán'),
        isActive: true,
      },
      {
        username: 'kinhdoanh',
        email: 'kinhdoanh@truongthinhphat.vn',
        passwordHash: await hashPassword('Sale@12345'),
        fullName: 'Nguyễn Văn Hùng (Kinh doanh)',
        phone: '0903 654 321',
        roleId: roleId('Kinh doanh'),
        isActive: true,
      },
      {
        username: 'kho',
        email: 'kho@truongthinhphat.vn',
        passwordHash: await hashPassword('Kho@12345'),
        fullName: 'Lê Hoàng Nam (Thủ kho)',
        phone: '0904 999 888',
        roleId: roleId('Thủ kho'),
        isActive: true,
      },
    ])
    .$returningId()

  const adminId = insertedUsers[0].id
  return { adminId }
}
