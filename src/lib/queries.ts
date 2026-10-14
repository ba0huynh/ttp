import { queryOptions } from '@tanstack/react-query'

import { todayIso } from '#/lib/business.ts'
import { getCurrentUserFn } from '#/server/fns/auth.ts'
import { getBatchDetailFn, listBatchesFn } from '#/server/fns/batches.ts'
import {
  getCustomerDetailFn,
  listCustomerOptionsFn,
  listCustomersFn,
} from '#/server/fns/customers.ts'
import {
  getBankStatementDetailFn,
  getLoanDetailFn,
  getPayablesFn,
  getReceivablesFn,
  listBankStatementsFn,
  listLoansFn,
  listPaymentVouchersFn,
  listReceiptVouchersFn,
} from '#/server/fns/finance.ts'
import {
  getAvailableVehiclesFn,
  getInventorySummaryFn,
  listVehiclesFn,
} from '#/server/fns/inventory.ts'
import { getMasterDataFn } from '#/server/fns/master-data.ts'
import { getReportsFn } from '#/server/fns/reports.ts'
import { getSalesOrderDetailFn, listSalesOrdersFn } from '#/server/fns/sales.ts'
import { getCompanyProfileFn, listUsersFn } from '#/server/fns/system.ts'

/**
 * Nguồn duy nhất cho mọi truy vấn đọc dữ liệu (TanStack Query).
 * Loader của route dùng `queryClient.query`, component dùng `useSuspenseQuery`
 * cùng một `queryOptions` nên cache được chia sẻ giữa các trang.
 *
 * Mọi mutation gọi `queryClient.invalidateQueries()` vì một nghiệp vụ
 * (giao xe, xuất hóa đơn, thu/chi...) ảnh hưởng nhiều màn hình cùng lúc
 * (kho, công nợ, dashboard).
 */

export const masterDataQuery = () =>
  queryOptions({
    queryKey: ['master-data'],
    queryFn: () => getMasterDataFn(),
    staleTime: 5 * 60_000, // danh mục ít thay đổi
  })

export const batchesQuery = () =>
  queryOptions({ queryKey: ['batches'], queryFn: () => listBatchesFn() })

export const batchDetailQuery = (id: number) =>
  queryOptions({
    queryKey: ['batches', id],
    queryFn: () => getBatchDetailFn({ data: { id } }),
  })

export const customersQuery = () =>
  queryOptions({ queryKey: ['customers'], queryFn: () => listCustomersFn() })

export const customerOptionsQuery = () =>
  queryOptions({
    queryKey: ['customers', 'options'],
    queryFn: () => listCustomerOptionsFn(),
  })

export const customerDetailQuery = (id: number) =>
  queryOptions({
    queryKey: ['customers', id],
    queryFn: () => getCustomerDetailFn({ data: { id } }),
  })

export const loansQuery = () =>
  queryOptions({ queryKey: ['loans'], queryFn: () => listLoansFn() })

export const loanDetailQuery = (id: number) =>
  queryOptions({
    queryKey: ['loans', id],
    queryFn: () => getLoanDetailFn({ data: { id } }),
  })

export const receivablesQuery = () =>
  queryOptions({
    queryKey: ['finance', 'receivables'],
    queryFn: () => getReceivablesFn(),
  })

export const payablesQuery = () =>
  queryOptions({
    queryKey: ['finance', 'payables'],
    queryFn: () => getPayablesFn(),
  })

export const receiptsQuery = () =>
  queryOptions({
    queryKey: ['finance', 'receipts'],
    queryFn: () => listReceiptVouchersFn(),
  })

export const paymentsQuery = () =>
  queryOptions({
    queryKey: ['finance', 'payments'],
    queryFn: () => listPaymentVouchersFn(),
  })

export const bankStatementsQuery = () =>
  queryOptions({
    queryKey: ['bank-statements'],
    queryFn: () => listBankStatementsFn(),
  })

export const bankStatementDetailQuery = (id: number) =>
  queryOptions({
    queryKey: ['bank-statements', id],
    queryFn: () => getBankStatementDetailFn({ data: { id } }),
  })

export const inventorySummaryQuery = () =>
  queryOptions({
    queryKey: ['inventory', 'summary'],
    queryFn: () => getInventorySummaryFn(),
  })

export const vehiclesQuery = () =>
  queryOptions({
    queryKey: ['inventory', 'vehicles'],
    queryFn: () => listVehiclesFn({ data: { stock: 'all' } }),
  })

export const availableVehiclesQuery = () =>
  queryOptions({
    queryKey: ['inventory', 'available'],
    queryFn: () => getAvailableVehiclesFn(),
  })

export const salesOrdersQuery = () =>
  queryOptions({ queryKey: ['sales'], queryFn: () => listSalesOrdersFn() })

export const salesOrderDetailQuery = (id: number) =>
  queryOptions({
    queryKey: ['sales', id],
    queryFn: () => getSalesOrderDetailFn({ data: { id } }),
  })

export const defaultReportRange = () => ({
  from: '2026-01-01',
  to: todayIso(),
})

export const reportsQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ['reports', from, to],
    queryFn: () => getReportsFn({ data: { from, to } }),
  })

export const companyProfileQuery = () =>
  queryOptions({
    queryKey: ['settings', 'company'],
    queryFn: () => getCompanyProfileFn(),
    staleTime: 5 * 60_000,
  })

export const usersQuery = () =>
  queryOptions({
    queryKey: ['settings', 'users'],
    // Chỉ admin được xem; vai trò khác nhận danh sách rỗng như trước đây
    queryFn: () => listUsersFn().catch(() => []),
  })

/**
 * Người dùng hiện tại, dùng trong `beforeLoad` của mọi route. Cache 5 phút để
 * chuyển trang không phải gọi server mỗi lần. Đăng nhập/đăng xuất dùng full
 * reload nên cache được làm mới; phiên hết hạn vẫn bị chặn ở middleware server.
 */
export const currentUserQuery = () =>
  queryOptions({
    queryKey: ['auth', 'user'],
    queryFn: () => getCurrentUserFn(),
    staleTime: 5 * 60_000,
  })
