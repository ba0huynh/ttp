import { hashPassword } from '../../server/services/auth.ts'
import { db } from '../index.ts'
import { users } from '../schema.ts'

/**
 * Seeds internal user accounts with hashed credentials.
 * Credentials:
 * - Admin:      admin      / Admin@123
 * - Accountant: ketoan     / Ktp@12345
 * - Sales:      kinhdoanh  / Sale@12345
 * - Warehouse:  kho        / Kho@12345
 */
export async function seedUsers() {
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
        role: 'admin',
        isActive: true,
      },
      {
        username: 'ketoan',
        email: 'ketoan@truongthinhphat.vn',
        passwordHash: await hashPassword('Ktp@12345'),
        fullName: 'Trần Thị Thu Thảo (Kế toán)',
        phone: '0902 123 456',
        role: 'accountant',
        isActive: true,
      },
      {
        username: 'kinhdoanh',
        email: 'kinhdoanh@truongthinhphat.vn',
        passwordHash: await hashPassword('Sale@12345'),
        fullName: 'Nguyễn Văn Hùng (Kinh doanh)',
        phone: '0903 654 321',
        role: 'sales',
        isActive: true,
      },
      {
        username: 'kho',
        email: 'kho@truongthinhphat.vn',
        passwordHash: await hashPassword('Kho@12345'),
        fullName: 'Lê Hoàng Nam (Thủ kho)',
        phone: '0904 999 888',
        role: 'warehouse',
        isActive: true,
      },
    ])
    .$returningId()

  const adminId = insertedUsers[0].id
  return { adminId, users: insertedUsers }
}
