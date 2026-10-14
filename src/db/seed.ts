import { config } from 'dotenv'
import { eq } from 'drizzle-orm'

import { allocateBatchExpenses, computeSellingPrice } from '../lib/business.ts'
import { hashPassword } from '../server/services/auth.ts'
import { db } from './index.ts'
import {
  bankStatementLines,
  bankStatements,
  banks,
  batchExpenses,
  colors,
  companyBankAccounts,
  companyInfo,
  customers,
  deliveryNoteItems,
  deliveryNotes,
  importBatches,
  invoiceItems,
  invoices,
  loanContracts,
  loanRepayments,
  motorcycleModels,
  paymentVouchers,
  posBranches,
  receiptVouchers,
  salesOrderItems,
  salesOrders,
  suppliers,
  users,
  vehicles,
} from './schema.ts'

config({ path: ['.env.local', '.env'] })

export async function seed() {
  console.log('🌱 Bắt đầu khởi tạo dữ liệu mẫu cho Trường Thịnh Phát...')

  // 1. Thông tin công ty
  console.log(' -> Tạo thông tin công ty...')
  await db.delete(companyInfo)
  await db.insert(companyInfo).values({
    name: 'CÔNG TY TNHH KINH DOANH DỊCH VỤ TRƯỜNG THỊNH PHÁT',
    taxCode: '0316513248',
    address: '229 Lê Văn Sỹ, Phường 13, Quận 3, TP. Hồ Chí Minh',
    phone: '028 3991 6688',
    email: 'contact@truongthinhphat-motor.vn',
    representative: 'Huỳnh Văn Thịnh',
    website: 'https://truongthinhphat-motor.vn',
  })

  // 2. Tài khoản người dùng (mật khẩu mặc định: Admin@123 / Ktp@12345 / Sale@12345 / Kho@12345)
  console.log(' -> Tạo tài khoản người dùng...')
  await db.delete(users)
  const [adminUser] = await db
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

  const adminId = adminUser.id

  // 3. Danh mục ngân hàng & tài khoản công ty
  console.log(' -> Tạo danh mục ngân hàng...')
  await db.delete(banks)
  const [vcb, bidv] = await db
    .insert(banks)
    .values([
      {
        code: 'VCB',
        name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
        shortName: 'Vietcombank',
      },
      {
        code: 'BIDV',
        name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
        shortName: 'BIDV',
      },
      {
        code: 'TCB',
        name: 'Ngân hàng TMCP Kỹ thương Việt Nam',
        shortName: 'Techcombank',
      },
    ])
    .$returningId()

  await db.delete(companyBankAccounts)
  const [vcbAccount, bidvAccount] = await db
    .insert(companyBankAccounts)
    .values([
      {
        bankId: vcb.id,
        accountNumber: '0071001234567',
        accountName: 'CONG TY TNHH KD DV TRUONG THINH PHAT',
        branch: 'Chi nhánh TP.HCM',
        isActive: true,
      },
      {
        bankId: bidv.id,
        accountNumber: '13510009876543',
        accountName: 'CONG TY TNHH KD DV TRUONG THINH PHAT',
        branch: 'Chi nhánh Nam Kỳ Khởi Nghĩa',
        isActive: true,
      },
    ])
    .$returningId()

  // 4. Danh mục Nhà cung cấp
  console.log(' -> Tạo danh mục nhà cung cấp...')
  await db.delete(suppliers)
  const [supplierThai, supplierIndo] = await db
    .insert(suppliers)
    .values([
      {
        code: 'THAI-HONDA',
        name: 'Thai Honda Manufacturing Co., Ltd',
        country: 'Thái Lan',
        taxCode: 'TH0105508001234',
        address: '410 Lat Krabang Industrial Estate, Bangkok, Thailand',
        contactPerson: 'Mr. Somchai',
        phone: '+66 2 326 0641',
      },
      {
        code: 'ASTRA-HONDA',
        name: 'PT Astra Honda Motor',
        country: 'Indonesia',
        taxCode: 'ID010002345678000',
        address: 'Jl. Laksda Yos Sudarso, Sunter 1, Jakarta, Indonesia',
        contactPerson: 'Bambang Sugiharto',
        phone: '+62 21 651 8080',
      },
    ])
    .$returningId()

  // 5. Danh mục dòng xe & màu sắc
  console.log(' -> Tạo dòng xe & màu sắc...')
  await db.delete(motorcycleModels)
  const [modelSh, modelWave, modelVario, modelScoopy] = await db
    .insert(motorcycleModels)
    .values([
      {
        code: 'SH150-ABS',
        name: 'Honda SH 150i ABS',
        brand: 'Honda',
        engineCapacity: 150,
        description: 'Dòng xe tay ga cao cấp nhập khẩu nguyên chiếc',
      },
      {
        code: 'WAVE-125I',
        name: 'Honda Wave 125i Thái',
        brand: 'Honda',
        engineCapacity: 125,
        description: 'Dòng xe số bền bỉ, tiết kiệm xăng nhập khẩu Thái Lan',
      },
      {
        code: 'VARIO-160',
        name: 'Honda Vario 160 CBS',
        brand: 'Honda',
        engineCapacity: 160,
        description: 'Dòng xe tay ga thể thao nhập khẩu Indonesia',
      },
      {
        code: 'SCOOPY-110',
        name: 'Honda Scoopy Club12',
        brand: 'Honda',
        engineCapacity: 110,
        description: 'Dòng xe tay ga thời trang cổ điển phong cách trẻ',
      },
    ])
    .$returningId()

  await db.delete(colors)
  const [cRed, cWhite, cBlack, cGrey] = await db
    .insert(colors)
    .values([
      { code: 'RED', name: 'Đỏ Đô', hex: '#990000' },
      { code: 'WHT', name: 'Trắng Ngọc Trai', hex: '#f8fafc' },
      { code: 'BLK', name: 'Đen Mờ (Matte Black)', hex: '#18181b' },
      { code: 'GRY', name: 'Xám Xi Măng', hex: '#64748b' },
    ])
    .$returningId()

  // 6. Khách hàng & Điểm bán trực thuộc
  console.log(' -> Tạo khách hàng mẹ & điểm bán trực thuộc...')
  await db.delete(customers)
  const [custNamAnh, custThanhDat] = await db
    .insert(customers)
    .values([
      {
        code: 'KH-NAMANH',
        name: 'CÔNG TY TNHH THƯƠNG MẠI XE MÁY NAM ANH',
        taxCode: '0315891234',
        address: '568 Cách Mạng Tháng 8, Phường 11, Quận 3, TP.HCM',
        phone: '0908 111 222',
        contactPerson: 'Ông Nam (Giám đốc)',
      },
      {
        code: 'KH-THANHDAT',
        name: 'DOANH NGHIỆP TƯ NHÂN XE MÁY THÀNH ĐẠT',
        taxCode: '0314789654',
        address: '102 Võ Văn Ngân, TP. Thủ Đức, TP.HCM',
        phone: '0903 333 444',
        contactPerson: 'Bà Đạt',
      },
    ])
    .$returningId()

  await db.delete(posBranches)
  const [branchNamAnhQ10, branchNamAnhBD, branchThanhDatTD] = await db
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

  // 7. Khế ước vay ngân hàng
  console.log(' -> Tạo khế ước vay ngân hàng...')
  await db.delete(loanContracts)
  const [loanVcb, loanBidv] = await db
    .insert(loanContracts)
    .values([
      {
        contractNumber: 'KU-2026-VCB-01',
        bankId: vcb.id,
        principalAmount: 2_000_000_000,
        interestRate: 8.5,
        disbursementDate: '2026-01-10',
        maturityDate: '2026-07-10',
        status: 'active',
        note: 'Vay tài trợ nhập khẩu lô xe Honda Thái Lan',
      },
      {
        contractNumber: 'KU-2026-BIDV-02',
        bankId: bidv.id,
        principalAmount: 1_500_000_000,
        interestRate: 8.8,
        disbursementDate: '2026-02-15',
        maturityDate: '2026-08-15',
        status: 'active',
        note: 'Vay tài trợ nhập khẩu lô xe Honda Indonesia',
      },
    ])
    .$returningId()

  // Khoản trả nợ gốc/lãi cho VCB
  await db.delete(loanRepayments)
  await db.insert(loanRepayments).values({
    loanContractId: loanVcb.id,
    paymentDate: '2026-02-25',
    principalAmount: 500_000_000,
    interestAmount: 21_438_356, // Lãi 46 ngày của 2 tỷ @ 8.5%
    companyBankAccountId: vcbAccount.id,
    note: 'Trả gốc đợt 1 và thanh toán lãi kỳ 1',
  })

  // 8. Nhập lô xe 1 (Thái Lan) & Phân bổ chi phí tự động
  console.log(' -> Tạo Lô nhập 1 (Thái Lan) & phân bổ giá vốn...')
  await db.delete(importBatches)
  const [batch1] = await db
    .insert(importBatches)
    .values({
      batchCode: 'LO-2026-01-THAI',
      supplierId: supplierThai.id,
      loanContractId: loanVcb.id,
      importDate: '2026-01-15',
      customsDeclarationNo: 'HQ-1002938475',
      pricingBase: 'cost_price',
      pricingMethod: 'percent',
      pricingValue: 8, // Lãi 8% trên giá vốn
      note: 'Lô xe nhập từ Thai Honda Manufacturing',
      createdBy: adminId,
    })
    .$returningId()

  // Chi phí của Lô 1: Tổng = 170.000.000 VNĐ
  await db.delete(batchExpenses)
  await db.insert(batchExpenses).values([
    {
      batchId: batch1.id,
      expenseType: 'import_tax',
      description: 'Thuế nhập khẩu và thuế TTĐB theo tờ khai',
      amount: 110_000_000,
    },
    {
      batchId: batch1.id,
      expenseType: 'shipping_international',
      description: 'Cước vận chuyển container đường biển Bangkok - Cát Lái',
      amount: 35_000_000,
    },
    {
      batchId: batch1.id,
      expenseType: 'customs_fee',
      description: 'Phí làm thủ tục hải quan và kiểm định khí thải',
      amount: 15_000_000,
    },
    {
      batchId: batch1.id,
      expenseType: 'shipping_domestic',
      description: 'Vận chuyển xe lồng từ cảng Cát Lái về kho Lê Văn Sỹ',
      amount: 10_000_000,
    },
  ])

  // Danh sách xe trong Lô 1: 10 xe (5 SH 150i giá nhập 82tr, 5 Wave 125i giá nhập 48tr)
  const batch1RawVehicles = [
    // 5 xe SH 150i ABS
    {
      modelId: modelSh.id,
      colorId: cBlack.id,
      chassisNumber: 'KF20E-001001',
      engineNumber: 'KF20M-001001',
      importPrice: 82_000_000,
    },
    {
      modelId: modelSh.id,
      colorId: cWhite.id,
      chassisNumber: 'KF20E-001002',
      engineNumber: 'KF20M-001002',
      importPrice: 82_000_000,
    },
    {
      modelId: modelSh.id,
      colorId: cGrey.id,
      chassisNumber: 'KF20E-001003',
      engineNumber: 'KF20M-001003',
      importPrice: 82_000_000,
    },
    {
      modelId: modelSh.id,
      colorId: cRed.id,
      chassisNumber: 'KF20E-001004',
      engineNumber: 'KF20M-001004',
      importPrice: 82_000_000,
    },
    {
      modelId: modelSh.id,
      colorId: cWhite.id,
      chassisNumber: 'KF20E-001005',
      engineNumber: 'KF20M-001005',
      importPrice: 82_000_000,
    },
    // 5 xe Wave 125i Thái
    {
      modelId: modelWave.id,
      colorId: cRed.id,
      chassisNumber: 'MLHJ-002001',
      engineNumber: 'MLHM-002001',
      importPrice: 48_000_000,
    },
    {
      modelId: modelWave.id,
      colorId: cBlack.id,
      chassisNumber: 'MLHJ-002002',
      engineNumber: 'MLHM-002002',
      importPrice: 48_000_000,
    },
    {
      modelId: modelWave.id,
      colorId: cWhite.id,
      chassisNumber: 'MLHJ-002003',
      engineNumber: 'MLHM-002003',
      importPrice: 48_000_000,
    },
    {
      modelId: modelWave.id,
      colorId: cGrey.id,
      chassisNumber: 'MLHJ-002004',
      engineNumber: 'MLHM-002004',
      importPrice: 48_000_000,
    },
    {
      modelId: modelWave.id,
      colorId: cRed.id,
      chassisNumber: 'MLHJ-002005',
      engineNumber: 'MLHM-002005',
      importPrice: 48_000_000,
    },
  ]

  // Tính phân bổ chi phí lô 1 tự động
  const totalExpenseBatch1 = 170_000_000
  const allocatedBatch1 = allocateBatchExpenses(
    batch1RawVehicles.map((v, i) => ({
      id: i + 1,
      importPrice: v.importPrice,
    })),
    totalExpenseBatch1,
  )

  await db.delete(vehicles)
  const insertedVehicles = await db
    .insert(vehicles)
    .values(
      batch1RawVehicles.map((v, i) => {
        const alloc = allocatedBatch1[i]
        const selling = computeSellingPrice(alloc, {
          pricingBase: 'cost_price',
          pricingMethod: 'percent',
          pricingValue: 8,
        })
        return {
          batchId: batch1.id,
          modelId: v.modelId,
          colorId: v.colorId,
          chassisNumber: v.chassisNumber,
          engineNumber: v.engineNumber,
          importPrice: v.importPrice,
          allocatedExpense: alloc.allocatedExpense,
          costPrice: alloc.costPrice,
          sellingPrice: selling,
          isDelivered: false,
          isInvoiced: false,
        }
      }),
    )
    .$returningId()

  const vIds = insertedVehicles.map((v) => v.id)

  // 9. Lô nhập xe 2 (Indonesia)
  console.log(' -> Tạo Lô nhập 2 (Indonesia)...')
  const [batch2] = await db
    .insert(importBatches)
    .values({
      batchCode: 'LO-2026-02-INDO',
      supplierId: supplierIndo.id,
      loanContractId: loanBidv.id,
      importDate: '2026-02-20',
      customsDeclarationNo: 'HQ-2005987112',
      pricingBase: 'cost_price',
      pricingMethod: 'fixed_amount',
      pricingValue: 3_500_000, // Cộng thêm 3.5 triệu cố định trên giá vốn
      note: 'Lô Vario 160 và Scoopy nhập từ PT Astra Honda Motor',
      createdBy: adminId,
    })
    .$returningId()

  await db.insert(batchExpenses).values([
    {
      batchId: batch2.id,
      expenseType: 'import_tax',
      description: 'Thuế nhập khẩu và VAT',
      amount: 75_000_000,
    },
    {
      batchId: batch2.id,
      expenseType: 'shipping_international',
      description: 'Cước vận chuyển container Jakarta - TP.HCM',
      amount: 25_000_000,
    },
  ])

  const batch2RawVehicles = [
    {
      modelId: modelVario.id,
      colorId: cBlack.id,
      chassisNumber: 'MH1KF-003001',
      engineNumber: 'KF16E-003001',
      importPrice: 42_000_000,
    },
    {
      modelId: modelVario.id,
      colorId: cGrey.id,
      chassisNumber: 'MH1KF-003002',
      engineNumber: 'KF16E-003002',
      importPrice: 42_000_000,
    },
    {
      modelId: modelScoopy.id,
      colorId: cWhite.id,
      chassisNumber: 'MH1JM-004001',
      engineNumber: 'JM11E-004001',
      importPrice: 35_000_000,
    },
    {
      modelId: modelScoopy.id,
      colorId: cRed.id,
      chassisNumber: 'MH1JM-004002',
      engineNumber: 'JM11E-004002',
      importPrice: 35_000_000,
    },
  ]

  const allocatedBatch2 = allocateBatchExpenses(
    batch2RawVehicles.map((v, i) => ({
      id: i + 1,
      importPrice: v.importPrice,
    })),
    100_000_000,
  )

  await db.insert(vehicles).values(
    batch2RawVehicles.map((v, i) => {
      const alloc = allocatedBatch2[i]
      const selling = computeSellingPrice(alloc, {
        pricingBase: 'cost_price',
        pricingMethod: 'fixed_amount',
        pricingValue: 3_500_000,
      })
      return {
        batchId: batch2.id,
        modelId: v.modelId,
        colorId: v.colorId,
        chassisNumber: v.chassisNumber,
        engineNumber: v.engineNumber,
        importPrice: v.importPrice,
        allocatedExpense: alloc.allocatedExpense,
        costPrice: alloc.costPrice,
        sellingPrice: selling,
        isDelivered: false,
        isInvoiced: false,
      }
    }),
  )

  // 10. BÁN HÀNG & MINH HỌA CƠ CHẾ KHO KÉP ĐỘC LẬP (DUAL INVENTORY)
  console.log(' -> Tạo Phiếu bán xe & thiết lập minh họa KHO KÉP ĐỘC LẬP...')
  await db.delete(salesOrders)
  await db.delete(salesOrderItems)
  await db.delete(deliveryNotes)
  await db.delete(deliveryNoteItems)
  await db.delete(invoices)
  await db.delete(invoiceItems)

  // PHIẾU BÁN 1: Bán 3 xe cho Nam Anh - Showroom Q10
  // Tình trạng: ĐÃ GIAO XE VÀ ĐÃ XUẤT HÓA ĐƠN
  const [order1] = await db
    .insert(salesOrders)
    .values({
      orderNumber: 'PBX-260120-001',
      orderDate: '2026-01-20',
      customerId: custNamAnh.id,
      branchId: branchNamAnhQ10.id,
      status: 'confirmed',
      totalAmount: 305_000_000,
      note: 'Đơn hàng bán sỉ 2 SH 150i và 1 Wave 125i',
      createdBy: adminId,
    })
    .$returningId()

  const order1Vehicles = [vIds[0], vIds[1], vIds[5]] // 2 SH + 1 Wave
  await db.insert(salesOrderItems).values([
    {
      salesOrderId: order1.id,
      vehicleId: vIds[0],
      unitPrice: 110_000_000,
      costPrice: 103_443_077,
    },
    {
      salesOrderId: order1.id,
      vehicleId: vIds[1],
      unitPrice: 110_000_000,
      costPrice: 103_443_077,
    },
    {
      salesOrderId: order1.id,
      vehicleId: vIds[5],
      unitPrice: 85_000_000,
      costPrice: 60_552_041,
    },
  ])

  // Phiếu giao xe cho Order 1
  const [dn1] = await db
    .insert(deliveryNotes)
    .values({
      noteNumber: 'PGX-260121-001',
      salesOrderId: order1.id,
      deliveryDate: '2026-01-21',
      receiverName: 'Anh Hùng (Lái xe tải Nam Anh)',
      transportInfo: 'Xe tải biển số 51C-987.65',
      note: 'Giao đủ 3 xe kèm bộ khóa Smartkey và gương',
      createdBy: adminId,
    })
    .$returningId()
  await db
    .insert(deliveryNoteItems)
    .values(
      order1Vehicles.map((vId) => ({
        deliveryNoteId: dn1.id,
        vehicleId: vId,
      })),
    )

  // Hóa đơn cho Order 1
  const [inv1] = await db
    .insert(invoices)
    .values({
      invoiceNumber: 'HD-260121-001',
      salesOrderId: order1.id,
      invoiceDate: '2026-01-21',
      branchId: branchNamAnhQ10.id,
      totalAmount: 305_000_000,
      note: 'Hóa đơn xuất bán cho Showroom Quận 10',
      createdBy: adminId,
    })
    .$returningId()
  await db.insert(invoiceItems).values(
    order1Vehicles.map((vId, idx) => ({
      invoiceId: inv1.id,
      vehicleId: vId,
      amount: idx === 2 ? 85_000_000 : 110_000_000,
    })),
  )

  // Cập nhật trạng thái xe Order 1: Đã giao VÀ Đã xuất hóa đơn
  for (const vId of order1Vehicles) {
    await db
      .update(vehicles)
      .set({
        isDelivered: true,
        deliveredAt: '2026-01-21',
        isInvoiced: true,
        invoicedAt: '2026-01-21',
      })
      .where(eq(vehicles.id, vId))
  }

  // PHIẾU BÁN 2: Bán 2 xe cho Nam Anh - Showroom Bình Dương
  // TÌNH TRẠNG NGHIỆP VỤ ĐẶC THÙ: ĐÃ XUẤT HÓA ĐƠN NHƯNG CHƯA GIAO THỰC TẾ!
  // (Khách cần hóa đơn để làm thủ tục vay ngân hàng trước, xe vẫn lưu tại kho Trường Thịnh Phát)
  const [order2] = await db
    .insert(salesOrders)
    .values({
      orderNumber: 'PBX-260125-002',
      orderDate: '2026-01-25',
      customerId: custNamAnh.id,
      branchId: branchNamAnhBD.id,
      status: 'confirmed',
      totalAmount: 195_000_000,
      note: 'Khách yêu cầu xuất hóa đơn trước để vay vốn, xe gửi kho chờ chở sau',
      createdBy: adminId,
    })
    .$returningId()

  const order2Vehicles = [vIds[2], vIds[6]] // 1 SH + 1 Wave
  await db.insert(salesOrderItems).values([
    {
      salesOrderId: order2.id,
      vehicleId: vIds[2],
      unitPrice: 110_000_000,
      costPrice: 103_443_077,
    },
    {
      salesOrderId: order2.id,
      vehicleId: vIds[6],
      unitPrice: 85_000_000,
      costPrice: 60_552_041,
    },
  ])

  // Xuất hóa đơn Order 2 (KHÔNG tạo phiếu giao xe!)
  const [inv2] = await db
    .insert(invoices)
    .values({
      invoiceNumber: 'HD-260125-002',
      salesOrderId: order2.id,
      invoiceDate: '2026-01-25',
      branchId: branchNamAnhBD.id,
      totalAmount: 195_000_000,
      note: 'Hóa đơn xuất trước theo hợp đồng',
      createdBy: adminId,
    })
    .$returningId()
  await db.insert(invoiceItems).values([
    { invoiceId: inv2.id, vehicleId: vIds[2], amount: 110_000_000 },
    { invoiceId: inv2.id, vehicleId: vIds[6], amount: 85_000_000 },
  ])

  // Cập nhật xe Order 2: isInvoiced = true, isDelivered = false!
  for (const vId of order2Vehicles) {
    await db
      .update(vehicles)
      .set({
        isDelivered: false,
        isInvoiced: true,
        invoicedAt: '2026-01-25',
      })
      .where(eq(vehicles.id, vId))
  }

  // PHIẾU BÁN 3: Bán 2 xe cho Thành Đạt Thủ Đức
  // TÌNH TRẠNG NGHIỆP VỤ: ĐÃ GIAO XE VẬT LÝ NHƯNG CHƯA XUẤT HÓA ĐƠN!
  // (Đại lý gấp lấy xe về bày bán, chốt hóa đơn vào cuối tháng)
  const [order3] = await db
    .insert(salesOrders)
    .values({
      orderNumber: 'PBX-260205-003',
      orderDate: '2026-02-05',
      customerId: custThanhDat.id,
      branchId: branchThanhDatTD.id,
      status: 'confirmed',
      totalAmount: 195_000_000,
      note: 'Đã giao xe giao trước, hóa đơn xuất dồn cuối tháng',
      createdBy: adminId,
    })
    .$returningId()

  const order3Vehicles = [vIds[3], vIds[7]] // 1 SH + 1 Wave
  await db.insert(salesOrderItems).values([
    {
      salesOrderId: order3.id,
      vehicleId: vIds[3],
      unitPrice: 110_000_000,
      costPrice: 103_443_077,
    },
    {
      salesOrderId: order3.id,
      vehicleId: vIds[7],
      unitPrice: 85_000_000,
      costPrice: 60_552_041,
    },
  ])

  // Giao xe Order 3 (KHÔNG tạo hóa đơn!)
  const [dn3] = await db
    .insert(deliveryNotes)
    .values({
      noteNumber: 'PGX-260205-002',
      salesOrderId: order3.id,
      deliveryDate: '2026-02-05',
      receiverName: 'Anh Đạt',
      transportInfo: 'Khách tự lái xe tải đến kho lấy',
      note: 'Đã kiểm tra xe nguyên vẹn kèm sổ bảo hành',
      createdBy: adminId,
    })
    .$returningId()
  await db
    .insert(deliveryNoteItems)
    .values(
      order3Vehicles.map((vId) => ({
        deliveryNoteId: dn3.id,
        vehicleId: vId,
      })),
    )

  // Cập nhật xe Order 3: isDelivered = true, isInvoiced = false!
  for (const vId of order3Vehicles) {
    await db
      .update(vehicles)
      .set({
        isDelivered: true,
        deliveredAt: '2026-02-05',
        isInvoiced: false,
      })
      .where(eq(vehicles.id, vId))
  }

  // 11. Phiếu thu & Phiếu chi (Dòng tiền)
  console.log(' -> Tạo Phiếu thu & Phiếu chi...')
  await db.delete(receiptVouchers)
  await db.insert(receiptVouchers).values([
    {
      voucherNumber: 'PT-260122-001',
      receiptDate: '2026-01-22',
      customerId: custNamAnh.id,
      branchId: branchNamAnhQ10.id,
      salesOrderId: order1.id,
      amount: 200_000_000,
      method: 'bank_transfer',
      companyBankAccountId: vcbAccount.id,
      note: 'Nam Anh chuyển khoản trả nợ đợt 1 cho Order 1',
      createdBy: adminId,
    },
    {
      voucherNumber: 'PT-260210-002',
      receiptDate: '2026-02-10',
      customerId: custThanhDat.id,
      branchId: branchThanhDatTD.id,
      salesOrderId: order3.id,
      amount: 100_000_000,
      method: 'bank_transfer',
      companyBankAccountId: vcbAccount.id,
      note: 'Thành Đạt đặt cọc/thanh toán đợt 1',
      createdBy: adminId,
    },
  ])

  await db.delete(paymentVouchers)
  await db.insert(paymentVouchers).values([
    {
      voucherNumber: 'PC-260118-001',
      paymentDate: '2026-01-18',
      payeeType: 'supplier',
      supplierId: supplierThai.id,
      batchId: batch1.id,
      amount: 500_000_000,
      method: 'bank_transfer',
      companyBankAccountId: vcbAccount.id,
      description: 'Thanh toán tiền hàng đợt 1 cho Thai Honda',
      createdBy: adminId,
    },
    {
      voucherNumber: 'PC-260222-002',
      paymentDate: '2026-02-22',
      payeeType: 'supplier',
      supplierId: supplierIndo.id,
      batchId: batch2.id,
      amount: 300_000_000,
      method: 'bank_transfer',
      companyBankAccountId: bidvAccount.id,
      description: 'Thanh toán tiền hàng cho PT Astra Honda',
      createdBy: adminId,
    },
  ])

  // 12. Sao kê ngân hàng & Đối chiếu (Bank Statement Reconciliation)
  console.log(' -> Tạo Sao kê ngân hàng mẫu...')
  await db.delete(bankStatements)
  await db.delete(bankStatementLines)

  const [statement] = await db
    .insert(bankStatements)
    .values({
      companyBankAccountId: vcbAccount.id,
      periodFrom: '2026-01-01',
      periodTo: '2026-02-28',
      fileName: 'SAOKE_VCB_0071001234567_T1_T2_2026.xlsx',
      note: 'Sao kê ngân hàng VCB quý 1 năm 2026',
      createdBy: adminId,
    })
    .$returningId()

  await db.insert(bankStatementLines).values([
    {
      statementId: statement.id,
      transactionDate: '2026-01-18',
      reference: 'FT260189912',
      description: 'CHUYEN TIEN TT THAI HONDA MANUFACTURING CO LTD',
      debit: 500_000_000,
      credit: 0,
      balance: 1_500_000_000,
      status: 'matched',
      matchedType: 'payment',
      matchedId: 1,
    },
    {
      statementId: statement.id,
      transactionDate: '2026-01-22',
      reference: 'FT260220014',
      description: 'CTY XE MAY NAM ANH THANH TOAN TIEN XE',
      debit: 0,
      credit: 200_000_000,
      balance: 1_700_000_000,
      status: 'matched',
      matchedType: 'receipt',
      matchedId: 1,
    },
    {
      statementId: statement.id,
      transactionDate: '2026-02-10',
      reference: 'FT260410088',
      description: 'DNTN THANH DAT CHUYEN KHOAN TIEN HANG',
      debit: 0,
      credit: 100_000_000,
      balance: 1_800_000_000,
      status: 'matched',
      matchedType: 'receipt',
      matchedId: 2,
    },
    {
      statementId: statement.id,
      transactionDate: '2026-02-25',
      reference: 'FT260561109',
      description: 'TRU NO GOC VA LAI KHE UOC KU-2026-VCB-01',
      debit: 521_438_356,
      credit: 0,
      balance: 1_278_561_644,
      status: 'matched',
      matchedType: 'loan_repayment',
      matchedId: 1,
    },
    {
      statementId: statement.id,
      transactionDate: '2026-02-26',
      reference: 'FT260572233',
      description: 'KHACH HANG LE VAN A CK TIEN COC XE',
      debit: 0,
      credit: 50_000_000,
      balance: 1_328_561_644,
      status: 'unmatched',
    },
    {
      statementId: statement.id,
      transactionDate: '2026-02-27',
      reference: 'FT260583344',
      description: 'PHI QUAN LY TAI KHOAN VA SMS BANKING',
      debit: 220_000,
      credit: 0,
      balance: 1_328_341_644,
      status: 'unmatched',
    },
  ])

  console.log('✅ KHỞI TẠO DỮ LIỆU MẪU THÀNH CÔNG!')
  console.log('----------------------------------------------------')
  console.log('👤 Tài khoản đăng nhập:')
  console.log('   - Admin:      admin      / Admin@123')
  console.log('   - Kế toán:    ketoan     / Ktp@12345')
  console.log('   - Kinh doanh: kinhdoanh  / Sale@12345')
  console.log('   - Thủ kho:    kho        / Kho@12345')
  console.log('----------------------------------------------------')
}

// Chạy trực tiếp nếu execute qua CLI
if (process.argv[1]?.endsWith('seed.ts')) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Lỗi khi khởi tạo seed:', err)
      process.exit(1)
    })
}
