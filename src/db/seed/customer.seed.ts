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
          (b) => b.code === 'DB-NAMANH-Q10',
        )!,
        branchNamAnhBD: existingBranches.find(
          (b) => b.code === 'DB-NAMANH-BD',
        )!,
        branchThanhDatTD: existingBranches.find(
          (b) => b.code === 'DB-THANHDAT-TD',
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
        address: '568 Cách Mạng Tháng 8, Phường 11, Quận 3, TP.HCM',
      },
      {
        name: 'DOANH NGHIỆP TƯ NHÂN XE MÁY THÀNH ĐẠT',
        address: '102 Võ Văn Ngân, TP. Thủ Đức, TP.HCM',
      },
    ])
    .$returningId()

  const [custNamAnh, custThanhDat] = insertedCustomers

  const insertedBranches = await db
    .insert(posBranches)
    .values([
      {
        customerId: custNamAnh.id,
        code: 'DB-NAMANH-Q10',
        name: 'Showroom Nam Anh Quận 10',
        taxCode: '0315891234-001',
        address: '280 Ba Tháng Hai, Phường 12, Quận 10, TP.HCM',
        phone: '0908 111 223',
        contactPerson: 'Nguyễn Văn Tuấn',
        isActive: true,
      },
      {
        customerId: custNamAnh.id,
        code: 'DB-NAMANH-BD',
        name: 'Showroom Nam Anh Bình Dương',
        taxCode: '0315891234-002',
        address: '45 Đại Lộ Bình Dương, TP. Thủ Dầu Một, Bình Dương',
        phone: '0908 111 224',
        contactPerson: 'Phạm Thị Lan',
        isActive: true,
      },
      {
        customerId: custThanhDat.id,
        code: 'DB-THANHDAT-TD',
        name: 'Cửa hàng Thành Đạt Thủ Đức',
        taxCode: '0314789654-001',
        address: '102 Võ Văn Ngân, TP. Thủ Đức, TP.HCM',
        phone: '0903 333 445',
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
