/**
 * Drizzle schema — Phần mềm quản lý xe máy Trường Thịnh Phát.
 * Xem AGENTS.md mục 2 (nghiệp vụ) & mục 3 (bản đồ module) trước khi sửa.
 *
 * Quy ước:
 *  - Tiền tệ: decimal(18,2) mode 'number' (VNĐ).
 *  - Tên cột snake_case trong DB, camelCase trong TS.
 *  - Hai kho độc lập: vehicles.is_delivered & vehicles.is_invoiced (KHÔNG suy diễn lẫn nhau).
 *  - Một xe chỉ bán 1 lần: UNIQUE(sales_order_items.vehicle_id).
 */
import { relations } from 'drizzle-orm'
import {
  boolean,
  date,
  decimal,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

const money = (name: string) =>
  decimal(name, { precision: 18, scale: 2, mode: 'number' })

const timestamps = {
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .onUpdateNow()
    .notNull(),
}

/* ========================================================================== */
/* 01. USERS & SYSTEM AUTH                                                    */
/* ========================================================================== */

export const USER_ROLES = ['admin', 'accountant', 'sales', 'warehouse'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 191 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  role: mysqlEnum('role', USER_ROLES).default('sales').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at', { mode: 'date' }),
  ...timestamps,
})

export const sessions = mysqlTable(
  'sessions',
  {
    /** sha256(token) — raw token stored in HTTP-only cookie */
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

export const passwordResetTokens = mysqlTable('password_reset_tokens', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  usedAt: timestamp('used_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})

export const companyInfo = mysqlTable('company_info', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  taxCode: varchar('tax_code', { length: 20 }).notNull(),
  address: varchar('address', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 191 }),
  representative: varchar('representative', { length: 150 }),
  website: varchar('website', { length: 191 }),
  ...timestamps,
})

/* ========================================================================== */
/* 02. MASTER DATA                                                            */
/* ========================================================================== */

export const banks = mysqlTable('banks', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  /** Bank logo URL (e.g. VietQR CDN) */
  image: varchar('image', { length: 500 }),
  ...timestamps,
})

export const companyBankAccounts = mysqlTable('company_bank_accounts', {
  id: int('id').primaryKey().autoincrement(),
  bankId: int('bank_id')
    .notNull()
    .references(() => banks.id),
  accountNumber: varchar('account_number', { length: 50 }).notNull().unique(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  branch: varchar('branch', { length: 150 }),
  isActive: boolean('is_active').default(true).notNull(),
  ...timestamps,
})

export const suppliers = mysqlTable('suppliers', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  taxCode: varchar('tax_code', { length: 30 }),
  address: varchar('address', { length: 255 }),
  email: varchar('email', { length: 191 }),
  note: text('note'),
  ...timestamps,
})

export const motorcycleModels = mysqlTable('motorcycle_models', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  ...timestamps,
})

export const colors = mysqlTable('colors', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 80 }).notNull(),
  hex: varchar('hex', { length: 7 }),
  ...timestamps,
})

/* ========================================================================== */
/* 03. CUSTOMERS & POS BRANCHES                                               */
/* ========================================================================== */

/** Parent customer — sales revenue is attributed here */
export const customers = mysqlTable('customers', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 191 }),
  note: text('note'),
  ...timestamps,
})

/** POS Branch — receiving entity, carries Accounts Receivable & commercial invoice */
export const posBranches = mysqlTable(
  'pos_branches',
  {
    id: int('id').primaryKey().autoincrement(),
    customerId: int('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    contactPerson: varchar('contact_person', { length: 150 }),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [index('pos_branches_customer_idx').on(t.customerId)],
)

/* ========================================================================== */
/* 04. BANK LOANS & CREDIT CONTRACTS                                         */
/* ========================================================================== */

export const LOAN_STATUSES = ['active', 'settled'] as const

export const loanContracts = mysqlTable('loan_contracts', {
  id: int('id').primaryKey().autoincrement(),
  contractNumber: varchar('contract_number', { length: 50 }).notNull().unique(),
  bankId: int('bank_id')
    .notNull()
    .references(() => banks.id),
  principalAmount: money('principal_amount').notNull(),
  /** Annual interest rate %, declining balance basis, 365 days */
  interestRate: decimal('interest_rate', {
    precision: 6,
    scale: 3,
    mode: 'number',
  }).notNull(),
  disbursementDate: date('disbursement_date', { mode: 'string' }).notNull(),
  maturityDate: date('maturity_date', { mode: 'string' }).notNull(),
  status: mysqlEnum('status', LOAN_STATUSES).default('active').notNull(),
  note: text('note'),
  ...timestamps,
})

export const loanRepayments = mysqlTable(
  'loan_repayments',
  {
    id: int('id').primaryKey().autoincrement(),
    loanContractId: int('loan_contract_id')
      .notNull()
      .references(() => loanContracts.id, { onDelete: 'cascade' }),
    paymentDate: date('payment_date', { mode: 'string' }).notNull(),
    principalAmount: money('principal_amount').default(0).notNull(),
    interestAmount: money('interest_amount').default(0).notNull(),
    companyBankAccountId: int('company_bank_account_id'),
    note: text('note'),
    ...timestamps,
  },
  (t) => [
    index('loan_repayments_loan_idx').on(t.loanContractId),
    foreignKey({
      name: 'loan_repayments_bank_account_fk',
      columns: [t.companyBankAccountId],
      foreignColumns: [companyBankAccounts.id],
    }),
  ],
)

/* ========================================================================== */
/* 05. INVENTORY & IMPORT BATCHES                                             */
/* ========================================================================== */

export const PRICING_BASES = ['import_price', 'cost_price'] as const
export const PRICING_METHODS = ['percent', 'fixed_amount'] as const
export type PricingBase = (typeof PRICING_BASES)[number]
export type PricingMethod = (typeof PRICING_METHODS)[number]

export const importBatches = mysqlTable(
  'import_batches',
  {
    id: int('id').primaryKey().autoincrement(),
    batchCode: varchar('batch_code', { length: 50 }).notNull().unique(),
    supplierId: int('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    /** Linked loan credit contract financing batch (null if self-funded) */
    loanContractId: int('loan_contract_id').references(() => loanContracts.id, {
      onDelete: 'set null',
    }),
    importDate: date('import_date', { mode: 'string' }).notNull(),
    customsDeclarationNo: varchar('customs_declaration_no', { length: 50 }),
    /** Batch-wide wholesale pricing configuration */
    pricingBase: mysqlEnum('pricing_base', PRICING_BASES)
      .default('cost_price')
      .notNull(),
    pricingMethod: mysqlEnum('pricing_method', PRICING_METHODS)
      .default('percent')
      .notNull(),
    pricingValue: money('pricing_value').default(0).notNull(),
    note: text('note'),
    createdBy: int('created_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('import_batches_supplier_idx').on(t.supplierId),
    index('import_batches_loan_idx').on(t.loanContractId),
  ],
)

export const EXPENSE_TYPES = [
  'import_tax',
  'vat_import',
  'shipping_international',
  'shipping_domestic',
  'customs_fee',
  'other',
] as const
export type ExpenseType = (typeof EXPENSE_TYPES)[number]

export const batchExpenses = mysqlTable(
  'batch_expenses',
  {
    id: int('id').primaryKey().autoincrement(),
    batchId: int('batch_id')
      .notNull()
      .references(() => importBatches.id, { onDelete: 'cascade' }),
    expenseType: mysqlEnum('expense_type', EXPENSE_TYPES).notNull(),
    description: varchar('description', { length: 255 }),
    amount: money('amount').notNull(),
    ...timestamps,
  },
  (t) => [index('batch_expenses_batch_idx').on(t.batchId)],
)

export const vehicles = mysqlTable(
  'vehicles',
  {
    id: int('id').primaryKey().autoincrement(),
    batchId: int('batch_id')
      .notNull()
      .references(() => importBatches.id, { onDelete: 'cascade' }),
    modelId: int('model_id')
      .notNull()
      .references(() => motorcycleModels.id),
    colorId: int('color_id')
      .notNull()
      .references(() => colors.id),
    /** Chassis number (VIN) — unique across the system */
    chassisNumber: varchar('chassis_number', { length: 50 }).notNull().unique(),
    engineNumber: varchar('engine_number', { length: 50 }).notNull().unique(),
    importPrice: money('import_price').notNull(),
    /** Cached — recalculated by recalculateBatch() */
    allocatedExpense: money('allocated_expense').default(0).notNull(),
    costPrice: money('cost_price').default(0).notNull(),
    sellingPrice: money('selling_price').default(0).notNull(),
    /** PHYSICAL INVENTORY: true when physical vehicle has been handed over */
    isDelivered: boolean('is_delivered').default(false).notNull(),
    deliveredAt: date('delivered_at', { mode: 'string' }),
    /** INVOICED INVENTORY: true when commercial invoice has been issued */
    isInvoiced: boolean('is_invoiced').default(false).notNull(),
    invoicedAt: date('invoiced_at', { mode: 'string' }),
    ...timestamps,
  },
  (t) => [
    index('vehicles_batch_idx').on(t.batchId),
    index('vehicles_model_idx').on(t.modelId),
    index('vehicles_delivered_idx').on(t.isDelivered),
    index('vehicles_invoiced_idx').on(t.isInvoiced),
  ],
)

/* ========================================================================== */
/* 07. SALES & DISPATCHES                                                    */
/* ========================================================================== */

export const SALES_ORDER_STATUSES = ['confirmed', 'cancelled'] as const

export const salesOrders = mysqlTable(
  'sales_orders',
  {
    id: int('id').primaryKey().autoincrement(),
    orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
    orderDate: date('order_date', { mode: 'string' }).notNull(),
    /** Parent customer — sales revenue is attributed here */
    customerId: int('customer_id')
      .notNull()
      .references(() => customers.id),
    /** Receiving branch — AR & invoice billed to this entity (null = parent customer) */
    branchId: int('branch_id').references(() => posBranches.id),
    status: mysqlEnum('status', SALES_ORDER_STATUSES)
      .default('confirmed')
      .notNull(),
    totalAmount: money('total_amount').default(0).notNull(),
    note: text('note'),
    createdBy: int('created_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('sales_orders_customer_idx').on(t.customerId),
    index('sales_orders_branch_idx').on(t.branchId),
  ],
)

export const salesOrderItems = mysqlTable(
  'sales_order_items',
  {
    id: int('id').primaryKey().autoincrement(),
    salesOrderId: int('sales_order_id')
      .notNull()
      .references(() => salesOrders.id, { onDelete: 'cascade' }),
    vehicleId: int('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    unitPrice: money('unit_price').notNull(),
    /** Cost price snapshot at sale time for consistent profit reporting */
    costPrice: money('cost_price').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    /** BLOCK DUPLICATE SALES at DB level: 1 vehicle can only belong to 1 sales order */
    uniqueIndex('sales_order_items_vehicle_uq').on(t.vehicleId),
    index('sales_order_items_order_idx').on(t.salesOrderId),
  ],
)

export const deliveryNotes = mysqlTable('delivery_notes', {
  id: int('id').primaryKey().autoincrement(),
  noteNumber: varchar('note_number', { length: 50 }).notNull().unique(),
  salesOrderId: int('sales_order_id')
    .notNull()
    .references(() => salesOrders.id, { onDelete: 'cascade' }),
  deliveryDate: date('delivery_date', { mode: 'string' }).notNull(),
  receiverName: varchar('receiver_name', { length: 150 }),
  transportInfo: varchar('transport_info', { length: 255 }),
  note: text('note'),
  createdBy: int('created_by').references(() => users.id),
  ...timestamps,
})

export const deliveryNoteItems = mysqlTable(
  'delivery_note_items',
  {
    id: int('id').primaryKey().autoincrement(),
    deliveryNoteId: int('delivery_note_id')
      .notNull()
      .references(() => deliveryNotes.id, { onDelete: 'cascade' }),
    vehicleId: int('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
  },
  (t) => [uniqueIndex('delivery_note_items_vehicle_uq').on(t.vehicleId)],
)

export const invoices = mysqlTable('invoices', {
  id: int('id').primaryKey().autoincrement(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  salesOrderId: int('sales_order_id')
    .notNull()
    .references(() => salesOrders.id, { onDelete: 'cascade' }),
  invoiceDate: date('invoice_date', { mode: 'string' }).notNull(),
  /** Legal entity on invoice: branch (or parent customer if null) */
  branchId: int('branch_id').references(() => posBranches.id),
  totalAmount: money('total_amount').notNull(),
  note: text('note'),
  createdBy: int('created_by').references(() => users.id),
  ...timestamps,
})

export const invoiceItems = mysqlTable(
  'invoice_items',
  {
    id: int('id').primaryKey().autoincrement(),
    invoiceId: int('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    vehicleId: int('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    amount: money('amount').notNull(),
  },
  (t) => [uniqueIndex('invoice_items_vehicle_uq').on(t.vehicleId)],
)

/* ========================================================================== */
/* 08–09. DEBT & CASHFLOW: RECEIPT / PAYMENT VOUCHERS                         */
/* ========================================================================== */

export const PAYMENT_METHODS = ['cash', 'bank_transfer'] as const

export const receiptVouchers = mysqlTable(
  'receipt_vouchers',
  {
    id: int('id').primaryKey().autoincrement(),
    receiptDate: date('receipt_date', { mode: 'string' }).notNull(),
    customerId: int('customer_id')
      .notNull()
      .references(() => customers.id),
    /** Paying entity (debt tracked per branch) */
    branchId: int('branch_id').references(() => posBranches.id),
    salesOrderId: int('sales_order_id').references(() => salesOrders.id, {
      onDelete: 'set null',
    }),
    amount: money('amount').notNull(),
    companyBankAccountId: int('company_bank_account_id'),
    note: text('note'),
    createdBy: int('created_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('receipt_vouchers_customer_idx').on(t.customerId),
    index('receipt_vouchers_branch_idx').on(t.branchId),
    foreignKey({
      name: 'receipt_vouchers_bank_account_fk',
      columns: [t.companyBankAccountId],
      foreignColumns: [companyBankAccounts.id],
    }),
  ],
)

export const PAYEE_TYPES = ['supplier', 'other'] as const

export const paymentVouchers = mysqlTable(
  'payment_vouchers',
  {
    id: int('id').primaryKey().autoincrement(),
    voucherNumber: varchar('voucher_number', { length: 50 }).notNull().unique(),
    paymentDate: date('payment_date', { mode: 'string' }).notNull(),
    payeeType: mysqlEnum('payee_type', PAYEE_TYPES)
      .default('supplier')
      .notNull(),
    supplierId: int('supplier_id').references(() => suppliers.id),
    batchId: int('batch_id').references(() => importBatches.id, {
      onDelete: 'set null',
    }),
    payeeName: varchar('payee_name', { length: 255 }),
    amount: money('amount').notNull(),
    method: mysqlEnum('method', PAYMENT_METHODS)
      .default('bank_transfer')
      .notNull(),
    companyBankAccountId: int('company_bank_account_id'),
    description: varchar('description', { length: 255 }),
    createdBy: int('created_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('payment_vouchers_supplier_idx').on(t.supplierId),
    foreignKey({
      name: 'payment_vouchers_bank_account_fk',
      columns: [t.companyBankAccountId],
      foreignColumns: [companyBankAccounts.id],
    }),
  ],
)

/* ========================================================================== */
/* 10. BANK STATEMENTS & RECONCILIATION                                       */
/* ========================================================================== */

export const STATEMENT_LINE_STATUSES = [
  'unmatched',
  'matched',
  'ignored',
] as const
export const MATCH_TYPES = ['receipt', 'payment', 'loan_repayment'] as const
export type MatchType = (typeof MATCH_TYPES)[number]

export const bankStatements = mysqlTable(
  'bank_statements',
  {
    id: int('id').primaryKey().autoincrement(),
    companyBankAccountId: int('company_bank_account_id').notNull(),
    fileName: varchar('file_name', { length: 255 }),
    createdBy: int('created_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: 'bank_statements_bank_account_fk',
      columns: [t.companyBankAccountId],
      foreignColumns: [companyBankAccounts.id],
    }),
  ],
)

export const bankStatementLines = mysqlTable(
  'bank_statement_lines',
  {
    id: int('id').primaryKey().autoincrement(),
    statementId: int('statement_id')
      .notNull()
      .references(() => bankStatements.id, { onDelete: 'cascade' }),
    transactionDate: date('transaction_date', { mode: 'string' }).notNull(),
    description: varchar('description', { length: 500 }),
    /** Outgoing money (debit) */
    debit: money('debit').default(0).notNull(),
    /** Incoming money (credit) */
    credit: money('credit').default(0).notNull(),
    balance: money('balance'),
    status: mysqlEnum('status', STATEMENT_LINE_STATUSES)
      .default('unmatched')
      .notNull(),
    matchedType: mysqlEnum('matched_type', MATCH_TYPES),
    matchedId: int('matched_id'),
    ...timestamps,
  },
  (t) => [
    index('bank_statement_lines_statement_idx').on(t.statementId),
    index('bank_statement_lines_match_idx').on(t.matchedType, t.matchedId),
  ],
)

/* ========================================================================== */
/* RELATIONS                                                                  */
/* ========================================================================== */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const banksRelations = relations(banks, ({ many }) => ({
  accounts: many(companyBankAccounts),
  loans: many(loanContracts),
}))

export const companyBankAccountsRelations = relations(
  companyBankAccounts,
  ({ one }) => ({
    bank: one(banks, {
      fields: [companyBankAccounts.bankId],
      references: [banks.id],
    }),
  }),
)

export const customersRelations = relations(customers, ({ many }) => ({
  branches: many(posBranches),
  salesOrders: many(salesOrders),
  receipts: many(receiptVouchers),
}))

export const posBranchesRelations = relations(posBranches, ({ one }) => ({
  customer: one(customers, {
    fields: [posBranches.customerId],
    references: [customers.id],
  }),
}))

export const loanContractsRelations = relations(
  loanContracts,
  ({ one, many }) => ({
    bank: one(banks, {
      fields: [loanContracts.bankId],
      references: [banks.id],
    }),
    repayments: many(loanRepayments),
    batches: many(importBatches),
  }),
)

export const loanRepaymentsRelations = relations(loanRepayments, ({ one }) => ({
  loan: one(loanContracts, {
    fields: [loanRepayments.loanContractId],
    references: [loanContracts.id],
  }),
}))

export const importBatchesRelations = relations(
  importBatches,
  ({ one, many }) => ({
    supplier: one(suppliers, {
      fields: [importBatches.supplierId],
      references: [suppliers.id],
    }),
    loan: one(loanContracts, {
      fields: [importBatches.loanContractId],
      references: [loanContracts.id],
    }),
    expenses: many(batchExpenses),
    vehicles: many(vehicles),
  }),
)

export const batchExpensesRelations = relations(batchExpenses, ({ one }) => ({
  batch: one(importBatches, {
    fields: [batchExpenses.batchId],
    references: [importBatches.id],
  }),
}))

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  batch: one(importBatches, {
    fields: [vehicles.batchId],
    references: [importBatches.id],
  }),
  model: one(motorcycleModels, {
    fields: [vehicles.modelId],
    references: [motorcycleModels.id],
  }),
  color: one(colors, { fields: [vehicles.colorId], references: [colors.id] }),
  saleItem: one(salesOrderItems, {
    fields: [vehicles.id],
    references: [salesOrderItems.vehicleId],
  }),
}))

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [salesOrders.customerId],
    references: [customers.id],
  }),
  branch: one(posBranches, {
    fields: [salesOrders.branchId],
    references: [posBranches.id],
  }),
  items: many(salesOrderItems),
  deliveryNotes: many(deliveryNotes),
  invoices: many(invoices),
}))

export const salesOrderItemsRelations = relations(
  salesOrderItems,
  ({ one }) => ({
    order: one(salesOrders, {
      fields: [salesOrderItems.salesOrderId],
      references: [salesOrders.id],
    }),
    vehicle: one(vehicles, {
      fields: [salesOrderItems.vehicleId],
      references: [vehicles.id],
    }),
  }),
)

export const deliveryNotesRelations = relations(
  deliveryNotes,
  ({ one, many }) => ({
    order: one(salesOrders, {
      fields: [deliveryNotes.salesOrderId],
      references: [salesOrders.id],
    }),
    items: many(deliveryNoteItems),
  }),
)

export const deliveryNoteItemsRelations = relations(
  deliveryNoteItems,
  ({ one }) => ({
    note: one(deliveryNotes, {
      fields: [deliveryNoteItems.deliveryNoteId],
      references: [deliveryNotes.id],
    }),
    vehicle: one(vehicles, {
      fields: [deliveryNoteItems.vehicleId],
      references: [vehicles.id],
    }),
  }),
)

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  order: one(salesOrders, {
    fields: [invoices.salesOrderId],
    references: [salesOrders.id],
  }),
  branch: one(posBranches, {
    fields: [invoices.branchId],
    references: [posBranches.id],
  }),
  items: many(invoiceItems),
}))

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  vehicle: one(vehicles, {
    fields: [invoiceItems.vehicleId],
    references: [vehicles.id],
  }),
}))

export const receiptVouchersRelations = relations(
  receiptVouchers,
  ({ one }) => ({
    customer: one(customers, {
      fields: [receiptVouchers.customerId],
      references: [customers.id],
    }),
    branch: one(posBranches, {
      fields: [receiptVouchers.branchId],
      references: [posBranches.id],
    }),
  }),
)

export const paymentVouchersRelations = relations(
  paymentVouchers,
  ({ one }) => ({
    supplier: one(suppliers, {
      fields: [paymentVouchers.supplierId],
      references: [suppliers.id],
    }),
    batch: one(importBatches, {
      fields: [paymentVouchers.batchId],
      references: [importBatches.id],
    }),
  }),
)

export const bankStatementsRelations = relations(
  bankStatements,
  ({ one, many }) => ({
    account: one(companyBankAccounts, {
      fields: [bankStatements.companyBankAccountId],
      references: [companyBankAccounts.id],
    }),
    lines: many(bankStatementLines),
  }),
)

export const bankStatementLinesRelations = relations(
  bankStatementLines,
  ({ one }) => ({
    statement: one(bankStatements, {
      fields: [bankStatementLines.statementId],
      references: [bankStatements.id],
    }),
  }),
)
