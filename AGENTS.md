# AGENTS.MD — OPERATIONAL MEMORY & CORE TECHNICAL COMPASS

> **PROJECT**: TRUONG THINH PHAT MOTORCYCLE MANAGEMENT SYSTEM  
> **CLIENT / INVESTOR**: Truong Thinh Phat Service Trading Company Limited (Tax Code: `0316513248`)  
> **SOLUTION & CONSULTING PARTNER**: CIT Group  
> **DOCUMENT VERSION**: 1.0.0 (Living Knowledge Base)  
> **TARGET AUDIENCE**: All AI Agents, Developers, and Engineers contributing to this repository.

---

## 1. MANDATORY AGENT PROTOCOLS & INSTRUCTIONS

All AI Agents working on this repository **MUST STRICTLY ADHERE** to the following rules:

1. **MANDATORY LANGUAGE PROTOCOL (CRITICAL & NON-NEGOTIABLE)**:
   - **From now on, all agents MUST ONLY write code, write code comments, docstrings, commit messages, documentation, and chat responses in English ONLY.**
   - **Regardless of whether the user prompts in Vietnamese or any other language, the agent MUST ALWAYS communicate and respond in English**, unless the user explicitly requests another language.

2. **Read `AGENTS.md` First**:
   - Never guess business requirements or project architecture.
   - Always check the Glossary, Core Business Rules, and Architecture Map in this document before writing or modifying any code.

3. **Mandatory Type Check Before Ending Turns (`npx tsc --noEmit`)**:
   - Every TypeScript / React modification must pass:
     ```bash
     npx tsc --noEmit
     ```
   - **NEVER** finish a turn if `tsc --noEmit` produces errors. Strict options (`noUnusedLocals: true`, `noUnusedParameters: true`) are enabled.

4. **Adhere to Imports & Path Aliases**:
   - Use standard aliases configured in `tsconfig.json`:
     - `#/` or `@/` maps to `./src/*` (e.g., `#/components/...`, `#/db/...`, `#/lib/...`, `#/server/...`).
   - Preserve `allowImportingTsExtensions: true` and `verbatimModuleSyntax: true` according to project conventions.

5. **Self-Updating Memory Protocol**:
   - Whenever completing a new feature, fixing a complex bug, discovering a technical gotcha, or changing database schema/routes:
   - The Agent **MUST IMMEDIATELY** record that lesson into **Section 5: Living Knowledge Log & Lessons Learned** at the bottom of this file before handing back to the user.

---

## 2. PROJECT OVERVIEW & CORE BUSINESS RULES

### 2.1. Context & Software Objective

- **Client**: Truong Thinh Phat Service Trading Company Limited (Tax Code: `0316513248`, Address: 229 Le Van Sy, Ward 13, District 3, Ho Chi Minh City).
- **Business Model**: Imports completely built-up (CBU) motorcycles in batches from abroad and wholesales (B2B) to corporate clients, authorized dealers, and motorcycle retail chains.
- **Previous Bottleneck**: Managed manually across disconnected Excel sheets among staff, leading to severe discrepancies in stock levels, receivables, payables, and cash flow.
- **System Positioning**:
  - A streamlined, robust **Internal Operations Web Application** dedicated to accurate data entry, inventory tracking, financial control, and cross-reconciliation.
  - **NOT A COMPLEX HEAVY ERP**: Does not require multi-step manufacturing costing or automated tax invoice authority APIs (manages internal commercial invoices and financial notes only).

---

### 2.2. Core Domain Rules (MUST BE ACCURATELY PRESERVED)

_(Extracted from CIT Group's system specification — errors in this logic will corrupt company financial calculations)_:

1. **Bank Credit Contracts & Batch Imports**:
   - The company borrows funds from commercial banks under individual loan contracts (khế ước vay) to finance each imported batch.
   - When goods arrive at the port/warehouse, staff create an **Import Batch (`import_batches`)**.
   - Input consists of individual vehicles (Chassis Number, Engine Number, Model, Color, Import Unit Price) and batch expenses (Import duty, international/domestic logistics, customs clearance, storage fees).
   - **Warehouse rule**: _Once a batch is imported, all vehicles are automatically placed into inventory_. There is no detached separate warehouse intake note step.

2. **Vehicle Cost Price Calculation (Allocation Formula)**:
   - Batch expenses are allocated proportionally to each vehicle based on the **ratio of that vehicle's import price to the total goods value of the batch**:
     $$\text{Allocated Expense for Vehicle } i = \text{Total Batch Expenses} \times \frac{\text{Import Price of Vehicle } i}{\sum \text{Import Price of all vehicles in batch}}$$
     $$\text{Cost Price of Vehicle } i = \text{Import Price of Vehicle } i + \text{Allocated Expense for Vehicle } i$$
   - Any fractional remainder resulting from integer division is added to the last vehicle of the batch so total allocated expenses match exactly 100%.

3. **Batch-Level Selling Price & Below-Cost Warning**:
   - **Selling price is set per BATCH**, not configured individually per loose motorcycle.
   - Formula: $\text{Base} + \% \text{ Profit Margin}$ OR $\text{Base} + \text{Fixed Markup Amount}$.
   - Configurable Base: based on _Import Price_ or _Actual Cost Price_.
   - **MANDATORY WARNING**: Because import duties and shipping fees represent a significant percentage of total cost, calculating margin solely on import price can cause the selling price to fall below the true cost price. **The system must display a prominent red warning when $\text{Selling Price} < \text{Cost Price}$**.

4. **DUAL INDEPENDENT INVENTORY (2 Parallel Inventory States per Vehicle)**:
   - In B2B wholesale motorcycle operations, **Physical Delivery** and **Financial Invoicing** are completely decoupled based on dealer agreements:
     - **Physical Inventory**: Decreases when warehouse staff perform physical vehicle handover (`is_delivered = true`).
     - **Invoiced Inventory**: Decreases when accounting issues the internal commercial invoice (`is_invoiced = true`).
   - These flags are **strictly independent**. One flag must NEVER be inferred from the other!
   - _Real-world example_: A vehicle has been invoiced to a dealer for registration or bank financing purposes, but physically remains in the warehouse awaiting transport truck pickup $\rightarrow$ Vehicle is out of invoiced stock but remains in physical stock. **This is normal business workflow, NEVER treat it as a bug**.

5. **VIN / Chassis Number Uniqueness Rule**:
   - A vehicle (identified by its Chassis Number / VIN) **can only be sold once**. The system strictly blocks duplicate dispatches at both Database constraint and Application logic levels.

6. **Bank Loan Interest Formula**:
   - Bank loan interest is calculated based on **declining principal balance**.
   - Calendar convention: **365 days / year**.
   - Segmented interest intervals are computed precisely upon each actual principal repayment event.

7. **Parent Corporation vs. Sub-Branches / Showrooms**:
   - Corporate customers may have a Parent Company (Headquarters) and multiple affiliated showrooms/branches (`pos_branches`).
   - **Data attribution**:
     - **Sales Revenue**: Attributed to the Parent Company for turnover tracking and volume discount policies.
     - **Receivables & Invoices**: Billed directly to the legal entity of the receiving branch.

8. **Bank Statement Reconciliation**:
   - Bank statement lines are uploaded periodically to reconcile incoming customer payments (Accounts Receivable) and outgoing supplier / loan payments (Accounts Payable & Bank Debt).

---

### 2.3. Standard Glossary

| English Term (Code / Entity) | Vietnamese Term (UI / Domain) | Technical Definition & Notes                                 |
| ---------------------------- | ----------------------------- | ------------------------------------------------------------ |
| `import_batches` / `Batch`   | Lô nhập xe                    | Import shipment containing vehicles and batch-level expenses |
| `vehicles` / `Motorcycle`    | Xe máy / Chiếc xe             | Single individual motorcycle unit (1 row = 1 unit)           |
| `chassis_number` / `vin`     | Số khung                      | Unique motorcycle identification string (`UNIQUE` in DB)     |
| `engine_number`              | Số máy                        | Engine serial number string                                  |
| `motorcycle_models`          | Dòng xe / Loại xe             | Vehicle model (e.g., SH 150i, Wave Alpha, Vision, etc.)      |
| `color`                      | Màu xe                        | Vehicle exterior color                                       |
| `import_price`               | Đơn giá nhập                  | Original purchase price from overseas supplier (VND)         |
| `batch_expenses` / `Expense` | Chi phí lô xe                 | Customs duty, ocean/air freight, warehousing, clearance fees |
| `allocated_expense`          | Chi phí phân bổ               | Pro-rated batch expense apportioned to each individual unit  |
| `cost_price`                 | Giá vốn xe                    | `= import_price + allocated_expense`                         |
| `selling_price`              | Giá bán xe                    | Batch-wide wholesale price (warns if `< cost_price`)         |
| `is_delivered`               | Đã giao xe (Kho thực tế)      | Boolean: `true` when physically dispatched from warehouse    |
| `is_invoiced`                | Đã xuất HĐ (Kho hóa đơn)      | Boolean: `true` when commercial invoice has been issued      |
| `sales_orders` / `Order`     | Phiếu bán xe                  | Wholesale order reserving specific vehicle units             |
| `delivery_notes`             | Phiếu giao xe                 | Physical handover receipt logging dispatch timestamp         |
| `invoices`                   | Hóa đơn xuất bán              | Commercial invoice recording decrease in invoiced inventory  |
| `parent_customer`            | Khách hàng mẹ                 | Corporate partner signing framework agreement                |
| `pos_branches` / `Branch`    | Điểm bán trực thuộc           | Sub-branch / showroom receiving bikes and carrying debt      |
| `loan_contracts` / `Loan`    | Khế ước vay ngân hàng         | Commercial credit contract financing imported batch          |
| `loan_repayments`            | Khoản trả ngân hàng           | Principal or interest repayment transaction                  |
| `accounts_receivable` (AR)   | Công nợ phải thu              | Outstanding amounts owed by customer branches                |
| `accounts_payable` (AP)      | Công nợ phải trả              | Outstanding debt owed to suppliers                           |
| `receipt_vouchers`           | Phiếu thu                     | Cash/transfer receipt voucher settling customer debt         |
| `payment_vouchers`           | Phiếu chi                     | Cash/transfer disbursement voucher paying suppliers/expenses |
| `bank_statements`            | Sao kê ngân hàng              | Imported bank statement lines for automatic matching         |

---

## 3. FEATURE & ARCHITECTURE MAP

The system comprises **11 Core Business Modules**:

| #      | Module                       | Database Entity (`src/db/schema.ts`)                               | Server Functions (`src/server/fns/`)                                    | UI Route (`src/routes/`)   | Key Components (`src/components/`)               |
| ------ | ---------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------- | ------------------------------------------------ |
| **01** | **System & Auth**            | `users`, `sessions`, `company_info`                                | `auth.ts`, `system.ts`                                                  | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/settings` | `AppLayout.tsx`, `AuthShell.tsx`, `avatar.tsx`   |
| **02** | **Master Data**              | `banks`, `company_bank_accounts`, `suppliers`, `motorcycle_models` | `master-data.ts`                                                        | `/master-data`             | `Tabs`, `Table`, `Dialog`                        |
| **03** | **Customers & Branches**     | `customers`, `pos_branches`                                        | `customers.ts`                                                          | `/customers`, `/customers/$customerId` | `Card`, `Badge`, `Dialog`                        |
| **04** | **Bank Loans**               | `loan_contracts`, `loan_repayments`                                | `finance.ts` (`listLoansFn`, `createLoanContractFn`)                    | `/loans`                   | `InterestTable`, `RepaymentModal`                |
| **05** | **Batch Imports & Costing**  | `import_batches`, `batch_expenses`, `vehicles`                     | `batches.ts` (`createBatchFn`, `updateBatchPricingFn`, `updateBatchInfoFn`, add/remove vehicle & expense) | `/batches`, `/batches/new`, `/batches/$batchId` | `CostWarningAlert.tsx`, `batches/BatchEditor.tsx` |
| **06** | **Dual Inventory**           | `vehicles`                                                         | `inventory.ts` (`getInventorySummaryFn`, `listVehiclesFn`)              | `/inventory`               | `DualInventoryBadge.tsx`, stock filter buttons   |
| **07** | **Sales & Dispatches**       | `sales_orders`, `sales_order_items`, `delivery_notes`, `invoices`  | `sales.ts` (`createSalesOrderFn`, `recordDeliveryFn`, `issueInvoiceFn`) | `/sales`, `/sales/new`, `/sales/$orderId` | `VehiclePicker`, `DeliveryModal`, `InvoiceModal` |
| **08** | **Accounts Receivable (AR)** | `accounts_receivable`, `receipt_vouchers`                          | `finance.ts` (`listReceivablesFn`, `createReceiptVoucherFn`)            | `/finance` (Tab 1 & 3)     | `ReceivableTable`, `ReceiptVoucherModal`         |
| **09** | **Accounts Payable (AP)**    | `accounts_payable`, `payment_vouchers`                             | `finance.ts` (`listPayablesFn`, `createPaymentVoucherFn`)               | `/finance` (Tab 2 & 4)     | `PayableTable`, `PaymentVoucherModal`            |
| **10** | **Bank Reconciliation**      | `bank_statements`, `bank_statement_lines`, `reconciliations`       | `finance.ts` (`importBankStatementFn`, `matchStatementLineFn`, `autoMatchStatementFn`) | `/reconcile`               | `finance/ImportStatementDialog.tsx`, `lib/statement-import.ts` |
| **11** | **Reports & Analytics**      | Aggregated queries across transactions                             | `reports.ts` (`getReportsFn`)                                           | `/reports`                 | Profit margin by batch, parent revenue breakdown |

---

## 4. TECH STACK & QUALITY STANDARDS

### 4.1. Technology Stack

- **Runtime Environment**: Node.js (>= 20.x) or Bun (>= 1.2.x).
- **Package Manager**: `npm` / `pnpm` / `bun` (Synchronized via lockfile).
- **Core Fullstack Framework**: **TanStack Start** (v1.169+) with **Vite 8** and **Nitro 3 Engine**.
- **Frontend & React**: **React 19** (v19.2+) + React Compiler Babel Plugin.
- **Routing**: **TanStack Router** (File-based routing under `src/routes/`, generated at `src/routeTree.gen.ts`).
- **Database**: **MySQL 8.x** with `mysql2` driver.
- **ORM & Migrations**: **Drizzle ORM** (v0.45+) & **Drizzle Kit** (v0.31+).
- **State Management & Caching**: **TanStack Query** (v5.104+) + SSR Query Integration.
- **Styling & Design System**: **Tailwind CSS v4** (`@tailwindcss/vite`), `tw-animate-css`, `class-variance-authority`, `clsx`, `tailwind-merge`.
- **UI Components**: **Shadcn UI** (New York style, Radix UI Primitives, Lucide Icons).
- **Type Safety & Env**: TypeScript 6 (Strict mode), **Zod v4**, `@t3-oss/env-core`.
- **Internationalization (i18n)**: **Paraglide JS** (`@inlang/paraglide-js`).

---

### 4.2. Command Reference & Quality Gate

| Purpose                         | Command Execution                                             | Notes for Agents                                                     |
| ------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Start Development Server**    | `npm run dev`                                                 | Starts local dev server at `http://localhost:3000`                   |
| **Generate Route Tree**         | `npm run generate-routes`                                     | Run whenever adding or renaming files in `src/routes/`               |
| **Compile i18n (Paraglide)**    | `npx @inlang/paraglide-js compile --project ./project.inlang` | Run if editing `messages/` or if missing `#/paraglide` module        |
| **MANDATORY: TypeScript Check** | `npx tsc --noEmit`                                            | **Must pass with 0 errors before finishing any turn!**               |
| **Linter / Formatter**          | `npm run format` & `npm run lint`                             | Runs Prettier write and ESLint fixes                                 |
| **Check Code Formatting**       | `npm run check`                                               | Prettier dry-run format check                                        |
| **Generate Drizzle Migration**  | `npm run db:generate`                                         | Generates SQL migration file in `./src/db/migrations`                          |
| **Apply Migrations**            | `npm run migration:run`                                       | Runs `src/db/migrate.ts` (custom runner, table `migrations` keyed by file name; NOT drizzle-compatible); prints progress and errors, auto-baselines a DB whose tables already exist |
| **Push Schema to Database**     | `npm run db:push`                                             | Pushes schema directly from `src/db/schema.ts`                       |
| **Run Migrations via Script**   | `npx tsx src/db/migrate.ts`                                   | Executes migration SQL statements safely via direct MySQL connection |
| **Seed Mock Data**              | `npm run seed` (or `npm run db:seed`)                         | Idempotent per table: inserts only what's missing; `-- --reset` wipes first |
| **Open Drizzle Studio**         | `npm run studio`                                              | Launches web GUI for database tables inspection                      |
| **Build Production**            | `npm run build`                                               | Builds Nitro server bundle into `dist/`                              |
| **Start Production Server**     | `npm run start`                                               | Runs `dist/server/index.mjs` with Node.js                         |
| **Build & Start Production**    | `npm run build:start`                                         | Runs `npm run build && npm run start` sequentially                   |

---

## 5. LIVING KNOWLEDGE LOG & LESSONS LEARNED

_This section documents architectural decisions, gotchas, and solutions. Every agent MUST append new lessons here after completing major milestones or solving non-trivial issues._

### Lesson 1: Type Checking & Paraglide Runtime Initialization

- **Symptom**: `npx tsc --noEmit` fails on fresh clone with `Cannot find module '#/paraglide/runtime'`.
- **Cause**: Paraglide modules are dynamically compiled.
- **Fix**: Run `npx @inlang/paraglide-js compile --project ./project.inlang` to generate `./src/paraglide/`.

### Lesson 2: Drizzle Config & Environment Variables

- **Symptom**: `drizzle.config.ts` fails with `Type 'string | undefined' is not assignable to type 'string'`.
- **Fix**: Use non-null assertion or provide fallback defaults:
  ```typescript
  host: process.env.DB_HOST || '152.53.205.236',
  port: Number(process.env.DB_PORT) || 10146,
  user: process.env.DB_USER || 'mysql',
  password: process.env.DB_PASSWORD || 'dkqtlylo9lmgzyta',
  database: process.env.DB_NAME || 'mysql',
  ```

### Lesson 3: Dual Inventory Model in Drizzle Schema

- **Requirement**: Never use a single `status: 'in_stock' | 'sold'` column.
- **Reason**: Physical vehicle delivery and financial invoicing are independent events.
- **Implementation**: Bounded table `vehicles` must feature two distinct flags:
  - `is_delivered: boolean('is_delivered').default(false).notNull()`
  - `is_invoiced: boolean('is_invoiced').default(false).notNull()`

### Lesson 4: Unique Chassis Number (VIN) Enforcement

- **Requirement**: Prevent double-dispatching the same motorcycle across multiple orders.
- **Fix**:
  - `chassisNumber: varchar('chassis_number', { length: 50 }).notNull().unique()`.
  - Application logic validates vehicle availability before assigning to `sales_order_items`.

### Lesson 5: Batch Expense Allocation & Below-Cost Alerts

- **Risk**: Import duties and logistics can exceed vehicle purchase price, turning apparent profits into losses.
- **Fix**: Calculate `cost_price = import_price + allocated_expense` on the fly, and display a prominent alert (`CostWarningAlert.tsx`) if `selling_price < cost_price`.

### Lesson 6: TypeScript Strictness (`noUnusedLocals` & `noUnusedParameters`)

- **Symptom**: `TS6133` / `TS6192` errors when copying components or importing unused Lucide icons.
- **Fix**: Strictly prune unused imports and variables before ending turns.

### Lesson 7: Pure Business Financial Logic (`src/lib/business.ts`)

- **Architecture**: Keep all mathematical formulas (proportional expense allocation, 365-day declining balance interest, margin formulas) in `src/lib/business.ts`. Both Client UI components and Server Services consume this single source of truth without importing database drivers into client bundles.

### Lesson 8: Realistic Seed Data (`npm run seed`)

> **Historical**: the demo seed modules described here were removed (see Lesson 55); only company, roles + admin and banks are seeded now.

- **Feature**: `src/db/seed/` covers all 4 dual-inventory edge cases, multiple loan contracts, batch allocations, customer branches, and bank statement reconciliations.
- **Reset Pattern**: Always execute `SET FOREIGN_KEY_CHECKS = 0;` before truncating/deleting tables, and re-enable with `SET FOREIGN_KEY_CHECKS = 1;` to avoid FK constraint order errors (MySQL Error 1451).

### Lesson 9: Discrete Database Connection Parameters

- **Architecture**: The database is configured only through discrete variables (no combined connection URL): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Both `drizzle.config.ts` and `src/db/index.ts` utilize this structure for robust connectivity across varied proxy/cloud environments.

### Lesson 10: Codebase Comments & English Standardization

- **Standard**: All code comments (single-line `//`, block `/* ... */`, and JSX `{/* ... */}`), docstrings, and agent communications must strictly be in English.
- **Distinction**: Client UI copy and domain terminology displayed to end-users (e.g., buttons, badges, tables, and dialog titles) intentionally remain in Vietnamese for Truong Thinh Phat's staff, but developer-facing comments and architectural documentation are strictly maintained in English.

### Lesson 11: Browser Extension Hydration Mismatch (`cz-shortcut-listen`)

- **Symptom**: React logs `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties: <body cz-shortcut-listen="true">`.
- **Cause**: Browser extensions (such as ColorZilla, Grammarly, password managers, or translation add-ons) inject custom attributes like `cz-shortcut-listen="true"` into `<body>` or `<html>` before React's client-side hydration mounts.
- **Fix**: Add `suppressHydrationWarning` to `<html ... suppressHydrationWarning>` and `<body ... suppressHydrationWarning>` in `src/routes/__root.tsx`.

### Lesson 12: Route Navigation Loading Feedback & Preloading

- **Issue**: Clicking sidebar links caused an apparent lag where the sidebar item updated but the page remained frozen for a few seconds while the route loader fetched data over the network.
- **Solution**:
  1. **Router Preload & Pending Timing**: Configured `defaultPreload: 'intent'`, `defaultPreloadStaleTime: 30_000`, `defaultPendingMs: 100`, and `defaultPendingMinMs: 200` in `src/router.tsx`.
  2. **Hover Preloading**: Added `preload="intent"` to all navigation links in `AppLayout.tsx`.
  3. **Global Progress Bar**: Added a sleek animated top loading bar (`.animate-top-loading-bar`) in `src/routes/__root.tsx` and `AppLayout.tsx`.
  4. **Instant Page Skeleton**: In `AppLayout.tsx`, when `routerState.isLoading` is true, immediately displays an animated skeleton dashboard (headers, metric cards, table rows) with a "Đang tải trang..." badge and a spinning indicator on the target sidebar item instead of freezing on the previous route.

### Lesson 13: Modular Seed Architecture (`src/db/seed/`)

> **Historical**: the demo seed modules described here were removed (see Lesson 55); only company, roles + admin and banks are seeded now.

- **Structure**: The monolithic seed file (formerly `src/db/seed.ts`, ~1000 lines) was broken down into specialized, single-responsibility modules inside `src/db/seed/`:
  - `reset.seed.ts`: Resets all database tables cleanly in foreign-key safe order (`SET FOREIGN_KEY_CHECKS = 0/1`).
  - `company.seed.ts`: Seeds corporate identity (`company_info`) for Truong Thinh Phat.
  - `user.seed.ts`: Seeds system user accounts (`admin`, `accountant`, `sales`, `warehouse`) with bcrypt passwords.
  - `master-data.seed.ts`: Seeds bank catalogs, company bank accounts, suppliers, motorcycle models, and colors.
  - `customer.seed.ts`: Seeds B2B wholesale corporate customers and affiliated showroom POS branches.
  - `loan.seed.ts`: Seeds bank credit contracts and principal/interest repayments.
  - `batch.seed.ts`: Seeds import shipments, customs/freight expenses, and vehicles with automated cost allocation.
  - `sale.seed.ts`: Seeds wholesale sales orders, delivery notes, and commercial invoices demonstrating all 3 dual inventory permutations.
  - `finance.seed.ts`: Seeds cash receipt/disbursement vouchers and bank statements for transaction reconciliation.
  - `index.ts`: Orchestrates the sequential execution pipeline, closes MySQL connection pool gracefully (`db.$client.end()`), and outputs formatted login credentials.
- **Naming**: every seed module is named `<entity>.seed.ts` (singular, e.g. `loan.seed.ts`); `index.ts` is the orchestrator and `fetch-banks.ts` is a generator script, not a seed.
- **Entry point**: `src/db/seed.ts` was removed; `src/db/seed/index.ts` exports `seed()` and runs it when invoked directly, so `npm run seed` runs `tsx src/db/seed/index.ts`.

### Lesson 14: Reads/Writes via TanStack Query (`src/lib/queries.ts`)

- **Before**: routes used `loader` + `Route.useLoaderData()`, and mutations ended with `window.location.reload()` (lost UI state, full page reload).
- **Convention now**:
  - Every read is declared once as `queryOptions` in `src/lib/queries.ts` (keys per entity: `['sales']`, `['sales', id]`, `['inventory', ...]`).
  - Route: `loader: ({ context: { queryClient } }) => queryClient.query(xQuery())`; component: `useSuspenseQuery(xQuery())`. Per-row detail uses `useQuery({ ...xDetailQuery(id), enabled: id !== null })`.
  - Writes: `useMutation({ mutationFn: xFn, onSuccess: () => queryClient.invalidateQueries() })`; use `mutation.isPending` instead of `saving` state. **Never** use `window.location.reload()`.
- **Why invalidate everything**: one business action (delivery, invoice, receipt/payment voucher, statement match) changes physical stock, invoiced stock, AR/AP and the dashboard at once. Use narrow invalidation only for independent data (company profile, users in `/settings`).
- **Gotchas**: `queryClient.query` returns cached data while it is fresher than `staleTime`, so create pages (`sales.new`, `batches.new`) must `await queryClient.invalidateQueries()` before `navigate`. `QueryClient` uses `staleTime: 30_000` (master data 5 min). `/reports` changes date range inside `useTransition` so the old report stays visible while loading.

---

### Lesson 15: Per-Table Idempotent Seeding (`src/db/seed/*.ts`)

> **Historical**: the demo seed modules described here were removed (see Lesson 55); only company, roles + admin and banks are seeded now.

- **Before**: `seed()` always called `resetDatabase()` first, then every `seed*.ts` function inserted unconditionally — running `npm run seed` twice wiped and duplicated all data every time.
- **Convention now**: each `seed*.ts` function checks its own table(s) first (e.g. `seedCompany` checks `company_info`, `seedBatches` checks `import_batches`) and returns the **existing** rows (looked up by business code/number, not by position) instead of inserting when the table already has data. `seed()` in `src/db/seed/index.ts` no longer wipes anything by default — it just runs every step in order, and each step either inserts or returns what's already there.
- **Force a full reset**: `resetDatabase()` is now opt-in — pass `seed({ reset: true })` or run `npm run seed -- --reset` to wipe every table before reseeding.
- **Gotcha**: downstream steps depend on the exact shape (`{ vcb: { id }, bidv: { id }, ... }`) returned by earlier steps, so the "already seeded" branch of each function must reconstruct that same shape from existing rows (matched by `code`/`contractNumber`/`orderNumber`, not by array index) — a plain `select().from(table).limit(1) ? skip : insert` is not enough once other steps consume the return value.
- **Gotcha**: `seedBatches` must preserve vehicle insertion order (10 Batch-1 vehicles then 4 Batch-2 vehicles) when reading existing rows back, because `seedSales` indexes into `vIds` by fixed position (`vIds[0]`, `vIds[5]`, ...). Re-querying with `ORDER BY id ASC` per batch keeps that order stable.

---

### Lesson 16: Drizzle Studio "Can't add new command when connection is in closed state"

- **Symptom**: Drizzle Studio (`https://local.drizzle.studio`) shows "Drizzle Kit could not reach your database — Can't add new command when connection is in closed state", and "Try again" never recovers.
- **Cause**: `drizzle-kit studio` keeps a single long-lived `mysql2` connection. Once the remote MySQL server or a proxy drops it (idle timeout, network change, laptop sleep), the connection stays closed and the running studio process never reconnects. The database itself is healthy (verified with a fresh connection).
- **Fix**: Stop the running studio process (Ctrl+C in its terminal) and start it again with `npm run studio` (the script is named `studio`, not `db:studio`), then reload the browser tab.
- **Gotcha**: The fallback defaults in `drizzle.config.ts` use port `10146` while `.env` uses `14106`; if `.env` fails to load, studio silently targets the wrong port.

---

### Lesson 17: Spec Gap Audit — Features That Had Server Functions but No UI

- **Audit**: Compared `Tom tắt yêu cầu hệ thống trường thịnh phát.pdf` (11 modules / 44 functions) with the code. Most gaps were server functions that no route called; grep each `export const xFn` in `src/server/fns/` against `src/routes`, `src/components` and `src/lib` to find more.
- **Added**:
  - **Module 01**: public routes `/register`, `/forgot-password`, `/reset-password?token=` (shared frame `src/components/layout/AuthShell.tsx`), linked from `/login`. Registration: first user becomes an active admin; later users are inactive until an admin enables them in `/settings`. Email is not integrated: the reset link is written to the server log, and dev builds also show it on the page (`devLink`).
  - **Module 05**: `src/components/batches/BatchDetailDialog.tsx` (opened from `/batches` → Xem chi tiết) edits batch selling price setup (live preview + below-cost count + `CostWarningAlert`), adds/removes batch expenses, adds/removes vehicles (sold/delivered/invoiced vehicles are locked), and edits batch info including the financing loan. Every write runs `recalculateBatch` server-side. New `updateBatchInfoFn`; `getBatchDetailFn` now returns `isSold` per vehicle.
  - **Module 04**: `getLoanStatus` returns `batches` (linked via `import_batches.loan_contract_id`), shown in the `/loans` detail dialog.
  - **Module 10**: `/reconcile` → "Nhập Sao Kê" opens `src/components/finance/ImportStatementDialog.tsx`; paste rows from Excel (tab-separated) or load a CSV (comma/semicolon, quoted cells). Columns: Date | Reference | Description | Debit | Credit | Balance. Parsing is pure in `src/lib/statement-import.ts`: dates dd/mm/yyyy or yyyy-mm-dd; every amount separator is dropped because VND has no decimals; header rows are skipped silently; bad rows are reported by row number.
- **Gotcha**: Editing expenses or pricing after a sale changes `vehicles.cost_price` / `selling_price` but **not** the `sales_order_items.cost_price` / `unit_price` snapshots used by reports. This is intended: a sale keeps the price it was sold at.
- **Open question from the spec (section 5)**: the client crossed out "record sales, revenue and invoices", but module 07 is kept because invoiced stock, AR, revenue and profit depend on it. Confirm with the client whether only e-invoice integration is out of scope.

---

### Lesson 18: Design System (Colors, Type, Shell) — `src/styles.css`

- **Palette lives in the Tailwind scales.** Pages hardcode `emerald-*` / `slate-*` / `teal-*` hundreds of times, so `@theme` in `src/styles.css` **remaps those scales** instead of rewriting pages: `emerald` = brand jade (primary actions, positive money), `teal` = bluer jade, `slate` = ink-tinted neutrals, plus new `brass-*` (prosperity accent: brand mark, active-nav marker; use sparingly) and `ink-*` (sidebar / auth brand panel). `rose` stays reserved for losses / below-cost / errors; `amber` = warnings; `blue`/`sky` = invoiced stock; `violet`/`purple` = loans. Keep using these semantic families; don't introduce new raw hex colors.
- **Type**: `Inter` for body text and dense tables (narrow, full Vietnamese support); `Be Vietnam Pro` (`--font-display`) is applied automatically to `h1–h3`, card titles and dialog titles; VIN / engine numbers use the system monospace. Tables use `tabular-nums` globally so VND columns line up. Be Vietnam Pro as body text made tables overflow at 1440px; don't switch the body font back.
- **Primitives changed**: `Card` has no built-in `py-6 gap-6`; spacing comes from `CardHeader` (`px-5 pt-5 pb-3`, a header with `border-b` becomes a `py-3.5` toolbar) and `CardContent` (`p-5`, with no top padding right after a header). Page-level `p-0` / `py-3 px-4` overrides still win. `AlertDescription` is a block, not a grid, because a grid split inline `<strong>` text onto separate lines. `TableHead` = 11px uppercase muted header on a `bg-muted/60` row. Outline buttons use `bg-card`, not `bg-background`, because the canvas is now off-white.
- **Shell**: `AppLayout.tsx` has a dark ink sidebar on desktop (`lg+`) and a `Sheet` drawer on mobile (hamburger in the top bar). The top bar shows a group / page breadcrumb plus global quick actions (2-kho lookup, new sales order, new batch). `BrandMark.tsx` = TTP monogram; its SVG gradient id comes from `useId`, because duplicate ids inside the hidden desktop sidebar break the gradient on mobile.
- **Reusable**: `src/components/layout/StatCard.tsx` exports `StatCard` (neutral KPI tile, colour only in the icon chip) and `PageHeader`. Use them for new pages. Auth pages share `AuthShell.tsx` (split layout with ink brand panel; `showBackLink={false}` on `/login`).
- **Gotcha**: Half-width (`lg:grid-cols-2`) table cards overflow with long Vietnamese company names; side-by-side tables now use `2xl:grid-cols-2` (dashboard, reports).
- **Visual QA**: screenshots were taken with `playwright-core` driving the installed Edge (`executablePath: C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`). Wait for `load`, not `networkidle`, because Vite HMR keeps the network busy. In Git Bash, set `MSYS_NO_PATHCONV=1` or route arguments like `/` get rewritten into Windows paths.

---

### Lesson 19: Nested Routes Need a Layout With an `<Outlet />` (`/batches`, `/sales`, `/customers`)

- **Symptom**: `/batches/new` and `/sales/new` showed the *list* page instead of the create page.
- **Cause**: `batches.tsx` held the list component, so `batches.new.tsx` became its child, but the list never rendered an `<Outlet />`.
- **Fix**: `batches.tsx` / `sales.tsx` are now thin layouts (`component: Outlet`); the lists moved to `batches.index.tsx` / `sales.index.tsx` (`createFileRoute('/batches/')`). Links to `/batches` still work. Without the layout file, `tsr generate` emitted a `getParentRoute` pointing at a route that did not exist.
- **Sales**: `sales.index.tsx` list → `sales.$orderId.tsx` detail page (summary tiles for the two independent stocks, vehicle table, header actions "Giao xe thực tế" / "Xuất hóa đơn nội bộ" / "Hủy phiếu bán"). The delivery and invoice forms stay as small dialogs on that page; cancelling navigates back to `/sales`.
- **Customers**: same split (`customers.tsx` layout, `customers.index.tsx` list, `customers.$customerId.tsx` detail with branches, inline add-branch form and per-branch receivables). Detail pages should use `loader` + `useSuspenseQuery` with a numeric-id guard and an `errorComponent` for unknown ids.
- **Dev server gotcha**: never delete `src/routeTree.gen.ts` while `npm run dev` is running; the router plugin loses the file (ENOENT) and serves stale routes until the dev server is restarted. Run `npm run generate-routes` without deleting it first (it overwrites the file).
- **Detail page**: the batch detail is now the page `/batches/$batchId` (`batches.$batchId.tsx`, editors in `src/components/batches/BatchEditor.tsx`), replacing the dialog. Do the same pattern for any new list → create → detail module.

---

### Lesson 20: Query Latency — Round Trips Are the Bottleneck (`/reports`)

- **Symptom**: `/reports` took ~5.5 s to load.
- **Cause**: the database is remote (~340 ms per round trip) and `getReports` plus its helpers (`getReceivablesSummary`, `getPayablesSummary`, `getInventorySummary`) awaited ~16 independent queries **one after another**. Query execution itself was trivial; 16 × 340 ms was the whole cost.
- **Fix** (`src/server/services/reports.ts`): independent queries now run with `Promise.all` (Drizzle query builders are lazy thenables, so build them first, then await them together), and the three revenue breakdowns (by customer / month / model) share **one** query over `sales_order_items` that is aggregated in memory. Result: ~5.3 s → ~0.6–1.5 s, and the output was verified identical to the old implementation for several date ranges. Full page load measured ~1.5 s.
- **Rule**: when adding a report or loader, count round trips, not query complexity. Don't `await` queries sequentially unless one depends on another's result. The pool holds up to 10 connections (mysql2 default), so batches of ~7–10 concurrent queries are fine; a brand-new connection costs ~1.3 s once, then stays warm.

---

### Lesson 21: Bank Catalog Seed (VietQR, live API)

- **What**: `banks` is seeded with the full VietQR list (Vietnamese banks: `name`, `shortName`, `image`), fetched **live** from `https://api.vietqr.io/v2/banks?d=YYYYMMDD` every time `npm run seed` runs. There is no saved copy of the list in the repo.
- **File**: `src/db/seed/bank.seed.ts` exports `seedBanks()` (called first by `seedMasterData()`) and `fetchVietQrBanks()` (20 s timeout; throws a clear error if the API is unreachable or the response is not `code: "00"`). **Seeding therefore needs internet access.**
- **Idempotent and additive**: only banks missing from `banks` (matched by `shortName`, unique in the VietQR list) are inserted; existing rows are never overwritten. This tops up databases that already had the original 3 banks (Vietcombank, BIDV, Techcombank).
- **Behaviour change**: `seedMasterData()` used to skip everything when `banks` had rows. It now calls `seedBanks()` on every run and skips the rest (accounts, suppliers, models, colors) only when `company_bank_accounts` has rows.
- **Logo**: `banks.image` (varchar 500, nullable) stores the VietQR logo URL (migration `0001_curved_next_avengers.sql`). The seed fills it for new banks and backfills it for existing banks that have none; it never overwrites a non-empty value. **Apply the migration (`npm run migration:run`) before running the seed**, otherwise the insert fails with an unknown column `image`.
- **Showing logos**: use `BankLabel` / `BankLogo` from `src/components/finance/BankLabel.tsx` wherever a bank is picked or listed (loan form, bank-account selects in `/loans` and `/finance`, statement import, `/reconcile` chips, `/master-data` bank tab). Server queries expose `bankImage` next to `bankShortName`. Logos are wide (not square), so the box is `h-6 w-11` with `object-contain`; a neutral icon is shown when `image` is empty or fails to load.
- **Not stored**: the API also returns `bin` and `swift_code`; the schema has no columns for them. `bin` would be needed to generate VietQR payment QR codes.

---

### Lesson 22: Loan Detail Is a Page, Not a Dialog (`/loans/$loanId`)

- **Change**: the "Tính lãi & Trả nợ" dialog on `/loans` is now the page `/loans/$loanId` (`loans.$loanId.tsx`), following the pattern from Lesson 19: `loans.tsx` is a layout (`Outlet`), `loans.index.tsx` is the list (and still holds the "Tạo Khế Ước Mới" dialog), `loans.$loanId.tsx` is the detail with the interest schedule, repayment history and repayment form.
- **Behaviour**: the contract number and the action button in the list are links, so a loan has a shareable URL and the browser Back button works. The repayment form pre-fills the interest still due and re-fills it after each repayment. An unknown or non-numeric id redirects to `/loans` or shows the not-found state; batch badges on the detail link to `/batches/$batchId`.
- **Gotcha**: the sidebar highlights `/loans` for the detail page because `AppLayout` matches nav items with `startsWith`.

### Lesson 23: Customers Have No Business Code

- **Change**: `customers.code` (the "KH-xxxx" code) was removed from the schema, server functions, seed and UI (list table, create form, detail header). Customers are identified by `id` and `name`; `pos_branches.code` is unchanged.
- **Migration**: `0002_clumsy_gwen_stacy.sql` drops the `customers_code_unique` index, then the `code` column. **It permanently deletes the existing customer codes**; apply with `npm run migration:run`. Order matters: the app code no longer reads or writes `code`, but the old column is `NOT NULL` with no default, so creating a customer fails until the migration has been applied.
- **Seed**: `customer.seed.ts` finds already-seeded customers by tax code (`0315891234`, `0314789654`) instead of by code.
- **Branch codes**: the default code suggested for a new branch is now `DB-<customerId>-<n>` (it used to embed the customer code); it is still editable.

---

### Lesson 24: No Business Codes on Master Data (banks, suppliers, models, colors)

- **Change**: the `code` column was removed from `banks`, `suppliers`, `motorcycle_models` and `colors` (schema, server functions, `/master-data` tables and forms, seeds). Rows are identified by `id` and `name` (banks: `shortName`). Still kept: `pos_branches.code`, `batch_code`, loan `contract_number`, document numbers.
- **Migration**: `0003_outgoing_bruce_banner.sql` drops the four `*_code_unique` indexes, then the four columns. **It permanently deletes the existing codes**; apply it with `npm run migration:run` before using the app again (the old columns are `NOT NULL` with no default, so inserts fail until then).
- **Seeds**: `master-data.seed.ts` finds existing rows by name (`byName`) and banks by short name (`byShortName`: Vietcombank, BIDV, Techcombank); `bank.seed.ts` dedupes the VietQR list by `shortName`.
- **Engine capacity**: `motorcycle_models.engine_capacity` was removed too (schema, form, table, seed). Migration `0004_far_reaper.sql` drops the column and its data; apply it with `npm run migration:run`.
- **Brand**: `motorcycle_models.brand` ("Hãng Xe") was removed as well, and the model name column is now labelled "Tên Xe" (was "Tên Thương Mại"). Migration `0005_*.sql` drops the column; the sales-order detail and inventory-by-model queries no longer return `brand`.
- **Suppliers**: `suppliers.country`, `suppliers.phone` and `suppliers.contact_person` were removed (schema, form, tables, seed, payables report and the "(country)" suffix in supplier dropdowns); the list is titled "Danh Sách Nhà Cung Cấp". Migration `0006_*.sql` drops the three columns. Supplier `email`, `tax_code`, `address` and `note` remain in the schema.
- **Banks**: `banks.short_name` was removed; banks are identified and shown by their full `name` (`bankName` in queries, selects and chips; `bankShortName` no longer exists). Matching is case-insensitive via `normalizeBankName()` in `bank.seed.ts`, because older rows differ from VietQR only in capitalisation. Migration `0007_*.sql` drops the column.
- **Caveat**: dropping the unique codes removes the only uniqueness guard on these tables, so duplicate names are now possible. Add a unique index on `name` if that becomes a problem.

---

### Lesson 25: Active Tab in the URL, Color Picker

- **Tabs in the URL**: pages with tabs keep the active tab in the search string so a reload stays on it: `/master-data?tab=models|suppliers|banks|colors` and `/finance?tab=receivables|payables|receipts|payments`. Pattern: `validateSearch: z.object({ tab: z.enum([...]).catch('<default>') })` on the route, `const { tab } = Route.useSearch()`, and `<Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v }, replace: true })}>`. `replace: true` keeps the Back button from stepping through every tab. An unknown value falls back to the default tab. `AppLayout` shows the loading skeleton only when the **pathname** changes (`routerState.isLoading && currentPath !== targetPath`); a search-only change such as switching a tab keeps the page and its tab bar on screen. Use this for any new tabbed page.
- **Color picker**: `src/components/ui/color-picker.tsx` (`ColorPicker`, `normalizeHex`) combines the browser's native color wheel (`<input type="color">`), a hex text box kept in sync, and preset swatches for common bike colors. Used in the add-color dialog on `/master-data`; the form normalises "#abc" to "#aabbcc" and refuses to save a malformed hex.

---

### Lesson 26: Ending a Session Remotely (deactivate user → automatic logout)

- **Server**: `authMiddleware` throws an Error whose message starts with `UNAUTHENTICATED` (`src/lib/auth-errors.ts`) when the cookie has no valid session. `getUserBySessionToken` already rejects inactive users, so a deactivated account stops working on its very next request. `saveUserFn` additionally **deletes the user's rows in `sessions`** when the account is deactivated or an admin sets a new password, so an old cookie cannot come back to life if the account is re-activated later.
- **Client**: `src/integrations/tanstack-query/root-provider.tsx` registers `QueryCache`/`MutationCache` `onError` handlers. Any query or mutation failing with `UNAUTHENTICATED` triggers `window.location.href = '/login'` (a full load, so no stale user data stays in memory). It is skipped on `/login` and runs once.
- **Verified end to end** (Playwright, two browser contexts): user "kho" logged in → admin deactivates "kho" in `/settings` → "kho" clicks a sidebar link → lands on `/login`; logging in again is refused ("tài khoản chưa được kích hoạt").
- **Limits**: logout happens on the *next server call*, not instantly (there is no push). Pages shown from the 30 s query cache can keep rendering until something refetches. `changePasswordFn` (a user changing their own password) does not end their other sessions.
- **Convention**: new server functions must use `authMiddleware` / `adminMiddleware` so they return this error; do not throw your own "session expired" text.

---

### Lesson 27: Customer Contact Fields Removed; "Whole App Is Broken" Triage

- **Customers**: `customers.tax_code`, `customers.phone` and `customers.contact_person` were removed (schema, list columns, create form, detail header, seed, sales-order detail, AR summary). Migration `0008_*.sql` drops them (existing data is lost). `customers.address` was removed as well (migration `0009_*.sql`): a customer now has only a name, and the create dialog has just that one field, no description line. Branches (`pos_branches`) later lost `code`, `tax_code`, `address` and `phone` too (migration `0010_*.sql`; a branch is now just a `name`, plus an unused `contact_person`), the branch name label is "Tên Điểm Bán", and the customer detail page has no summary cards. Branch lookups in the seed use the name; the receivables summary no longer returns `taxCode`. `customer.seed.ts` now finds existing customers by name. `getCustomerDetailFn` and `getCustomerStatement` run their independent queries with `Promise.all` (detail page ~2.4 s → ~1.1 s).
- **Symptom**: the whole site slow, every click reloads the page, buttons that open dialogs do nothing. **Cause seen**: the dev server's Vite cache held an *empty* transform of `src/integrations/tanstack-query/root-provider.tsx` (file was caught mid-rewrite), so the browser logged `The requested module ... does not provide an export named 'getContext'`, React never hydrated, and the page behaved like plain server HTML. **Check**: `curl http://localhost:3000/src/<file>` and look for the exports, or open the browser console. **Fix**: touch the file (`touch <file>`) or restart `npm run dev`, then hard-refresh (Ctrl+F5).
- **Prevention**: avoid rewriting a module with `cat >` / truncate-then-write while the dev server runs; write the file in one step (editor/Edit tool) so the watcher never sees an empty file.
- **Measured** (Playwright, admin, port 3000): sidebar navigation 90–150 ms when data is cached, ~1.4 s the first time a page loads (remote database round trips), 0 full page loads.

---

### Lesson 28: Drizzle Drops Table Names in Single-Table Selects (correlated subqueries)

- **Bug**: in a `db.select(...).from(table)` with **no join**, Drizzle renders `${table.id}` as a bare `id`. Inside a raw correlated subquery (`(select count(*) from pos_branches b where b.customer_id = ${customers.id})`) that bare `id` binds to the _subquery's_ own table, so the comparison is silently wrong. Symptoms found: the customer list said "1 điểm bán" for a customer with 2 branches, and the inventory "unsold" count was wrong.
- **Rule**: in raw `sql` subqueries inside a single-table select, write the outer column literally and qualified (`customers.id`, `vehicles.id`). With a join Drizzle qualifies columns itself, so `${table.col}` is safe there. When unsure, check `query.toSQL().sql`.
- **Fixed**: `listCustomersFn` (branch count) and `getInventoryTotals` (unsold). Verified against plain SQL (unsold = 7 both ways).
- **Customer list columns**: besides the branch count, the list shows **Còn Nợ** only (no paid column), the sum of the amount still owed over the customer's branch entities (from `getReceivablesSummary()`).

---

### Lesson 29: Bank Statement Import — No Reference Column, No Auto-Match, Dialog Width

- **Reference removed**: `bank_statement_lines.reference` ("Mã Tham Chiếu") is gone (schema, import service, server validator, seed, reconcile table, import preview). Migration `0011_*.sql` drops the column. The **paste/CSV column order is now `Date | Description | Debit (money out) | Credit (money in) | Balance (optional)`** (`src/lib/statement-import.ts`, the "Dán mẫu" sample and the dialog hint were updated). Anyone pasting the old 6-column layout will get shifted columns.
- **Statement period and note removed**: `bank_statements.period_from`, `period_to` and `note` are gone (schema, import dialog, server, seed). A statement is now just a bank account + file name + its lines. Migration `0012_*.sql` drops the three columns. **Importing a statement fails until this migration is applied**, because the old `period_from` / `period_to` columns are `NOT NULL` with no default. The statement chips on `/reconcile` show `<bank name> (<account number>)` and statements are ordered newest first by id.
- **Import is an editable table**, not a text box: `ImportStatementDialog` has rows of date | description | debit | credit with a delete button per row and "Thêm dòng". Entering a debit clears the credit of that row (one side only). Pasting several lines copied from Excel into any cell fills the table (`parseStatementText`). Blank rows are ignored; a partly filled row blocks submit with a message. Statement `balance` is no longer collected (sent as `null`).
- **Per-row loading state**: a button that triggers a mutation must show progress. Pattern (`/reconcile` "Hủy khớp"): `mutation.variables` identifies the row while `mutation.isPending`, then show `Loader2` + "Đang ..." and disable the other buttons. `onSuccess: () => queryClient.invalidateQueries()` returns a promise, so the pending state also covers the data refresh. "Xác Nhận Khớp" shows a spinner the same way. The suggestion dialog is `sm:max-w-4xl` (wider only; text sizes unchanged).
- **Stable columns**: the `/reconcile` transactions table uses `table-fixed` with explicit column widths (`w-28`, `w-44`, `w-44`, `w-56`, `w-36`, description takes the rest and truncates). Without it the columns resized whenever lines changed between "Tìm khớp" and the long matched badge + "Hủy khớp", so the table jumped. Use fixed layout for any table whose cells change with status. The statement picker is a `Select` dropdown, not a row of buttons.
- **Long select values**: banks are shown by full name (`Ngân hàng TMCP … (account number)`), which is wider than half a 512 px dialog. The base `SelectTrigger` now has `max-w-full min-w-0` and its value slot `min-w-0`, so a long value is cut off instead of pushing the control out of its dialog. Bank-account selects get `w-full` and their own row (receipt / payment voucher dialogs stack "Hình Thức" above "Tài Khoản"), because truncation would otherwise hide the account number. Verified: no select overflows the receipt, payment or new-loan dialogs.
- **Auto-match removed**: the "Tự Động Đối Chiếu Nhanh" button, `autoMatchStatementFn` and `autoMatchStatement()` no longer exist. Matching is manual only ("Tìm khớp" → suggestions via `suggestMatchesFn`).
- **Dialog width pitfall**: the base `DialogContent` (`src/components/ui/dialog.tsx`) ends with `sm:max-w-lg` (512 px). A plain `max-w-3xl` / `max-w-xl` / `max-w-md` class on a `DialogContent` is **ignored** at `sm` and up, so those dialogs are all 512 px wide. Use the prefixed form (`sm:max-w-5xl`) to really change it, as the import dialog now does (1024 px). Other dialogs still carry the ineffective classes.

---

### Lesson 30: Receipt Vouchers Without Number / Method; "Too many connections"

- **Receipt vouchers**: `receipt_vouchers.voucher_number` ("Số Phiếu Thu") and `receipt_vouchers.method` ("Hình Thức") were removed (schema, service, server fns, seed, `/finance` receipts table and receipt dialog). The bank account is always saved with the receipt (choose "Không chọn (tiền mặt)" for none). Because a receipt no longer has a number, the bank-statement suggestion for a money-in line labels it with the **customer name**. Migration `0013_*.sql` drops the unique index and both columns. **Creating a receipt fails until it is applied** (`voucher_number` is `NOT NULL` with no default). `payment_vouchers` lost the same fields: `voucher_number`, `method` and also `batch_id` ("Lô Xe Liên Quan", with its foreign key); a payment is now supplier/payee + amount + optional bank account + description. Migration `0014_*.sql` drops them (it was regenerated once to include `batch_id` because it had not been applied yet). The payment suggestion on `/reconcile` is labelled by the supplier or payee name, the `/finance` page no longer loads the batch list, and `PAYMENT_METHODS` no longer exists. **Creating a payment fails until 0013 and 0014 are applied.**
- **Symptom**: every page shows "Something went wrong!" and the log says `Failed query: select ... from sessions ...`; the cause is `Too many connections` (MySQL `max_connections` = 151, shared by everything that connects).
- **Cause**: Vite re-evaluates `src/db/index.ts` on every hot reload of a server file, and each evaluation created a **new connection pool** whose idle connections stayed open until MySQL's 8 h `wait_timeout`. Over a long dev session (plus a forgotten second `npm run dev` process) 146 idle connections piled up. Stopping a dev server through a task runner can leave the child `vite` process (and its pool) running on another port, so check `netstat -ano | findstr LISTENING` for leftovers.
- **Fix** (`src/db/index.ts`): the `drizzle()` instance is cached on `globalThis` (one pool per process, reused across reloads) and the pool is capped (`connectionLimit: 5`, `maxIdle: 2`, `idleTimeout: 60 s`).
- **Diagnose / free**: `select user, db, substring_index(host,':',1) client, command, count(*), max(time) from information_schema.processlist group by 1,2,3,4`; then `KILL <id>` for `Sleep` rows idle for a long time (the app reconnects by itself). Do not `Stop-Process` another project's server: this machine also runs an unrelated backend ("ong xanh") on port 3000 (IPv4).

---

### Lesson 31: Dialog Content Overflowing Its Right Padding

- **Symptom**: In a dialog, form fields had normal padding on the left but nearly touched the right edge.
- **Cause**: `DialogContent` is a CSS grid with an implicit `auto` column, which grows to the min-content width of its widest child (e.g. a Select showing a long bank name) and overflows the padding.
- **Fix**: `DialogContent` in `src/components/ui/dialog.tsx` now uses `grid-cols-[minmax(0,1fr)]`, so children are capped at the dialog's inner width.

---

### Lesson 32: Receipt Vouchers Without a Note

- **Change**: `receipt_vouchers.note` ("Ghi Chú") was removed (schema, service, server fns, seed, receipt dialog). Migration `0015_amazing_machine_man.sql` drops the column; apply it with `npm run migration:run` (it is the third pending migration after 0013 and 0014). The column is nullable, so creating receipts keeps working before it is applied. Loan repayment, batch and sales notes are unchanged.

---

### Lesson 33: App Port Comes From `.env` (`PORT`)

- **Change**: the port is no longer hardcoded in `package.json`. `PORT` in `.env` (default `3000`) drives `npm run dev` and `vite preview` through `loadEnv` in `vite.config.ts` (`strictPort: true`, so a busy port fails loudly instead of silently moving). `npm run start` runs `node --env-file-if-exists=.env dist/server/index.mjs`, so Nitro reads the same `PORT`.
- **Gotcha**: `vite.config.ts` now uses the `defineConfig(({ mode }) => ...)` function form. Restart the dev server after editing `PORT`. Docker is unaffected: the image sets `PORT=3000` itself and `.env` is not copied into it. `docker:prod` maps host `3001` to container `3000`.
- **Not verified**: `node_modules` was missing when this was made, so `npx tsc --noEmit` and a dev-server run were not executed.

### Lesson 34: `DEFAULT (now())` Fails on Older MySQL / MariaDB

- **Symptom**: `npm run migration:run` on the server fails at the first `CREATE TABLE` with `ER_PARSE_ERROR ... near '(now())'`.
- **Cause**: drizzle-kit renders `timestamp().defaultNow()` as `DEFAULT (now())`, an expression default that only MySQL >= 8.0.13 accepts. MariaDB and MySQL 5.7 reject it.
- **Fix**: `0000_wet_sentinel.sql` now uses `DEFAULT CURRENT_TIMESTAMP` (45 occurrences), which every version accepts and behaves identically. Databases that already applied `0000` are unaffected, since migrations are tracked by file name only.
- **Gotcha**: if `npm run db:generate` ever emits `DEFAULT (now())` again for a new column, replace it with `DEFAULT CURRENT_TIMESTAMP` by hand before committing.

### Lesson 35: Seed Finds Banks by Keyword, Not Exact Name

- **Symptom**: `npm run seed` on the server fails with `Expected bank "Ngân hàng TMCP Ngoại Thương Việt Nam" but found none` right after inserting 76 banks.
- **Fix**: `master-data.seed.ts` now locates Vietcombank / BIDV / Techcombank with `bankByKeyword` (`ngoai thuong`, `dau tu va phat trien`, `ky thuong`) against `foldBankName()` (lowercase, no diacritics, in `bank.seed.ts`), so renamed or differently-normalised names still match. `normalizeBankName` also applies NFC.
- **Gotcha**: if the keyword still isn't found, the stored names are probably garbled (`?`) because the database or table charset is not `utf8mb4` (common on old MySQL/MariaDB defaults of latin1). Check with `SELECT name FROM banks LIMIT 5;` and `SHOW CREATE TABLE banks;`, then convert the database to `utf8mb4`.

---

### Lesson 36: Loan Contracts Without Maturity Date / Status; Slimmer Loan List

- **Change**: `loan_contracts.maturity_date` and `loan_contracts.status` were removed (schema, server fns, seed, loan form, list and detail page, reports). The `/loans` list no longer shows the three summary cards or the columns Hạn Mức Vay, Ngày Giải Ngân, Ngày Đáo Hạn and Trạng Thái. Migration `0016_gigantic_bloodstrike.sql` drops both columns; apply it with `npm run migration:run`. **Saving a loan contract fails until it is applied** (`maturity_date` is `NOT NULL` with no default).
- **Kept on purpose**: `principal_amount` and `disbursement_date` stay in the table because the declining-balance interest (`calculateLoanInterest`), outstanding balance and reports need them; they are only hidden from the list (the detail page still shows them).
- **Status is derived**: `listLoansFn` and `getLoanStatus` return `status` as `'settled'` when `principal - principalPaid <= 0.5`, else `'active'`. `recordLoanRepayment` no longer updates a status column. Consumers (dashboard active-loan count, loan picker in `/batches/new`, detail badge) keep reading `status` unchanged. `LOAN_STATUSES` no longer exists.
- **Reports**: the loans list in `getReports` is now ordered by `disbursement_date` (it used to be by maturity date).

---

### Lesson 37: Loan Contracts Without a Note

- **Change**: `loan_contracts.note` ("Ghi Chú") was removed (schema, server fns, seed, new-loan dialog). Migration `0017_uneven_red_skull.sql` drops the column; apply with `npm run migration:run`. The column is nullable, so saving a loan keeps working before it is applied, but `maturity_date` (Lesson 36) is still `NOT NULL` until `0016` runs. Repayment notes (`loan_repayments.note`) are unchanged.

---

### Lesson 38: Money Inputs Show Thousands Separators (`MoneyInput`)

- **Change**: every VND amount box uses `MoneyInput` (`src/components/ui/money-input.tsx`), which displays `1.500.000` (vi-VN grouping) while typing. It is a `type="text"` / `inputMode="numeric"` input: non-digits are stripped, the value is a whole number. API: `value` (number or `''`), `onValueChange(n: number)`, optional `blankZero` to show an empty box for 0 (used in the statement import table, whose state is a string).
- **Where**: receipt/payment dialogs (`/finance`), new loan principal and loan repayments, batch expenses / vehicle import prices / pricing amount (`batches.new`, `BatchEditor`), sale unit prices (`sales.new`), statement debit/credit.
- **Not converted on purpose**: percentages and the interest rate stay `type="number"` (they need decimals): `loans.index` interest rate and the "percent" branch of the batch pricing value. Pricing inputs switch between `Input` (percent) and `MoneyInput` (fixed amount).
- **Decimals (rates, percentages)**: `DecimalInput` (`src/components/ui/decimal-input.tsx`) shows Vietnamese separators while typing: `.` groups thousands, `,` is the decimal mark (`1.234,5`, `0,234`); other characters are ignored, a leading zero is dropped (`09` → `9`), and `maxDecimals` caps the digits after the comma. Set it to the database scale: loan interest rate 3 (`decimal(6,3)`), batch pricing percent 2 (`decimal(18,2)`). API: `value` (number) + `onValueChange(n)`. Used for the loan interest rate and the percent pricing in `batches.new` / `BatchEditor`; there are no `type="number"` boxes left in the app routes.
- **Leading zeros**: the shared `Input` (`src/components/ui/input.tsx`) drops a leading zero in every `type="number"` box as soon as a digit follows it (a controlled number input keeps the typed text, so 0 then 9 used to show "09"): "0"+"9" → "9", "007" → "7", "0.5" is left alone. `MoneyInput` already does this by keeping digits only.
- **Gotcha**: `min` / `step` / native `required` number validation no longer apply to these boxes; guard amounts in the server validators (`z.number().positive()` is already there).

---

### Lesson 39: Table Pagination (`usePagination` + `TablePagination`)

- **What**: every list table is paginated client-side (all lists are already fully loaded) with `src/components/ui/table-pagination.tsx`: `usePagination(items, resetKey?)` returns `{ pageItems, page, pageSize, pageCount, total, setPage, setPageSize }` (default 10 per page; options 10 / 20 / 50 / 100) and `<TablePagination pagination={pg} />` renders "Hiển thị 11–14 / 14", the rows-per-page select, numbered page buttons with "…" gaps, prev/next and "Trang x / y". The footer is always shown, except for an empty list.
- **Usage**: call the hook unconditionally near the data query (`const ordersPg = usePagination(orders)`), map over `ordersPg.pageItems`, and put `<TablePagination pagination={ordersPg} />` right after the table's scroll container (inside `CardContent`, not inside the `overflow-x-auto` div, so it does not scroll sideways). Pass a `resetKey` for lists that are filtered or switch source (inventory search/filter, reports date range, reconcile statement) so the table returns to page 1. The page is clamped, so a list that shrinks never leaves you on a missing page.
- **Paginated**: batches, customers (list, branches, receivables), sales (list, order items), loans (list, repayments), finance (4 tabs), master data (4 tabs), inventory, bank statement lines, reports (revenue by customer / model), users in `/settings`.
- **Not paginated on purpose**: editable entry tables (new batch expenses/vehicles, new sale items, statement import rows, batch editor), the vehicle picker dialog, the loan interest schedule, dashboard "recent" top-6 lists and the small expense summary.
- **Gotcha**: row keys that used the array index (`key={idx}`) are now page-relative; that is fine because React only compares siblings of the current page.

---

### Lesson 40: Company Bank Accounts Tab in Master Data

- **What**: `/master-data?tab=accounts` ("Tài Khoản Ngân Hàng") lists, creates, edits and deletes the company's own bank accounts (`company_bank_accounts`: account name, bank, account number, branch, active flag). Bank accounts are chosen in receipts, payments, loan repayments and statement import, so they must be maintained here first. No schema change: `saveBankAccountFn` / `deleteMasterDataFn('companyBankAccounts')` and the `bankAccounts` list in `getMasterDataFn` already existed; only the UI was missing.
- **Behaviour**: the account number is unique; deleting an account that is used by a voucher, repayment or statement fails with the "đang được sử dụng" message, so set it to "Ngừng dùng" (inactive) instead. Inactive accounts are hidden from the dropdowns in the finance dialogs.
- **Distinction**: the "Ngân Hàng" tab is the catalogue of banks (VietQR list); this tab is the company's own accounts at those banks.

---

### Lesson 41: Searchable Dropdowns for Table-Backed Options (`SearchSelect`)

- **Rule**: a dropdown whose options come from a table (banks, bank accounts, customers, branches, suppliers, models, colors, loans, statements) uses `SearchSelect` / `SearchSelectItem` from `src/components/ui/search-select.tsx`: a popover with a search box on top. Dropdowns with a fixed, short list of choices (pricing method / base, expense type, user role, rows per page) keep the plain Radix `Select`.
- **API**: drop-in shape of `Select` without the trigger/content wrappers: `<SearchSelect value="12" onValueChange={...} className="h-8 w-full text-xs" placeholder="Chọn..."><SearchSelectItem value="12">label or JSX</SearchSelectItem>…</SearchSelect>`. `value` is a string (use `'none'` for a "no selection" item). The trigger shows the selected item's children; search matches the text of the children (also inside JSX such as `BankLabel`), ignoring case and Vietnamese diacritics ("ngoai thuong" finds "Ngoại thương"). Arrow keys + Enter pick an option.
- **Load more**: only the first 10 matching options are rendered; scrolling the list to its end (or pressing the footer / arrow-down past the last option) adds 10 more, and a new search or reopening resets to 10. The options are already in memory (the lists come from the cached master-data / list queries), so this is windowing, not a server call per page.
- **Why not Radix `Select`**: its items steal focus on pointer move and handle typeahead keys, so a search input inside the content cannot be typed in reliably. `SearchSelect` is built on `Popover`; the list stops wheel events so it scrolls inside modal dialogs.
- **Gotcha**: `SearchSelectItem` renders nothing on its own; `SearchSelect` reads only its direct children (arrays are fine, wrapping items in a fragment or custom component is not).

---

### Lesson 42: Sales Orders Without an Order Number

- **Change**: `sales_orders.order_number` ("Mã Phiếu", `PBX-yymmdd-nnn`) was removed (schema, creation service, server fns, seed, reports, UI). The `/sales` list has no number column (the page title is now "Bán Hàng"); the detail page title is `Phiếu bán #<id>`; the dashboard recent-orders list shows the order date; the inventory "Đơn Bán" column shows a "Xem phiếu bán" link to `/sales/$orderId`. Migration `0018_small_legion.sql` drops the unique index and the column. **Creating a sales order fails until it is applied** (`order_number` is `NOT NULL` with no default). Delivery notes and invoices keep their own numbers.
- **Seed**: `sale.seed.ts` finds the three already-seeded orders by `order_date` (2026-01-20 / 01-25 / 02-05) instead of by number.

---

### Lesson 43: Sales Orders Without a Note; No Stat Cards on the Sale Detail

- **Change**: `sales_orders.note` ("Ghi Chú Đơn Hàng") was removed (schema, create service and validator, list/detail queries, seed, new-sale form). Delivery notes and invoices keep their own `note` columns. Migration `0019_*.sql` drops the column; apply with `npm run migration:run` (the column is nullable, so creating a sale still works before it runs, but `0018` must be applied first because `order_number` is `NOT NULL`). The create page is titled "Lập Phiếu Bán Xe Mới", the list "Bán Hàng", and the sale detail page no longer shows the three summary cards (total, physical stock, invoiced stock); the per-vehicle status badges in the table remain.

---

### Lesson 44: Import Batches Without a Code or Customs Declaration Number

- **Change**: `import_batches.batch_code` ("Mã Lô", e.g. LO-2026-02-INDO) and `import_batches.customs_declaration_no` ("Số Tờ Khai Hải Quan") were removed (schema, create/update services and validators, queries, seed, create-batch form, batch editor, batch list). Migration `0020_strong_cloak.sql` drops the unique index and both columns; apply with `npm run migration:run`. **Creating a batch fails until it is applied** (`batch_code` is `NOT NULL` with no default).
- **Batch display name**: since a batch has no code, every place that showed it uses `batchLabel({ importDate, supplierName })` from `src/lib/business.ts`, e.g. "Lô 20/02/2026 · PT Astra Honda Motor" (inventory lot badge and search, vehicle picker in a new sale, batches listed under a loan). The vehicle inventory query and the loan batches query therefore also join `suppliers`. The batch list has no code column (Ngày Nhập and Nhà Cung Cấp identify the row) and the detail page title is "Lô nhập dd/mm/yyyy".
- **Caveat**: two batches from the same supplier on the same day look identical in these labels; open them by row link / id instead.
- **Seed**: `batch.seed.ts` finds already-seeded batches by `import_date` (2026-01-15 / 2026-02-20).

---

### Lesson 45: Confirmation Dialogs Instead of `window.confirm`

- **Rule**: never call `window.confirm`. Use `confirmDialog` from `src/components/ui/confirm-dialog.tsx`: `if (!(await confirmDialog({ title: "Xóa ...?", description: "...", confirmLabel: "Xóa", destructive: true }))) return`. It returns a Promise<boolean> (true = confirmed; Esc, Cancel or a click outside = false). `destructive` makes the confirm button red; `cancelLabel` / `confirmLabel` override the default "Hủy" / "Xác nhận".
- **How it works**: a module-level function opens a single `<ConfirmDialogHost />` (built on the shadcn `AlertDialog`) that is mounted once inside `AppLayout`, so any page that uses `AppLayout` can call it without extra markup. Without a host it falls back to the browser dialog.
- **Converted**: removing a batch expense or a vehicle (`BatchEditor`), deleting master data (`/master-data`), cancelling a sales order (`sales.$orderId`). Error messages still use `alert()` in many forms; replace them with toasts (`sonner`) if that is wanted.

---

### Lesson 46: Role & Permission Based Access (RBAC)

- **Model**: `roles` (name, description, `is_admin`), `role_permissions` (role_id + permission key) and `users.role_id` (the old `users.role` enum is gone). A role flagged `is_admin` implicitly holds every permission and cannot be edited or deleted. The permission **catalogue lives in code**: `src/lib/permissions.ts` (`PERMISSION_GROUPS`, e.g. `sales.create`, `finance.manage`, `roles.manage`); which role holds which permission is data, edited by admins in **/settings → Vai Trò & Phân Quyền** (`src/components/settings/RolesTab.tsx`). Admins create a role, tick permissions, then assign the role to users in **Quản Lý Người Dùng**.
- **Session user**: `getUserBySessionToken` returns `{ roleId, roleName, isAdmin, permissions[] }` in ONE query (session + user + role + permissions), so a role change applies on the user's next request without re-login.
- **Server enforcement**: use `requirePermission('x.view', ...)` (`src/server/fns/middleware.ts`) instead of `authMiddleware` on every server function that reads or changes protected data (any one of the listed permissions is enough). `adminMiddleware` / `assertRole` were removed. Left on plain `authMiddleware` on purpose: lookups used by many forms (`getMasterDataFn`, `listCustomerOptionsFn`, company profile). The dashboard data functions also accept `dashboard.view`. When adding a server function, pick its permission; when adding a feature, add keys to `PERMISSION_GROUPS` and, if wanted, to `DEFAULT_ROLES`.
- **UI enforcement**: sidebar items and the top-bar quick actions are filtered by permission; each route calls `requirePagePermission(user, key)` (`src/lib/route-guard.ts`) in `beforeLoad`, which redirects to the first page the role may open (`landingPath`); action buttons are wrapped in `<Can permission="...">` (`src/components/auth/Can.tsx`); the batch detail editor is a disabled `<fieldset>` without `batches.manage`. /settings is open to everyone (own password); its tabs follow `company.manage` / `users.manage` / `roles.manage`. Not every secondary button is hidden (e.g. match / unmatch on /reconcile, add-branch on a customer page): the server still rejects the call with "Bạn không có quyền thực hiện thao tác này".
- **Default roles** (Quản trị, Kế toán, Kinh doanh, Thủ kho) are created by migration `0021_sleepy_ghost_rider.sql` (which also back-fills `users.role_id` from the old enum) and by `seedRoles()` (`src/db/seed/role.seed.ts`) on fresh databases. `0022_eager_green_goblin.sql` then makes `role_id` NOT NULL and drops `role`. **Apply both with `npm run migration:run` before using the app: until then every request fails** (the session query joins `roles`). Self-registered accounts get the non-admin role with the fewest permissions (the first user ever becomes admin) and stay inactive until an admin approves them.
- **Gotcha**: `drizzle-kit generate` asks interactively whether `role_id` is a rename of `role` and aborts without a TTY. The migrations were generated in two steps instead (additive schema first, then the final schema) and the data statements were appended to 0021 by hand. The data statements were checked against TEMPORARY tables only (the database user cannot create databases).
- **Safety rules**: an admin cannot lock or demote their own account; a role cannot be deleted while users hold it; the Quản trị role is read-only.

### Lesson 47: Global Dialog Popups Instead of `window.alert`

- **Rule**: NEVER call `window.alert` or `alert()`. Use `alertDialog` or `showErrorDialog` from `src/components/ui/confirm-dialog.tsx`:
  - `await alertDialog('Vui lòng chọn vai trò')` or `await alertDialog({ title: 'Cảnh báo', description: '...', destructive: true })`.
  - In `catch` blocks: `await showErrorDialog(err, 'Lỗi khi lưu dữ liệu')`.
- **Zod / API Error Formatting**: `showErrorDialog` automatically parses stringified Zod issues/JSON errors (e.g., `[{"code":"too_small","minimum":8,"path":["password"]}]`), maps field keys to friendly Vietnamese labels (`Mật khẩu: Tối thiểu 8 ký tự`), and presents them in a clean, styled Shadcn `AlertDialog` with a single "Đóng" / "Đã hiểu" button.
- **Global Mounting**: `<ConfirmDialogHost />` is mounted at root in `src/routes/__root.tsx`, guaranteeing availability across all routes including auth pages and modals without duplicate hosts.

### Lesson 48: Inline Field Errors Instead of Popups in Forms

- **Rule**: for form validation, show the message directly under the offending input, not in a popup. `src/lib/form-errors.ts` exports `parseFieldErrors(err)` which turns stringified Zod v4 issues into `{ field: 'Vietnamese message' }` (returns `{}` for non-validation errors, which should go in an `<Alert variant="destructive">` banner inside the form).
- **Pattern** (see the user dialog in `src/routes/settings.tsx`): `noValidate` on the `<form>`, client-side checks first, `aria-invalid` on the input (shadcn styles it red), a `<p className="text-[11px] font-medium text-rose-600">` below it, and clear that field's error in `onChange`. Reset errors when the modal opens.
- **Scope**: only the user dialog is converted so far; other forms still use `showErrorDialog`.

---

### Lesson 49: One Style for Every Text Input

- **Rule**: inputs (`Input`, `MoneyInput`, `Textarea`) carry no per-field look. Do not add `font-mono`, `font-bold` / `font-semibold`, a text colour (`text-emerald-900`, ...) or `bg-white` to them; the only class overrides allowed are sizing and alignment (`h-8 text-xs`, `h-7` in table cells, `text-right`, `w-*`). The base `Input` (`src/components/ui/input.tsx`) now has a solid `bg-card` background, so a field looks the same on the page canvas, in a card, in a dialog or on a tinted panel (it used to be transparent, which is why some pages added `bg-white`).
- **Why**: the "Tên Đăng Nhập" field was monospace while the other fields of the same dialog were not (and amounts / codes were bold or coloured in other forms), which looked inconsistent.
- **Not affected**: monospace is still fine for read-only display of identifiers (VIN, engine number, account number in tables and badges), just not inside inputs.

---

### Lesson 50: Browser Validation Bubbles Replaced by Inline Vietnamese Messages (all forms)

- **Problem**: native HTML validation (`required`, `type="email"`, `min`, `minlength`, `pattern`) shows the browser's own bubble in the browser's language ("Please fill out this field.").
- **Solution**: `FieldValidationHost` (`src/components/ui/field-validation.tsx`, mounted once in `src/routes/__root.tsx`) listens to the `invalid` event in the capture phase (it does not bubble), cancels the bubble, writes a Vietnamese message in a `<p data-field-error role="alert">` right after the control, sets `aria-invalid="true"` (red border from the base input styles) and focuses the first invalid field. The message disappears as soon as the user edits the field. The browser still performs the checking and blocks the submit, so **existing forms need no change**: keep using `required`, `type="email"`, `min`, `minlength`, `pattern`.
- **Wrapped controls** (nested wrappers use the outermost one): a control inside a relative box with an icon or eye button must have that box marked `data-field-wrap`; the message is then inserted after the box (otherwise it stretches the box and the icons slide down). `PasswordInput` and the login fields do this.
- **Messages** (`messageFor`): empty → "Vui lòng nhập thông tin này" ("Vui lòng chọn ngày" for date fields, "Vui lòng chọn một giá trị" for select / checkbox), bad email → "Email không hợp lệ", `minlength` / `maxlength` → "Tối thiểu / Tối đa N ký tự", `min` / `max` → "Giá trị tối thiểu / tối đa là N", `pattern` → the input's `title` or "Định dạng không hợp lệ".
- **Server-side / custom checks** still use the pattern from Lesson 48 (`parseFieldErrors`, your own `<p>` + `aria-invalid`, `noValidate`); they are not touched by this host.
- **Gotchas**: the message is inserted as the control's next sibling, so keep a field's control and its label in the same wrapper (`div.space-y-1`). Custom components that are not real form controls (`SearchSelect` is a button) are not validated by the browser: check them in the submit handler.

---

### Lesson 51: Refused Deletes Explain What Uses the Row (names + links)

- **Behaviour**: when a delete is refused because other records still use the row, the user sees "Không thể xóa "<name>"" with the list of those records grouped by type (e.g. "Lô nhập có xe dùng mục này (3)"), each a link to its detail page, and "… và N mục khác" when more than 30. The dialog is the global alert dialog (`showUsageDialog` in `src/components/ui/confirm-dialog.tsx`, which accepts `groups` in `AlertOptions`); clicking a link closes it and navigates.
- **Server**: `getUsageFn({ entity, id })` (`src/server/fns/usage.ts`) returns the groups for `banks`, `companyBankAccounts`, `suppliers`, `motorcycleModels`, `colors`, `roles`, `vehicles` (a vehicle in a sales order) and `loans` (batches financed by it and recorded repayments; `deleteLoanContractFn` refuses to delete such a loan, so repayment history is never lost through the cascade; the trash button is in the `/loans` list). Groups with no records are dropped, so an empty result means the failure had another cause. Needs `master-data.manage`, `roles.manage` or `batches.manage`.
- **Client rule (check first, then confirm)**: every delete starts with `confirmDelete({ entity, id, name }, { title, description })` from `src/lib/usage.ts`: it asks `getUsageFn` first; if something uses the row it shows the usage list and returns `false` (no confirmation is shown); if nothing uses it, it shows the normal confirmation and returns the answer. Keep `reportDeleteFailure(err, target, fallback)` in the `catch` of the actual delete as a safety net for the race where the row became used in between. Already used by master data (all 5 tabs), roles and removing a vehicle from a batch (`useBatchMutation` takes an `onFail` callback). Removing a batch expense is never blocked, so it keeps the plain `confirmDialog`. **A new deletable entity needs a `case` in `usageOf` and an entry in `USAGE_ENTITIES`.**
- **Foreign-key detection**: `isReferencedError` (`src/server/services/common.ts`) reads MySQL errno 1451 / `ER_ROW_IS_REFERENCED*` through the whole `cause` chain, because Drizzle wraps driver errors as "Failed query: ...". `formatErrorMessage` never shows a message that starts with "Failed query".

---

### Lesson 52: List Filters and Search Live in the URL

- **Pattern** (same idea as the tabs in Lesson 25): a page's filter and search box are search params, not `useState`, so a reload, the Back button or a shared link keeps them. `/inventory?stock=all|physical|invoiced|mismatch|available&q=<text>`: `validateSearch: z.object({ stock: z.enum([...]).optional().catch(undefined), q: z.string().optional().catch(undefined) })`, read with `Route.useSearch()` (`stock ?? 'all'`, `q ?? ''`), written with `navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true })`.
- **Search text is debounced**: never `navigate` on every keystroke (it made the input lag). Use `useUrlText(urlValue, commit)` from `src/lib/use-url-text.ts`: the box and the filtering use the local text instantly, and the URL is updated 400 ms after the last keystroke; a URL change from outside (Back, a shared link) is copied back into the box. Buttons / selects (the stock filter) can still navigate immediately.
- **Defaults are left out of the URL**: "all" and an empty search are stored as `undefined`, so `/inventory` stays clean. `replace: true` keeps Back from stepping through every keystroke. An unknown value falls back to the default (`.catch`).
- **Pagination**: pass the filter values as the `resetKey` of `usePagination` (already done) so changing a filter returns to page 1.
- **Apply to other lists** (`/sales`, `/batches`, `/customers`, `/loans`, `/finance` sub-filters) the same way when they get filters; only `/inventory` has been converted so far.

---

### Lesson 53: Table Text Uses Two Colours and Two Weights

- **Rule**: text inside table bodies uses only `text-slate-900` (primary) and `text-slate-500` (secondary, e.g. engine number, colour name, dates), with normal weight, plus `font-medium` for the identifying column (name, VIN). No `font-mono`, `font-bold`, `font-semibold` or `font-black` in cells, and no `text-slate-400/600/700/800`. Reference: the inventory table (`src/routes/inventory.tsx`). Batch / lot labels are plain text, not mono badges.
- **Kept on purpose**: semantic colours that carry meaning (emerald = paid / positive, rose = owed / loss, purple = loans, blue = invoiced), status chips (`Badge`, `DualInventoryBadge`), and the bold red "Còn Nợ" amounts on `/customers` (explicitly requested).
- **Sweep**: 76 class lists in 16 files were normalised mechanically (every `className` on `TableCell` / `div` / `span` / `Link` inside a `<TableBody>`); new tables should follow the same rule instead of inventing a style per column.

---

### Lesson 54: Loan Term (Kỳ Hạn) and Interest Estimate

- **Data**: `loan_contracts.term_months` (int, 1-200, default 12; migration `0023_nervous_sasquatch.sql`, additive, already applied). The new-loan dialog has a "Kỳ Hạn Vay" `SearchSelect` listing 1-200 months (10 rendered at a time, more on scroll; typing "24" finds 24 and 124).
- **Estimate shown to the user** (`estimateLoanTermInterest` in `src/lib/business.ts`): monthly interest = `principal × rate / 100 / 12`, whole-term interest = monthly × term, plus the expected maturity date (`addMonthsIso(disbursementDate, term)`, end-of-month clamped). It is simple interest on the full principal, shown live in the dialog while the amount, rate or term change, and on the loan detail header ("Kỳ hạn", "Lãi ước tính: x/tháng · y cả kỳ hạn"). The `/loans` list has a "Kỳ Hạn" column.
- **Not the accounting figure**: the real accrued interest is still the day-exact declining-balance calculation (`calculateLoanInterest`, 365 days/year, split at each principal repayment) on the loan detail page. The maturity date is derived, not stored (the old `maturity_date` column stays removed, Lesson 36).
- **Gotcha**: loans created before this change got the column default (12 months); there is no edit-loan screen yet, so change them in the database if they differ.

---

### Lesson 55: Minimal Seed (demo data removed)

- **What the seed does now** (`npm run seed`, `src/db/seed/index.ts`): only the minimum for a fresh install: company profile (`company.seed.ts`), the 4 default roles and the `admin` / `Admin@123` account (`role.seed.ts`, `user.seed.ts`), and the VietQR bank catalogue (`bank.seed.ts`, needs internet). Each step is still idempotent per table, and `npm run seed -- --reset` still wipes every table first (`reset.seed.ts`).
- **Removed on purpose**: `customer.seed.ts`, `loan.seed.ts`, `batch.seed.ts`, `sale.seed.ts`, `finance.seed.ts` and `master-data.seed.ts` (demo customers, branches, loans, batches, vehicles, sales, vouchers, statements, suppliers, models, colours, the two fake company bank accounts) plus the three demo accounts (ketoan, kinhdoanh, kho). Lessons 8, 13 and 15 describe those files and are historical. Everything beyond the minimum is entered through the app: create roles/users in `/settings`, catalogues in `/master-data`.
- **If demo data is needed again**, restore the files from git history (`git log -- src/db/seed/`). They depend on each other through return values (`seedSales` needs `vIds` from `seedBatches`, ...), so bring back the whole chain.
- **Not touched**: data that already exists in a database is not removed by this change; to get a clean database run `npm run seed -- --reset` (this deletes everything, including data entered by hand).

---

### Lesson 56: Bank Code and Short Name (search only)

- **Data**: `banks.code` ("VCB") and `banks.short_name` ("Vietcombank") from VietQR, both nullable (migration `0024_damp_lady_vermin.sql`, applied). They are **never displayed**; they only make a bank easy to find in dropdowns. This re-adds columns that Lesson 24 had removed from the UI and schema, with a different purpose (search, not identification).
- **Seed**: `seedBanks()` (`src/db/seed/bank.seed.ts`) stores `code` / `shortName` for new banks and, for banks that already exist, fills in only the columns that are still empty (logo, code, short name), matching by normalised name. Re-run `npm run seed` after a migration like this to backfill (it fetched VietQR and filled all 76 banks).
- **Search**: `SearchSelectItem` accepts `keywords` (`src/components/ui/search-select.tsx`): extra text added to the option's search haystack but not rendered. Bank options pass `keywords={`${b.code ?? ''} ${b.shortName ?? ''}`}` (loan form, bank-account dialog in master data); bank-account options pass `bankCode` / `bankShortName` (receipt and payment dialogs, loan repayment, statement import), which `getMasterDataFn` now returns. Typing "VCB", "vietcombank" or "TCB" finds the bank; short codes can also match other banks that contain them ("vcb" is inside PVCB).
- **Rule for new bank dropdowns**: pass the same `keywords`; never print `code` / `shortName` in a table or label.

---

### Lesson 57: Every Master Data Tab Is Editable

- **What**: each row of the five `/master-data` tabs (Dòng Xe, Nhà Cung Cấp, Ngân Hàng, Tài Khoản Ngân Hàng, Màu Sắc) has a pencil button next to the trash button. It opens the same dialog as "Thêm", titled "Sửa ...", pre-filled; saving sends the row `id` to the existing `save*Fn`, which updates instead of inserting. "Thêm" clears the edit id first. Only users with `master-data.manage` see the buttons.
- **Banks**: only the name can be edited (logo, code and short name stay as imported). A bank renamed by hand is **not** added again by `npm run seed`: `seedBanks()` matches existing rows by name and, when a row has a VietQR `code`, by that code too.
- **Pattern for a new catalogue tab**: keep one `xId` state (null = adding), reset it in the add button, set it with the pencil, and pass `id: xId ?? undefined` in the save handler.

---

### Lesson 58: Deleting User Accounts (never the last admin)

- **UI**: each row of the users table in `/settings` has a trash button (next to "Chỉnh sửa"). Flow: (1) if the account is the only active user whose role is an admin role, an error dialog says "Phải có ít nhất 1 tài khoản có vai trò Quản trị…" and nothing is deleted or confirmed; (2) otherwise `confirmDelete` looks up what the account created (`getUsageFn` entity `users`: batches, sales orders, delivery notes, invoices, receipts, payments, statements) and lists them with links if any; (3) if it created nothing, the normal confirmation is shown. Deleting your own account (allowed when another active admin exists) warns that you will be logged out.
- **Server**: `deleteUserFn` (`users.manage`, `src/server/fns/system.ts`) re-checks the last-admin rule (`LAST_ADMIN_MESSAGE`) and turns a foreign-key refusal (`isReferencedError`) into "Tài khoản đã tạo dữ liệu nên không thể xóa, hãy khóa tài khoản thay vì xóa". Sessions and password-reset tokens are removed by their `ON DELETE CASCADE`.
- **Why a user with history cannot be deleted**: `created_by` columns reference `users.id` without cascade, so the records keep their author. Use the "Trạng Thái Kích Hoạt" switch (lock) for accounts that did real work.

---

### Lesson 59: Search Box on List Cards (`SearchBox`, `matchesSearch`)

- **Pattern**: a list card gets a `SearchBox` (`src/components/ui/search-box.tsx`) in its header next to the add button. The text lives in the URL as `?q=` through `useUrlText` (Lesson 52: the list filters on every keystroke, the URL follows when typing pauses), the list is filtered with `matchesSearch(query, ...fields)` from `src/lib/text.ts`, and the filtered array goes into `usePagination(filtered, search)` so the table returns to page 1. Show a "Không tìm thấy ..." row when nothing matches.
- **Matching**: every typed word must appear in one of the fields, ignoring case and Vietnamese diacritics ("ke toan" finds "Kế toán", "nguyen hung" finds "Nguyễn Văn Hùng"). `foldText` is the shared normaliser.
- **Done**: `/settings` users tab (full name, username, email) and roles tab (name, description). `?q=` belongs to the active tab and is dropped when the tab changes, because the tab handler replaces the whole search object. `/inventory` has its own search (Lesson 52). Add the same to other long lists (customers, batches, sales, loans, master data) when they need it.

---

### Lesson 60: Search on Every Master Data Tab

- **What**: each of the five `/master-data` tabs has a `SearchBox` in its card header (Lesson 59 pattern: `?q=` via `useUrlText`, `matchesSearch`, filtered array into `usePagination(filtered, search)`). Searched fields: models / suppliers / colors by name; banks by **name, code and shortName** (the search-only columns from Lesson 56); company bank accounts by account name, account number, bank name, bank code, bank short name and branch.
- **Behaviour**: one shared `search` value; switching tabs replaces the whole search object, so `q` is cleared and every tab starts unfiltered.

---

### Lesson 61: New Batch Form Opens Empty

- `/batches/new` no longer starts with demo values: no supplier selected, one blank vehicle row (no model / colour / VIN / engine / price), no expense rows, profit value 0. "Thêm xe" / "Thêm chi phí" also add blank rows. Unselected dropdowns use id `0`, so submit checks the supplier and each vehicle's model and colour first and shows a Vietnamese message.

---

### Lesson 62: Colour Swatch in Colour Dropdowns

- `ColorLabel` (`src/components/ui/color-label.tsx`) renders a colour name with a round swatch of `colors.hex`. The colour `SearchSelect`s in `/batches/new` and `BatchEditor` use it (with `keywords={c.name}` so search still matches the name). Use it for any new colour dropdown.

---

### Lesson 63: Expense Types Are a Master Data Table

- **Change**: batch expense categories moved from the `batch_expenses.expense_type` enum into the table `expense_types` (`id`, `name`); `batch_expenses.expense_type_id` (NOT NULL, FK) replaces the enum. `EXPENSE_TYPES` / `EXPENSE_TYPE_LABELS` no longer exist. `/master-data?tab=expenseTypes` ("Loại Chi Phí") lists, adds, edits and deletes them (`saveExpenseTypeFn`, `deleteMasterDataFn('expenseTypes')`, `getMasterDataFn().expenseTypes`); the expense dropdowns in `/batches/new` and `BatchEditor` are `SearchSelect`s over that list, and server inputs take `expenseTypeId`. Batch detail expenses and the reports expense breakdown return `expenseTypeName`.
- **Deleting**: a type used by batch expenses is refused with the usage list (`getUsageFn` entity `expenseTypes`, links to the batches).
- **Migrations** `0025_mighty_medusa.sql` (creates the table, inserts the six default names, back-fills `expense_type_id` from the old enum, hand-appended) and `0026_polite_network.sql` (NOT NULL, drops the enum column) were generated in two steps to avoid drizzle-kit's interactive rename prompt; both applied. A fresh database gets the six defaults from the migration, not from the seed.

---

### Lesson 64: Server Validation Errors Never Shown Raw

- Zod errors reach the client as a JSON string. Every form that shows `err.message` must pass it through `formatErrorMessage(err, fallback)` (`src/components/ui/confirm-dialog.tsx`), which turns it into Vietnamese lines such as "Xe 1 — Đơn giá nhập: Đơn giá nhập phải > 0". Row errors are located through `describePath` (`vehicles` / `expenses` + index -> "Xe 1" / "Chi phí 1"); add new field names to `FIELD_TRANSLATIONS` and new list names to `ROW_LABELS`. Banners that show the result need `whitespace-pre-line`. Applied to the batch, sale, statement import and auth forms; settings forms use `parseFieldErrors` (Lesson 48).

---

### Lesson 65: No Self-Registration (admins create accounts)

- The public `/register` page, `registerFn` and `defaultRoleId` were removed, and the login page no longer links to sign-up. Accounts are created only by a user with `users.manage` in **/settings → Quản Lý Người Dùng**. A fresh database gets its first admin from `npm run seed` (`admin` / `Admin@123`), so nothing depends on "the first registered user becomes admin" any more. This supersedes the registration notes in Lessons 17 and 46. `/forgot-password` and `/reset-password` remain.
- **Not changed**: the "Tài khoản dùng thử" shortcuts on `/login` still list the old demo roles (only `admin` exists after Lesson 55).

---

### Lesson 66: Login Page Cleanup, Password Eye Toggle, Forgot-Password Email (SMTP)

- **Login**: no subtitle, no "Tài khoản dùng thử" shortcuts, fields start empty, required labels end with " *" (login, forgot and reset forms). Login already accepts a username **or** an email (`authenticate` matches both columns).
- **Show / hide password**: every password box uses `PasswordInput` (`src/components/ui/password-input.tsx`, eye button on the right) on login, reset-password and the two /settings forms (own password, user dialog). Never use `<Input type="password">` directly.
- **Forgot-password email**: `src/server/services/mail.ts` (`nodemailer`) sends the reset link through SMTP configured in `.env`: `MAIL_DRIVER=smtp`, `SMTP_HOST`, `SMTP_PORT` (587 = STARTTLS, 465 = implicit TLS), `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`; optional `APP_URL` for the link origin (default: origin of the request). With Gmail the password must be an **app password**. An unknown email is refused with "Email này chưa được đăng ký trong hệ thống" (nothing is sent); a failed send shows "Không gửi được email". If SMTP is not configured (empty username / password), the link is only logged and, outside production, shown on the page (`devLink`). Restart the dev server after editing `.env`.

---

### Lesson 67: Settings Menu Split, No Change-Password Tab, Red Asterisks, Roomier Inputs

- **Sidebar**: new group "Hệ thống" with a sub menu **Người dùng & Phân quyền** (children "Quản lý người dùng" -> `/settings?tab=users`, "Vai trò & phân quyền" -> `/settings?tab=roles`) and **Cài đặt** (`/settings?tab=company`). `NavItem` has `tab` and `children`; `matches(item, path, tab)` compares the `?tab=` value (/settings without a tab counts as `company`), so items sharing one path highlight correctly. The /settings page has no tab bar any more; its title and subtitle follow the active tab (`PAGE_TITLES`).
- **Change password removed**: the "Đổi Mật Khẩu" tab and `changePasswordFn` are gone; users who forget a password use /forgot-password (email link), admins can set a new one in the user dialog.
- **Red asterisk (every form)**: a field gets " *" when the user must fill it (native `required` or a check in the submit handler/server validator), including table headers of editable rows (`/batches/new`). Optional fields get none. `Label` and `TableHead` run their children through `markRequired` (`src/components/ui/required-mark.tsx`): a string ending in "*" ("Tên Doanh Nghiệp *") renders the star in red. Just keep writing the star in the text.
- **Input size (whole app)**: every form control is roomy: base `Input` / `SearchSelect` trigger / `SelectTrigger` are `h-11 rounded-lg px-4 text-sm` with a solid `bg-card` background, `Textarea` is `min-h-24 px-4 py-3`. Do not add `h-8 text-xs` to a control; the only smaller size is `h-9` for inputs inside table rows and the `SearchBox` in card headers. Buttons keep their compact sizes. When sweeping classes with a script, never run `prettier --write` on `src/db/migrations/meta` (it rewrites drizzle's snapshot JSON).

---

### Lesson 68: Shell — Profile Menu, Collapsible Sidebar, Empty Top Bar

- **Top right**: only the account menu (`ProfileMenu` in `AppLayout.tsx`: avatar with initials, name, role; dropdown with username and "Đăng xuất"). The "Tra cứu 2 kho", "Phiếu bán" and "Nhập lô mới" shortcuts were removed (those pages stay in the sidebar). The user block and logout button at the bottom of the sidebar were removed.
- **Sidebar**: a button in the top bar (desktop, lg+) toggles between expanded (w-64) and collapsed (w-0: hidden completely; the same top-bar button brings it back). The choice is stored in `localStorage` (`sidebar-collapsed`, read after mount so SSR markup stays the same). The mobile drawer is always expanded.
- **Password placeholders**: "Nhập mật khẩu" / "Nhập mật khẩu mới" / "Nhập lại mật khẩu mới" / "Để trống nếu không đổi mật khẩu" instead of dots. Gotcha: `PasswordInput` wraps the input in its own `relative` box, so an icon placed *before* it in a parent (login's lock / user icon) needs `z-10`, or the input paints over it.

---

### Lesson 69: "Dữ liệu chung" Menu, Model Attributes, Bank Logo Field

- **Menu**: "Danh mục hệ thống" is now the main menu **Dữ liệu chung** (sub menus fold: click the heading; a menu is open by default only while the current page is one of its children, the user's choice is kept in memory until reload) with six sub menus (Dòng xe, Nhà cung cấp, Ngân hàng, Tài khoản ngân hàng, Màu sắc, Loại chi phí) = `/master-data?tab=...`. `DEFAULT_TABS` in `AppLayout.tsx` says which tab a path shows without `?tab=`. The /master-data page has no tab bar; its title and subtitle follow the tab (`TAB_TITLES`). The chat asked for 5 sub menus; there are 6 tabs because Loại chi phí (Lesson 63) was added since.
- **Motorcycle model** has **Hãng xe** (`motorcycle_models.brand`), **Dòng xe** (`name`) and **Đời xe** (`model_year`, free text; migration `0027`). A per-model colour list (**Màu xe**, table `motorcycle_model_colors`) was added and then removed again on request (migration `0028_lucky_spitfire.sql` drops the table); colours are chosen per vehicle from the whole `/master-data` colour list. `modelLabel(m)` = "Honda SH 150i 2025" is shown in the model dropdowns of `/batches/new` and the batch editor; other screens show only `name`. Lesson 24 had removed brand; this supersedes it.
- **Bank form** has a logo URL field with a live preview (`saveBankFn` takes `image`); `BankLogo` keeps its "failed" state per `src`, so give the preview `key={image}`. Code and short name stay out of the UI (Lesson 56).

---

### Lesson 70: Image Uploads (`uploads/` folder, `APP_URL`)

- **Storage**: files go to the `uploads/` folder in the project root (`uploads/banks/<uuid>.png`); `.gitignore` ignores its content and keeps `uploads/.gitkeep`. Only PNG, JPG, WEBP and GIF up to 2 MB are accepted (no SVG, which could carry scripts). Docker / hosting: mount `uploads/` as a persistent volume, otherwise images vanish on redeploy.
- **Routes** (TanStack Start server routes, `server.handlers`): `POST /api/uploads` (`src/routes/api.uploads.tsx`, multipart `file` + `folder`, needs the `master-data.manage` permission, reads the session cookie from the request header, returns `{ key }`) and `GET /uploads/<key>` (`uploads.$.tsx`, public, immutable cache, path traversal blocked). Logic in `src/server/services/uploads.ts`; add new folders to `UPLOAD_FOLDERS`.
- **Stored value**: `banks.image` holds either a full https address (VietQR logos) or a key path ("banks/<uuid>.png"). `imageSrc()` (`src/lib/image-url.ts`) turns it into an address: https stays, a key becomes `<APP_URL>/uploads/<key>`. `APP_URL` in `.env` is exposed to the browser as `VITE_APP_URL` through `define` in `vite.config.ts` (restart / rebuild after changing it; empty = same origin). `BankLogo` already goes through `imageSrc`, so use it (or `imageSrc`) for any new image.
- **Clean-up**: deleting a bank deletes its uploaded file, and saving a bank with a different or removed logo deletes the old file (`deleteImage` in `uploads.ts`; https addresses are never touched). `saveBankFn` only accepts an https address or a key path made by the upload route. The dialog does not upload on pick: the chosen file stays in the browser (blob: preview, `imageSrc` passes `blob:` through) and is sent to `/api/uploads` only when "Lưu Ngân Hàng" is pressed, so cancelling leaves nothing on disk.
- **UI**: the bank dialog in /master-data has "Tải ảnh lên" (hidden file input "Chọn ảnh", preview), and "Xóa ảnh" (right half, next to the preview). 
- **Gotcha**: `getCookie()` from `@tanstack/react-start/server` returned nothing inside a server *route* handler (401 for a logged-in admin); parse `request.headers.get('cookie')` instead.

---

### Lesson 71: Loading Indicator on Every Delete

- **Rule**: a delete button shows a spinner from the click until the row is gone, in two phases: (1) the usage lookup that runs *before* the confirmation popup (`confirmDelete` takes a third argument `onChecking(checking)`), (2) the delete itself, including the data refresh (`mutateAsync` resolves after `invalidateQueries`). The button is disabled meanwhile.
- **Pieces**: `useBusyKeys()` (`src/lib/use-busy.ts`, `isBusy(key)` / `setBusy(key, on)`, keys like `banks:12`) and `<BusyTrash busy={...} />` (`src/components/ui/busy-trash.tsx`, trash icon that becomes a spinner). Pattern: `const ok = await confirmDelete(target, opts, (c) => setBusy(key, c)); if (!ok) return; setBusy(key, true); try { await mutateAsync(...) } catch { ... } finally { setBusy(key, false) }`.
- **Applied to**: all six /master-data tabs, users and roles in /settings, loans, vehicles in the batch editor (also the batch expense button, which uses the mutation's `variables`), and "Hủy phiếu bán" (spinner + "Đang hủy..."). Verified: the spinner appears immediately after the click while the usage check runs. Any new delete must follow the same pattern.

---

### Lesson 72: Customer Wording, Branch Address

- **Wording** (UI only, tables/columns unchanged): "Khách Hàng Mẹ" is now **Khách Hàng** and "Điểm Bán Trực Thuộc" is **Điểm Bán** on /customers, /finance, /reports, /sales and the new-sale form; the customer detail page has "Danh Sách Điểm Bán" and "Công Nợ Theo Điểm Bán". Use these names in new screens. The glossary at the top of this file still uses the old English terms (parent customer / branch) for the data model.
- **Branch address**: `pos_branches.address` (varchar 500, nullable; migration `0029_strong_blue_blade.sql`, applied) re-adds the field Lesson 27 had removed. The add-branch form on /customers/$customerId has a "Địa Chỉ" textarea and the branch table shows the column. `saveBranchFn` accepts `address`; there is still no edit-branch screen.

---

_(Next Agent: Append Lesson 73, 74,... above this line upon completing tasks)_

