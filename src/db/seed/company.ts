import { db } from '../index.ts'
import { companyInfo } from '../schema.ts'

/**
 * Seeds company corporate profile.
 */
export async function seedCompany() {
  console.log(' -> Seeding company profile...')
  const [created] = await db
    .insert(companyInfo)
    .values({
      name: 'CÔNG TY TNHH KINH DOANH DỊCH VỤ TRƯỜNG THỊNH PHÁT',
      taxCode: '0316513248',
      address: '229 Lê Văn Sỹ, Phường 13, Quận 3, TP. Hồ Chí Minh',
      phone: '028 3991 6688',
      email: 'contact@truongthinhphat-motor.vn',
      representative: 'Huỳnh Văn Thịnh',
      website: 'https://truongthinhphat-motor.vn',
    })
    .$returningId()

  return created
}
