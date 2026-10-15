import { db } from '../index.ts'
import { customers, posBranches } from '../schema.ts'

/**
 * Seeds B2B motorcycle wholesale customers and their affiliated showroom branches (POS).
 * Idempotent: skips the insert (customers + their branches, seeded together)
 * if `customers` already has rows.
 */
export async function seedCustomers() {
  const existingCustomers = await db.select().from(customers)
  if (existingCustomers.length > 0) {
    console.log(' -> Customers already seeded, skipping...')
    const existingBranches = await db.select().from(posBranches)
    // Customers have no business code, so look them up by name
    const custNamAnh = existingCustomers.find(
      (c) => c.name === 'CÔNG TY TNHH THƯƠNG MẠI XE MÁY NAM ANH',
    )!
    const custThanhDat = existingCustomers.find(
      (c) => c.name === 'DOANH NGHIỆP TƯ NHÂN XE MÁY THÀNH ĐẠT',
    )!

    return {
      customers: { custNamAnh, custThanhDat },
      branches: {
        branchNamAnhQ10: existingBranches.find(
          (b) => b.name === 'Showroom Nam Anh Quận 10',
        )!,
        branchNamAnhBD: existingBranches.find(
          (b) => b.name === 'Showroom Nam Anh Bình Dương',
        )!,
        branchThanhDatTD: existingBranches.find(
          (b) => b.name === 'Cửa hàng Thành Đạt Thủ Đức',
        )!,
      },
    }
  }

  console.log(' -> Seeding B2B corporate customers and POS branches...')
  const insertedCustomers = await db
    .insert(customers)
    .values([
      {
        name: 'CÔNG TY TNHH THƯƠNG MẠI XE MÁY NAM ANH',
      },
      {
        name: 'DOANH NGHIỆP TƯ NHÂN XE MÁY THÀNH ĐẠT',
      },
    ])
    .$returningId()

  const [custNamAnh, custThanhDat] = insertedCustomers

  const insertedBranches = await db
    .insert(posBranches)
    .values([
      {
        customerId: custNamAnh.id,
        name: 'Showroom Nam Anh Quận 10',
        contactPerson: 'Nguyễn Văn Tuấn',
        isActive: true,
      },
      {
        customerId: custNamAnh.id,
        name: 'Showroom Nam Anh Bình Dương',
        contactPerson: 'Phạm Thị Lan',
        isActive: true,
      },
      {
        customerId: custThanhDat.id,
        name: 'Cửa hàng Thành Đạt Thủ Đức',
        contactPerson: 'Trần Văn Đạt',
        isActive: true,
      },
    ])
    .$returningId()

  const [branchNamAnhQ10, branchNamAnhBD, branchThanhDatTD] = insertedBranches

  return {
    customers: { custNamAnh, custThanhDat },
    branches: { branchNamAnhQ10, branchNamAnhBD, branchThanhDatTD },
  }
}
