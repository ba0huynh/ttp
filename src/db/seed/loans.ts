import { db } from '../index.ts'
import { loanContracts, loanRepayments } from '../schema.ts'

interface SeedLoansParams {
  banks: {
    vcb: { id: number }
    bidv: { id: number }
  }
  companyBankAccounts: {
    vcbAccount: { id: number }
  }
}

/**
 * Seeds commercial bank loan contracts and initial repayments.
 */
export async function seedLoans({
  banks,
  companyBankAccounts,
}: SeedLoansParams) {
  console.log(' -> Seeding bank credit loan contracts...')
  const insertedContracts = await db
    .insert(loanContracts)
    .values([
      {
        contractNumber: 'KU-2026-VCB-01',
        bankId: banks.vcb.id,
        principalAmount: 2_000_000_000,
        interestRate: 8.5,
        disbursementDate: '2026-01-10',
        maturityDate: '2026-07-10',
        status: 'active',
        note: 'Vay tài trợ nhập khẩu lô xe Honda Thái Lan',
      },
      {
        contractNumber: 'KU-2026-BIDV-02',
        bankId: banks.bidv.id,
        principalAmount: 1_500_000_000,
        interestRate: 8.8,
        disbursementDate: '2026-02-15',
        maturityDate: '2026-08-15',
        status: 'active',
        note: 'Vay tài trợ nhập khẩu lô xe Honda Indonesia',
      },
    ])
    .$returningId()

  const [loanVcb, loanBidv] = insertedContracts

  console.log(' -> Seeding loan principal and interest repayments...')
  await db.insert(loanRepayments).values({
    loanContractId: loanVcb.id,
    paymentDate: '2026-02-25',
    principalAmount: 500_000_000,
    interestAmount: 21_438_356, // 46-day interest on 2B @ 8.5%
    companyBankAccountId: companyBankAccounts.vcbAccount.id,
    note: 'Trả gốc đợt 1 và thanh toán lãi kỳ 1',
  })

  return {
    loans: { loanVcb, loanBidv },
  }
}
