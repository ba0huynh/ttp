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

6. **TEXT-ONLY COLOR DISPLAY PROTOCOL (CLIENT DIRECTIVE)**:
   - Per explicit client feedback, color swatches (round color circles, hex palettes, and color pickers) **MUST NOT be displayed** anywhere in the system.
   - Users only enter color as a name (plain text, e.g. "Đỏ", "Đen nhám", "Trắng"). All color displays across tables, dropdowns, search filters, modal forms, and detail views must **ONLY render the color name text** (`colorName` / `c.name`).
   - Do NOT render color swatch circles or hex pickers.

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
- **Table edge padding**: first and last cell of every table row have 20px (`first:pl-5 last:pr-5` in `table.tsx`) so text lines up with the card title instead of touching the card edge.
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

### Lesson 73: Model Colour Is a Suggestion (Dòng Xe Carries a Default Colour)

- **Rule from the client**: a motorcycle model can carry **one suggested colour** (`motorcycle_models.color_id`, FK to `colors`, nullable; migration `0030_dry_queen_noir.sql`, applied). It is only a default: the vehicle's own colour is still chosen per vehicle. This replaces the per-model colour *list* of Lesson 69 (that table was dropped in `0028`). A bike in a second colour can be a second model row, but nothing forces it.
- **Master data**: the model dialog has an optional "Màu Xe" select (swatches) and the table a "Màu Xe" column; the model search also matches the colour name. Deleting a colour is refused while a model uses it (usage list "Dòng xe dùng màu này").
- **Vehicles**: `vehicles.color_id` is chosen with a normal colour dropdown (required, marked *) in `/batches/new` and in the batch editor's add-vehicle row. Choosing a model pre-selects the model's colour (in the editor it is used until the user picks another; picking a different model suggests again), and the user can change it. `ModelOption` (`src/components/batches/ModelOption.tsx`) shows "Hãng Dòng Đời" plus the colour swatch in model dropdowns.
- **Backfill**: the migration copied, for each existing model, the colour of its first vehicle; models without vehicles have no suggestion until edited.

---

### Lesson 74: Edit and Delete for Customers and Branches

- **Customers list** (`/customers`): each row has a pencil (opens the same dialog as "Thêm Khách Hàng", titled "Sửa Khách Hàng", `saveCustomerFn` with `id`) and a trash button; **customer detail** (`/customers/$customerId`): each branch row has a pencil (reopens the inline branch form pre-filled, `saveBranchFn` with `id`, name + address) and a trash button. Both are wrapped in `<Can permission="customers.manage">`.
- **Server**: `deleteCustomerFn` (also deletes its branches by `ON DELETE CASCADE`) and `deleteBranchFn`; a row used by sales orders or receipts is refused by the foreign keys ("Đang được dùng ở phiếu bán hoặc phiếu thu nên không thể xóa"). `getUsageFn` has entities `customers` and `branches` listing those sales orders and receipts with links, so the delete flow is the usual one (Lesson 51: usage check first, then confirmation, spinner on the button, Lesson 71).
- **Gotcha**: the branch count on the list is correct after a refetch; a screenshot taken right after adding branches can show the cached count (30 s `staleTime`).

---

### Lesson 75: Branch Form Is a Dialog; 404 Page

- **Branch dialog**: adding and editing a branch on `/customers/$customerId` both use one `Dialog` ("Thêm Điểm Bán Mới" / "Sửa Điểm Bán", fields name + address) instead of the inline form. Prefer a dialog for every create/edit form (see /master-data, /customers).
- **404**: `src/components/layout/NotFound.tsx` is registered as `defaultNotFoundComponent` in `src/router.tsx` (big "404", "Không tìm thấy trang", buttons "Quay lại" and "Về trang chủ"; HTTP status stays 404). It renders without the app shell, so it also works for logged-out visitors. Pages with their own not-found state (loan / customer / batch detail with an unknown id) keep it.

---

### Lesson 76: Batch List Actions (view / edit / delete)

- **`/batches` rows** have two icon buttons: eye (opens `/batches/$batchId`, which is also where batch info, pricing, expenses and vehicles are edited; the pencil that pointed to the same page was removed) and trash (`<Can permission="batches.manage">`).
- **Delete**: `deleteBatchFn` (`deleteBatch` in `services/batches.ts`) removes the batch; its vehicles and expenses go with it through `ON DELETE CASCADE`. It is refused when any vehicle is in a sales order or was delivered / invoiced (`BusinessError`); `getUsageFn` entity `batches` lists the sales orders (with links) that hold vehicles of the batch. The usual flow applies: usage check, confirmation, spinner (Lessons 51 and 71).

---

### Lesson 77: Edit / Delete a Statement Line (`/reconcile`)

- Each line of the transactions table has a pencil and a trash button next to "Tìm khớp" / "Hủy khớp" (inside `<Can permission="reconcile.manage">`; the actions column is `w-52` in the fixed-layout table). The pencil opens a dialog (date, description, money out, money in; only one side may be above 0, entering one clears the other); the trash asks `confirmDialog` and shows a spinner (`useBusyKeys`, Lesson 71).
- **Rule**: a *matched* line cannot be edited or deleted (it is tied to a voucher / repayment): both buttons are disabled with the tooltip "Hủy khớp trước khi sửa / xóa", and the server enforces the same in `updateStatementLine` / `deleteStatementLine` (`services/finance.ts`; `updateStatementLineFn`, `deleteStatementLineFn`, permission `reconcile.manage`).
- Not done: deleting or renaming a whole statement; only its lines can be changed.

---

### Lesson 78: Edit a Loan Contract

- `/loans` rows have a pencil next to the trash (`<Can permission="loans.manage">`). It opens the same dialog as "Tạo Khế Ước Mới", titled "Sửa Khế Ước Vay", pre-filled (contract number, bank, principal, rate, disbursement date, term); saving sends `id` to `saveLoanContractFn`, which already updated by id. "Tạo Khế Ước Mới" now resets the form to its defaults (`openNewLoan`) so edited values never leak into a new contract.
- **Effect**: interest, outstanding balance and the maturity estimate are derived, so changing principal, rate or date re-prices the whole schedule, repayments already recorded included (they are not rewritten). There is no guard against lowering the principal below the principal already repaid.

---

### Lesson 79: Edit / Delete on Sales List and Voucher History

- **`/sales`**: the "Xử lý" text button is now an eye icon. A pencil and a trash ("Hủy phiếu bán") appear only for an order that is not cancelled and has nothing delivered or invoiced (`deliveredCount` and `invoicedCount` are 0), inside `<Can permission="sales.create">`. The pencil edits the order header only (date, customer, branch; `updateSalesOrderFn` / `updateSalesOrder`, refused once a delivery note or invoice exists); vehicles and prices are not editable, to change them cancel and re-create. "Hủy" is the existing soft cancel (`cancelSalesOrderFn`: items removed, status `cancelled`), not a row delete.
- **`/finance` tabs "Lịch Sử Phiếu Thu" / "Lịch Sử Phiếu Chi"**: each row has a pencil and a trash (`finance.manage`). The create dialogs double as edit dialogs (`editReceiptId` / `editPaymentId`; the mutation calls the update fn when an id is present). Server: `updateReceiptVoucherFn`, `deleteReceiptVoucherFn`, `updatePaymentVoucherFn`, `deletePaymentVoucherFn`. A voucher matched to a bank statement line is refused ("hãy hủy khớp ở mục Đối chiếu sao kê trước", `assertNotMatched`), so reconciliation never points at a missing or changed voucher. Payments with a payee type other than supplier cannot be edited in the UI (only suppliers can be chosen). The AR / AP tabs are summaries and have no row actions.
- **`/loans`**: edit is the pencil from Lesson 78.

---

### Lesson 80: Create-Batch Form Uses the Editor Layout; Buttons Match Their Inputs

- **`/batches/new`** is built like the batch editor (`BatchEditor`): stacked `Section` panels (exported from `BatchEditor.tsx`) — "Thông Tin Lô" (supplier, loan, date), "Cài Giá Bán Theo Lô", "Chi Phí Lô" and "Danh Sách Xe Trong Lô & Phân Bổ Giá Vốn". Items already added are shown on top (expense chips; a vehicle table with live allocated expense, cost and selling price, red when below cost), with a one-line add row below ("Thêm chi phí" / "Thêm xe"). The add rows validate and push into local state; **nothing is sent until "Hoàn Tất Nhập Lô"** (a plain button with `onClick`, no `<form>`, so Enter in a draft field cannot submit the batch). Picking a model pre-fills its suggested colour. At least one vehicle and a supplier are required.
- **Button heights**: a button on the same row as inputs uses the input height: `h-11 rounded-lg text-sm` next to `h-11` inputs ("Thêm xe", "Thêm chi phí", "Lưu thông tin", "Áp dụng cho cả lô", reports "Áp Dụng", the stock filters on /inventory) and `h-9` next to the `SearchBox` (the "Thêm ..." buttons of /master-data and /settings). Check with a quick Playwright measurement when adding a new toolbar.
- **Price base labels**: "Giá vốn thực tế" / "Đơn giá nhập" (no "Khuyên dùng" any more).

---

### Lesson 81: Selling Price Always Starts From the Import Price

- **Client decision**: the "Gốc tính giá" dropdown was removed from `/batches/new` and from the batch editor. Every batch is priced as **đơn giá nhập + margin** (percent or fixed amount); batch expenses are not part of the selling-price base. The pages send `pricingBase: 'import_price'`; the `pricing_base` column and `cost_price` option still exist in the schema / `computeSellingPrice` so old batches keep working, and an old batch switches to the import-price base the next time "Áp dụng cho cả lô" is pressed.
- **Consequence to remember**: the cost price still includes the allocated expenses, so the selling price can fall below cost when the expenses are large. The red below-cost warning (Lesson 5, `CostWarningAlert`, the "Dưới giá vốn" row marker) stays and is the only guard.

---

### Lesson 82: No Below-Cost Warning; Supplier Editable on a Batch

- **Client decision**: the below-cost warning was removed from the batch screens: no `CostWarningAlert` and no "n/m xe bán dưới giá vốn" badge in the batch editor, no red banner on `/batches/new`, no red row or "Dưới giá vốn" marker in either vehicle table. This supersedes the "mandatory warning" of Lesson 5 / the business rule at the top of this file; `isBelowCost` and `CostWarningAlert.tsx` are still in the code base (unused by the batch screens) if the rule is ever wanted back. With the import-price base (Lesson 81) the selling price can sit under the cost price without any hint.
- **Supplier**: the batch editor's "Thông Tin Lô" section now has a "Nhà cung cấp *" select next to the loan and the date; `updateBatchInfoFn` / `updateBatchInfo` take `supplierId`. The pencil that duplicated the eye on the `/batches` rows was removed (Lesson 76).

---

### Lesson 83: Vehicles and Expenses Are Lists With Popup Forms

- **Rule**: a batch's vehicles and expenses are shown as **tables** (pencil + trash per row), and are added or edited through a **popup form** opened by the "Thêm xe" / "Thêm chi phí" button in the section header. This replaces the one-line add rows and the expense cards of Lesson 80. Components: `VehicleFormDialog` and `ExpenseFormDialog` (`src/components/batches/`, props `open`, `initial`, `onSubmit`; `onSubmit` may throw to keep the dialog open with its message; picking a model suggests its colour).
- **Columns**: the vehicle tables show VIN, engine, model / colour, import price and selling price only; the "CP Phân Bổ" and "Giá Vốn Xe" columns were removed (the allocation is still computed and stored).
- **`/batches/new`**: the dialogs only change the page state (`saveVehicle` / `saveExpense`, duplicate VIN in the list refused); nothing is sent until "Hoàn Tất Nhập Lô". **Batch editor** (`/batches/$batchId`): the same dialogs call the server at once (`addVehiclesToBatchFn` / `updateVehicleFn`, `addBatchExpenseFn` / `updateBatchExpenseFn`, each followed by `recalculateBatch`). A vehicle that is sold, delivered or invoiced cannot be edited or removed (`updateVehicle` refuses it, VIN stays unique).

---

### Lesson 84: Selling Price Never Includes Batch Expenses (enforced in the formula)

- `computeSellingPrice` (`src/lib/business.ts`) now always starts from the vehicle's **import price**; the `pricingBase` field of its argument is ignored (the column and type stay only for old data). Every recalculation (`recalculateBatch`, the create-page preview) therefore gives import price + percent / fixed amount, whatever a batch has stored.
- Existing batches were fixed by migration `0031_import_price_selling_base.sql` (custom SQL, applied): it re-prices `vehicles.selling_price` with the same formula and sets `import_batches.pricing_base = 'import_price'`. Sales order items keep the price they were sold at (Lesson 17). The "Cách định giá bán" column on `/batches` now reads "Trên Giá Nhập +x%" for every batch.
- Custom data migrations: `npx drizzle-kit generate --custom --name=<name>` creates the empty file and the journal entry, then write the SQL by hand (use `--> statement-breakpoint` between statements).

### Lesson 85: Custom Migration Runner Supports TypeScript (.ts) Files

- **Feature**: `src/db/migrate.ts` (`npm run migration:run`) now supports both standard `.sql` files and programmatic `.ts` migration files located in `src/db/migrations/`.
- **Sorting & Execution**: Files are discovered directly from `src/db/migrations/` and ordered alphabetically/numerically (`0000_...`, `0001_...`, etc.). The runner prevents duplicate names across `.sql` and `.ts`.
- **TypeScript Migration Signature**: A `.ts` migration file exports an `up`, `migrate`, or default async function:
  ```typescript
  import type { db } from '#/db/index.ts'
  import type { MigrationContext } from '#/db/migrate.ts'

  export async function up(database: typeof db, context: MigrationContext) {
    // Perform complex Drizzle queries, data migrations, or transactions
  }
  ```
- **Database Tracking**: Both `.sql` and `.ts` migrations are recorded identically in the `migrations` table by base file name (without file extension).

---

### Lesson 86: Batch Detail Link, Vehicle Edit & Delete on `/inventory`

- **Batch Link**: The "Lô Nhập" column in `/inventory` ([src/routes/inventory.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/inventory.tsx)) links directly to the batch detail page (`/batches/$batchId`) with preloading enabled.
- **Edit Vehicle**: Each available vehicle has an edit action (pencil icon) opening `VehicleFormDialog` with pre-filled model, color, chassis number, engine number, and import price. Saving updates the vehicle via `updateVehicleFn`, triggers batch expense recalculation, and invalidates query caches.
- **Delete Vehicle**: Available vehicles display a delete button using `BusyTrash` and `confirmDelete` from `src/lib/usage.ts`. Deletions recalculate batch cost distributions.
- **Locked Vehicles**: Vehicles already sold (`salesOrderId`), physically delivered (`isDelivered`), or invoiced (`isInvoiced`) cannot be edited or deleted to preserve audit integrity; they display an un-deletable dash (`—`) with an explanatory tooltip.

### Lesson 87: Single-Step Migration Revert / Down (`npm run migration:down`)

- **Feature**: `src/db/migrate.ts` now rolls back migrations one at a time via `npm run migration:down` (or `npm run migration:revert`).
- **Single-Step Execution**: Each invocation targets strictly the single most recently applied migration, announcing the exact file path before and after execution (e.g. `src/db/migrations/0031_import_price_selling_base.ts`).
- **TypeScript Migrations**: Export an `async function down(database, context)` (or `revert`).
- **SQL Migrations**: Supported via `<name>.down.sql` sidecar files or in-file `--> down` / `-- down` sections.
- **Rollback Tracking**: On successful revert, the record is removed from the `migrations` table so it can be re-run on demand.

### Lesson 88: Full Migration Conversion to TypeScript (.ts) with Up and Down

- **Conversion**: All 36 migrations in `src/db/migrations/` (`0000_wet_sentinel.ts` through `0035_drop_batch_loan_link.ts`) are now native TypeScript files exporting both:
  - `export async function up(database: typeof db, context: MigrationContext): Promise<void>`
  - `export async function down(database: typeof db, context: MigrationContext): Promise<void>`
- **Down Operations**:
  - `0000_wet_sentinel.ts` down drops all created tables in reverse dependency order with `FOREIGN_KEY_CHECKS = 0`.
  - Incremental migrations down properly drop newly added columns/tables, or re-add removed constraints/columns.
  - Baseline safety: `migrate.ts` automatically baselines `0000_wet_sentinel` if tables already exist when starting on an established database.
- **Per-Statement SQL Text Logging**: `createTsMigrationContext` wraps `context.run` and `database.execute` so each statement executed by `.ts` migrations logs the exact SQL text with an incremental step index `✓ [1] ...` and status indicator, identical to `.sql` execution.
- **Workflow Commands**:
  - Forward migration: `npm run migration:run`
  - Single-step rollback: `npm run migration:down` (or `npm run migration:revert`), which identifies and reports the exact file being reverted.

### Lesson 89: Transaction Safety & Compensating Rollback in Migration Runner

- **Problem**: In raw script execution without transactions, a migration failure halfway leaves the database in an inconsistent state, and re-running causes "column/table already exists" crashes.
- **Transaction Wrapping**: Both `migrate()` and `revert()` in `src/db/migrate.ts` now execute every migration inside a dedicated `db.transaction(async (tx) => { ... })` block.
  - On transactional DDL engines (e.g. PostgreSQL), any failure triggers a native complete transaction rollback.
  - On MySQL (where DDL causes implicit commit), all DML updates/inserts/deletes roll back automatically, and the tracking record in `migrations` is saved atomically only upon successful completion.
- **Compensating Rollback on Failure**: When a multi-statement migration fails halfway in MySQL after running 1 or more statements, `attemptCompensatingRollback` automatically invokes the migration's `down()` handler to revert the partial changes and restore the database to its pre-migration state.

### Lesson 90: In-File Down Separator Support for `.sql` Migrations

- **Feature**: `.sql` migration files fully support reverse/down migrations using in-file section separators:
  - Supported delimiters: `-- down`, `--> down`, `/* down */`, `-- DOWN`, `--> @down` (case-insensitive).
  - Alternative: `<migration_name>.down.sql` sidecar files.
- **Standardization**: All 36 migrations in `src/db/migrations/` (`0000_wet_sentinel.sql` through `0035_drop_batch_loan_link.sql`) are standardized as `.sql` files with embedded `--> down` sections containing their exact revert logic.
- **Statement Splitting**: `splitSqlStatements()` automatically parses statements delimited by either Drizzle's `--> statement-breakpoint` or standard semicolons `;`.
- **Parity with `.ts`**: Both `.sql` and `.ts` migrations have 100% feature parity: forward migration, per-statement logging, single-step revert (`npm run migration:down`), transactional execution, and compensating rollback on failure.

---

### Lesson 91: List Filter Dialogs, Sorting and Shared Filter Components

- **Pattern**: list pages (`/inventory`, `/batches`, `/sales`, `/loans`, `/customers`, `/reconcile`, and the four tabs of `/finance`) have a "Bộ lọc" button with a count badge that opens a filter `Dialog` (`max-h-[90dvh] overflow-y-auto sm:max-w-xl`). All filtering and sorting is client-side over the already-loaded list; filter values live in the URL search params (Lesson 52), defaults are left out, and the list passes a key of the filter values to `usePagination` so it returns to page 1. "Xóa lọc" clears filters (not the sort).
- **Shared components**: `MultiSearchSelect` (`src/components/ui/multi-search-select.tsx`: checkbox options, stays open, same `SearchSelectItem` children; several picks mean "any of") and `PriceRangeFilter` (`src/components/ui/price-range-filter.tsx`: min/max with a ₫ suffix, edits local state and calls `onChange` 1 s after typing stops, so the URL is not written per keystroke). `nodeText` and `fold` are exported from `search-select.tsx`.
- **Sorting** (batches, sales, loans, customers): clickable column headers cycle ascending → descending → default (server order); the dialog also has "Sắp xếp theo" / "Thứ tự" selects bound to the same `sort` / `dir` params.
- **Options come from master data, not from the rows in view**: dropdowns list every supplier, fee type, bank, customer and branch (e.g. `/batches` uses `masterDataQuery`), so unused entries are selectable. `/inventory` model / color / batch options still come from the vehicles loaded.
- **Fee types**: `listBatchesFn` returns `expenses` (per batch, per fee type) so `/batches` can filter by fee type; with fee types picked, the fee range applies to the sum of just those types.
- **URL shapes**: arrays and objects are serialised as JSON by TanStack Router, so `/finance` keeps one object per tab (`rcv`, `pay`, `rec`, `pmt`) and old single-value links (e.g. `?stock=mismatch`) are ignored.
- **Customer links**: customer names link to `/customers/$customerId` in `/finance` (receivables, receipts) and `/reports`.
- **Sale form**: `/sales/new` shows a red heads-up (not a blocker) above the vehicle table when a unit price is below the cost price.

### Lesson 92: UI/UX Pro Max Skill Installed Per Project

- Installed with `npx -y uipro-cli init --ai claude` from the repo root: it creates `.claude/skills/ui-ux-pro-max/` (the skill files, plus shared data/scripts). A Claude Code session must be **restarted** before the skill appears. The plugin route (`/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill`, then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`) is the alternative and has to be typed inside an interactive session.

---

### Lesson 93: Page Content Uses the Full Screen Width

- **Symptom**: on large monitors every page sat in a narrow centred column with empty space on both sides.
- **Cause**: the `<main>` in `AppLayout.tsx` had `max-w-[1400px] mx-auto`, a cap applied to every page (no page sets its own width).
- **Fix**: the cap was removed; `<main>` is `flex-1 w-full min-w-0` with side padding only (`px-4` → `sm:px-6` → `lg:px-8` → `2xl:px-10`). Do not add a page-level `max-w-*` wrapper; keep width limits for forms and dialogs only (e.g. the statement picker on `/reconcile`).

### Lesson 94: Reversion of Brand CRUD & Model Color Coupling; Removal of Brand Input from Model Dialogs

- **Client Decision**:
  - The client confirmed that Brand CRUD (`Hãng xe`) is not required, and color should not be coupled to the motorcycle model (vehicles continue to select color upon batch import).
  - The "Loại chi phí" (Expense Types) page in Master Data is retained as originally designed.
  - The Brand (`Hãng xe`) input field was completely removed from the Add/Edit Motorcycle Model dialogs (`src/routes/master-data.tsx` and `src/components/batches/VehicleFormDialog.tsx`), and the "Hãng Xe" table column was removed from the Master Data models table so staff only manage Model Name and Model Year.
- **Database & Clean State**:
  - Rolled back and cleaned up migrations `0036` and `0037`.
  - Database schema remains untouched (`motorcycle_models.brand` stays as optional nullable string in schema for backwards compatibility).

### Lesson 95: Settings User Table Action Icon & Editable Username for Administrators

- **Context**: In Settings > User Management (`/settings?tab=users`), the edit button was previously rendered as plain text ("Chỉnh sửa") instead of matching the application-wide icon button aesthetic, and the `username` field was hardcoded as `disabled={Boolean(editId)}` on edit.
- **UI & UX Refinement**:
  - Replaced the text button in [settings.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/settings.tsx) with a ghost `Pencil` icon button (`size-7 text-slate-400 hover:text-emerald-700`).
  - Removed `disabled={Boolean(editId)}` from the username input, enabling authorized administrators to update account usernames.
- **Server Validation**:
  - Enhanced `saveUserFn` in [system.ts](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/server/fns/system.ts) to check uniqueness of both `username` and `email` across other active records (excluding current user `id`), returning specific, user-friendly error messages that map directly to field-level validation indicators.

### Lesson 96: Inline Table Row Editing for Batch Vehicles

- **Context**: In both batch creation (`/batches/new`) and batch editing (`/batches/$batchId` via `BatchEditor.tsx`), adding or editing a vehicle previously opened a modal dialog (`VehicleFormDialog`). This interrupted high-volume vehicle data entry workflows.
- **UI & UX Refinement**:
  - Replaced the modal popup with inline table row editing directly inside the "Danh Sách Xe Trong Lô & Phân Bổ Giá Vốn" table:
    - Clicking the `Pencil` icon on a vehicle transforms that row into editable input fields (`chassisNumber`, `engineNumber`, model `SearchSelect`, color `SearchSelect`, and `MoneyInput` for unit import price).
    - Clicking `+ Thêm xe` appends an inline editing draft row directly in the table.
    - Added quick keyboard interactions: pressing `Enter` inside any field validates and saves the vehicle; pressing `Escape` cancels and exits edit mode.
    - Row action buttons provide explicit Save (`Check` icon) and Cancel (`X` icon) controls.
  - Eliminated `VehicleFormDialog` from both [batches.new.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/batches.new.tsx) and [BatchEditor.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/components/batches/BatchEditor.tsx), creating a streamlined, friction-free data entry experience.

### Lesson 97: Inline Table Row Editing for Batch Expenses / Fees

- **Context**: Just like batch vehicles in Lesson 96, adding or editing batch expenses ("Chi Phí Lô") previously required opening a modal dialog (`ExpenseFormDialog`).
- **UI & UX Refinement**:
  - Replaced the modal popup with inline table row editing directly inside the "Chi Phí Lô" table across both batch creation ([batches.new.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/batches.new.tsx)) and batch editing ([BatchEditor.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/components/batches/BatchEditor.tsx)):
    - Clicking `+ Thêm chi phí` appends an inline editable draft row with `SearchSelect` for expense type, text `Input` for optional description, and right-aligned `MoneyInput` for amount.
    - Clicking the `Pencil` icon on any existing expense row activates inline editing in place.
    - Pressing `Enter` automatically commits and saves the row; pressing `Escape` or clicking `X` cancels editing.
    - Action buttons feature explicit Save (`Check` icon) and Cancel (`X` icon) controls.
  - Eliminated `ExpenseFormDialog` dependency from both route and component files, unifying the inline editing workflow across all batch table sections.

### Lesson 98: Dedicated Dropdown Selects with Quick Creation for Models, Colors, and Expense Types

- **Context**: During inline batch editing, users needed a convenient way to add new motorcycle models, colors, or expense types directly from the dropdowns without having to navigate to "Dữ liệu chung" (`/master-data`).
- **Solution & Components**:
  - Created modular select components following the existing pattern of `SupplierSelect`:
    - `ModelSelect` (`src/components/batches/ModelSelect.tsx`): Integrates `SearchSelect` with `createAction: { label: 'Thêm dòng xe mới', onClick: () => setOpen(true) }` and an inline quick creation dialog (`name`, `modelYear`). Automatically invalidates master data query and selects the new model.
    - `ColorSelect` (`src/components/batches/ColorSelect.tsx`): Integrates `SearchSelect` with `createAction: { label: 'Thêm màu mới', onClick: () => setOpen(true) }` and an inline quick creation dialog (`name`, `hex` with `ColorPicker`). Automatically invalidates master data query and selects the new color.
    - `ExpenseTypeSelect` (`src/components/batches/ExpenseTypeSelect.tsx`): Integrates `SearchSelect` with `createAction: { label: 'Thêm loại chi phí mới', onClick: () => setOpen(true) }` and quick creation dialog.
  - Replaced inline `SearchSelect` implementations in both [batches.new.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/batches.new.tsx) and [BatchEditor.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/components/batches/BatchEditor.tsx) with these dedicated components, providing consistent quick-add buttons inside all dropdown lists for authorized users (`master-data.manage`).

### Lesson 99: Click-to-Edit Row Values, Blur Auto-Save, and Red Validation Borders in Batch Tables

- **Context & User Feedback**:
  - Clicking a separate pencil icon to edit was redundant and disrupted quick entry. Users requested clicking directly on table cells/column values to start editing, with automatic saving when pressing `Enter` or clicking away/unfocusing (`blur`).
  - When required fields are incomplete or invalid during inline editing, unfinished fields must be visibly highlighted with red borders.
- **Implementation Across Batch Creation & Editing**:
  - Applied to both Batch Creation ([batches.new.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/batches.new.tsx)) and Existing Batch Editor ([BatchEditor.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/components/batches/BatchEditor.tsx)):
    1. **Click-to-Edit**:
       - Entire row is interactive (`cursor-pointer hover:bg-emerald-50/40 transition-colors group`).
       - Editable text values display a subtle emerald dashed underline on hover (`border-b border-dashed border-transparent group-hover:border-emerald-600 transition-colors`), providing clear visual affordance.
       - The redundant `Pencil` icon button was removed from table actions.
       - Row delete buttons stop event propagation (`ev.stopPropagation()`) so clicking delete never triggers edit mode.
       - In `BatchEditor.tsx`, locked vehicles (`isSold || isDelivered || isInvoiced`) remain non-interactive with normal badge indicator.
    2. **Debounced Blur Auto-Save**:
       - Handled at `<TableRow onBlur={handleRowBlur}>` with a 120ms timeout checking `currentTarget.contains(activeElement)` and `closest('[data-radix-popper-content-wrapper], [role="dialog"], [data-radix-focus-guard]')`.
       - Prevents premature saves or cancels when switching focus between inputs inside the same row or when interacting with Radix popover dropdowns (`ModelSelect`, `ColorSelect`, `ExpenseTypeSelect`) or quick-create dialogs.
       - Action buttons have `onMouseDown={(ev) => ev.preventDefault()}` to prevent blur before click events execute.
       - Empty newly-added draft rows exit gracefully on blur without showing validation error toasts.
    3. **Red Validation Border Highlighting**:
       - When saving with incomplete fields or upon blur validation, fields missing required values are highlighted with `border-rose-500 ring-1 ring-rose-500 focus-visible:ring-rose-500 bg-rose-50/20`.
       - Vehicle required fields: `chassisNumber`, `engineNumber`, `modelId`, `colorId`, and `importPrice` (> 0).
       - Expense required fields: `expenseTypeId` and `amount` (> 0).

### Lesson 100: Quick Duplicate Vehicle Row Button in Batch Tables

- **Context & User Need**:
  - In motorcycle import batches, many vehicles share identical configurations (`modelId`, `colorId`, and `importPrice`) while having distinct Chassis (`chassisNumber` / VIN) and Engine (`engineNumber`) serial numbers. Manually re-selecting the model, color, and price for dozens of identical vehicles was slow and repetitive.
- **Implementation Across Batch Creation & Editing**:
  - Implemented in both Batch Creation ([batches.new.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/batches.new.tsx)) and Batch Editor ([BatchEditor.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/components/batches/BatchEditor.tsx)):
    - Added a `Copy` icon button (`lucide-react`) in the row action group with tooltip `"Nhân bản xe"`.
    - Clicking `duplicateVehicle(v)` opens a new inline row with `modelId`, `colorId`, and `importPrice` pre-filled, leaving `chassisNumber: ''` and `engineNumber: ''` blank and automatically focused on the chassis input.
    - Prevents event bubbling (`ev.stopPropagation()`) so clicking duplicate directly clones the configuration into a new editing row without triggering existing row selection.
    - In `BatchEditor.tsx`, the duplicate button is available even if the source vehicle has been locked/sold (`isSold || isDelivered || isInvoiced`), allowing staff to quickly duplicate the specifications for new units arriving in the batch.

### Lesson 101: Keyboard Arrow Key Navigation (Left / Right / Up / Down) Across Inline Table Row Fields

- **Context & Requirement**:
  - During rapid batch data entry, users requested being able to navigate across input fields within an inline editing row using keyboard arrow keys (`ArrowLeft` `<-` and `ArrowRight` `->`), similar to spreadsheet software, without relying solely on `Tab`.
- **Implementation & Architecture**:
  - Created reusable `handleRowArrowNavigation(e: React.KeyboardEvent)` in `src/lib/utils.ts` and attached it to `<TableRow onKeyDown={...}>` and row inputs in both [batches.new.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/batches.new.tsx) and [BatchEditor.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/components/batches/BatchEditor.tsx):
    1. **Focusable Elements Query**: Dynamically discovers all active inputs and combobox buttons (`button[role="combobox"]`) within the table row in natural document order.
    2. **Caret-Aware Horizontal Navigation**:
       - For text inputs (`chassisNumber`, `engineNumber`, `importPrice`, `description`, `amount`):
         - `ArrowRight` advances to the next field when the caret reaches the end of the text (`selectionStart === value.length`), if the field is empty, or if text is all selected.
         - `ArrowLeft` moves to the previous field when the caret is at the beginning (`selectionEnd === 0`), if the field is empty, or if text is all selected.
         - Inside the middle of text, standard arrow keys continue to move the caret between characters normally for precise text editing.
         - Upon focusing a target input via arrow keys, its content is automatically selected (`next.select()`), allowing immediate typing or rapid consecutive arrow jumping.
       - For dropdown combobox triggers (`ModelSelect`, `ColorSelect`, `ExpenseTypeSelect` buttons):
         - Since buttons don't have text carets, `ArrowLeft` and `ArrowRight` instantly navigate to adjacent fields when the dropdown is closed.
    3. **Stacked Dropdown Vertical Navigation**:
       - In columns with vertically stacked comboboxes (e.g. Model above Color), pressing `ArrowDown` on Model jumps directly to Color, and `ArrowUp` on Color jumps back to Model.
    4. **Safety & Focus Guards**:
       - Does not intercept arrow keys if a Radix Popover or modal dialog is currently open (`active?.closest('[data-radix-popper-content-wrapper], [role="dialog"]')`), preserving internal dropdown list navigation.

### Lesson 102: Removal of Row Hover Text Underlines in Batch Tables

- **Feedback & Clean UI**:
  - The subtle dashed green underline previously displayed on column values during row hover (`group-hover:border-emerald-600 border-b border-dashed`) was found to be visually noisy and distracting to users.
- **Refinement**:
  - Removed all `border-b border-dashed border-transparent group-hover:border-emerald-600` wrapper spans and classes from table cells across both [batches.new.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/batches.new.tsx) and [BatchEditor.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/components/batches/BatchEditor.tsx).
  - The row-level background highlight (`hover:bg-emerald-50/40`) and pointer cursor (`cursor-pointer`) remain in place, preserving clean, uncluttered visual feedback while clearly communicating row interactivity.

### Lesson 103: Loan Interest Schedule Table — Replacing "Dư Nợ Đoạn Này" with "Gốc Đã Trả" and "Dư Nợ Còn Lại"

- **Context & User Requirement**:
  - In the Bank Loan detail page ([loans.$loanId.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/loans.$loanId.tsx)), the schedule table *"Bảng Tính Lãi Từng Đoạn Theo Dư Nợ Giảm Dần (Quy ước 365 ngày)"* previously had a single column `Dư Nợ Đoạn Này` displaying the starting balance of the interval.
  - Users and project managers requested bringing the two columns from the outer loan list ([loans.index.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/loans.index.tsx)) into the schedule table: **`Gốc Đã Trả`** and **`Dư Nợ Còn Lại`**.
- **Implementation & Domain Logic**:
  1. **Core Financial Engine (`src/lib/business.ts`)**:
     - Extended `InterestSegment` interface with `principalPaid: number` and `remainingBalance: number`.
     - In `calculateLoanInterest`, grouped principal repayments by date and calculated the progressive `cumulativePaid` and `remainingBalance` after each repayment cut point.
     - Preserved exact interest calculation (`outstanding * annualRatePercent * days / 365`) while tracking the post-repayment remaining principal.
  2. **UI & Styling Alignment (`src/routes/loans.$loanId.tsx`)**:
     - Replaced `<TableHead className="text-right">Dư Nợ Đoạn Này</TableHead>` with:
       - `<TableHead className="text-right">Gốc Đã Trả</TableHead>`
       - `<TableHead className="text-right">Dư Nợ Còn Lại</TableHead>`
     - Styled the table cells to match the outer loan list table:
       - `Gốc Đã Trả`: `text-right text-emerald-800 font-medium` (`formatVnd(seg.principalPaid)`).
       - `Dư Nợ Còn Lại`: `text-right font-medium text-purple-900` (`formatVnd(seg.remainingBalance)`).
       - `Lãi Phát Sinh`: `text-right font-medium text-purple-900` (`formatVnd(seg.interest)`).

### Lesson 104: Inline Row Editing — Suppress Toast and Network Mutation When Nothing Has Changed

- **Context & User Pain Point**:
  - In batch tables ([batches.new.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/batches.new.tsx) and [BatchEditor.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/components/batches/BatchEditor.tsx)), clicking into an existing vehicle or expense row to inspect it and then clicking away / blurring previously triggered `saveVehicle` / `saveExpense`, displaying `"Đã cập nhật thông tin xe"` or `"Đã cập nhật chi phí"` even when no fields were modified.
- **Implementation**:
  - Added shallow equality comparison against the original record before dispatching mutations or UI notifications:
    - **Vehicle Comparison**: Checks `(orig.modelId ?? 0) === vDraft.modelId`, `orig.colorId === vDraft.colorId`, `orig.chassisNumber.trim() === chassis`, `orig.engineNumber.trim() === engine`, and `Number(orig.importPrice) === vDraft.importPrice`.
    - **Expense Comparison**: Checks `orig.expenseTypeId === eDraft.expenseTypeId`, `(orig.description?.trim() || null) === (eDraft.description.trim() || null)`, and `Number(orig.amount) === eDraft.amount`.
  - If `hasChanged === false`:
    - Cleanly closes the inline editor (`setEditingId(null)`) and clears submitted status (`setSubmitted(false)`).
    - Skips network requests (`update.mutateAsync`) and avoids firing misleading success toasts.

### Lesson 105: Sales Order Vehicle Picker — Pagination with Infinite Scroll, Search Filter & Bulk Selection

- **Context & Requirement**:
  - In the sales creation flow ([sales.new.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/sales.new.tsx)), the vehicle selection dialog ("Chọn Xe Từ Kho Để Bán") previously rendered the entire list of available unsold vehicles in a single batch without pagination or filtering. In large warehouse inventories, this degraded rendering performance and made discovering vehicles tedious.
- **Architecture & Implementation**:
  1. **Dual Scroll Detection (Scroll Event + IntersectionObserver)**:
     - Implemented `PICKER_PAGE_SIZE = 15`. `visibleVehicles = filteredAvailableVehicles.slice(0, visibleCount)`.
     - Attached `onScroll` to the scrollable table container checking `target.scrollTop + target.clientHeight >= target.scrollHeight - 120`.
     - Additionally attached an `IntersectionObserver` to a bottom sentinel element (`sentinelRef`) with `rootMargin: '120px'` so scrolling automatically loads the next chunk of vehicles smoothly.
     - Displays progressive status: animated spinner when more rows exist (`Đang cuộn tải thêm xe (X/Y)...`) and completion notice when reaching the end (`Đã hiển thị toàn bộ Y xe`).
  2. **Real-time Substring Filter**:
     - Added an inline search box filtering across `chassisNumber`, `modelName`, `colorName`, and `batchLabel(v)`.
     - Dynamically resets `visibleCount` to `PICKER_PAGE_SIZE` and scrolls back to top when typing or clearing search.
  3. **Multi-Page Selection State & Header Master Checkbox**:
     - `tempChecked: Set<number>` preserves selections across all pages and filtered queries.
     - The table header includes a tri-state master checkbox (`allFilteredChecked ? true : someFilteredChecked ? 'indeterminate' : false`) allowing one-click selection / deselection of all matching vehicles.
     - The dialog footer provides a "Bỏ chọn tất cả" shortcut alongside total selected count.
  4. **Fixed Header & Footer Layout**:
     - `DialogContent` formatted as a flex column (`flex flex-col p-6 overflow-hidden max-h-[85vh]`) with sticky table headers (`sticky top-0 bg-slate-50 z-10`), keeping the search input, headers, and confirmation buttons accessible at all times while the table scrolls independently.

### Lesson 106: Multi-Dimensional Filter Dropdowns & Real-Time Search in Vehicle Lists

- **Context & Requirement**:
  - In addition to text search and infinite scrolling, users requested comprehensive filtering capabilities for discovering vehicles rapidly across large inventories and batch manifests.
- **Implementation Across Modules**:
  1. **Sales Order Vehicle Picker ([sales.new.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/sales.new.tsx))**:
     - Added 3 dynamic dropdown filters derived automatically from `availableVehicles`:
       - **Dòng xe (Model)**: Populated with unique models from available stock.
       - **Màu sắc (Color)**: Populated with unique colors from available stock.
       - **Lô nhập (Batch)**: Populated with unique batches formatted as `Lô dd/mm/yyyy · Nhà cung cấp`.
     - Integrated with the live text search input (searching `chassisNumber`, `engineNumber`, `modelName`, `colorName`, and `batchLabel`).
     - Added a `Xóa lọc` (`RotateCcw`) button when any filter or search query is active to reset all parameters in one click.
     - Resets `visibleCount` to `PAGE_SIZE` and scrolls back to top when filters change.
  2. **Batch Vehicles Table ([BatchEditor.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/components/batches/BatchEditor.tsx))**:
     - Added an inline search bar and Model / Color filter dropdowns above the batch vehicle table.
     - Automatically hides filter dropdowns if only 1 model or color exists in the batch to avoid UI clutter.
     - Guarantees that any row currently being edited (`editingVehicleId === v.id`) remains visible even if it temporarily doesn't match active filter criteria.

### Lesson 107: Dual Inventory Badge Standardization — Receipt/Invoice State Always Last

- **Context & User Requirement**:
  - The previous badge text `"Còn ở cả 2 kho"` caused misunderstanding among users and staff, leading them to believe the vehicle was physically located in two separate warehouses.
  - Additionally, previous badge text had inconsistent ordering (e.g. `"Đã HĐ · Chưa giao"` had invoice first and delivery last, whereas `"Đã giao · Chưa HĐ"` had delivery first and invoice last).
  - Users explicitly requested:
    1. Making the label wording more appropriate and unambiguous.
    2. Enforcing that the **receipt/invoice inventory state is always placed last**.
- **Standardized 4-State Nomenclature**:
  - Format: `[Trạng thái kho thực tế] · [Trạng thái kho hóa đơn]`
  1. `!isDelivered && !isInvoiced` $\rightarrow$ **`Chưa giao · Chưa HĐ`** (Slate neutral badge, replaces misleading `"Còn ở cả 2 kho"`).
  2. `!isDelivered && isInvoiced` $\rightarrow$ **`Chưa giao · Đã HĐ`** (Amber warning badge, delivery state first, invoice state last).
  3. `isDelivered && !isInvoiced` $\rightarrow$ **`Đã giao · Chưa HĐ`** (Sky info badge, delivery state first, invoice state last).
  4. `isDelivered && isInvoiced` $\rightarrow$ **`Đã giao · Đã HĐ`** (Emerald success badge, delivery state first, invoice state last).
- **Interactive Tooltips**:
  - Every badge variant in [DualInventoryBadge.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/components/inventory/DualInventoryBadge.tsx) is wrapped in a `TooltipProvider` with detailed hover explanations showing dispatch timestamps (`deliveredAt`) and invoice issuance timestamps (`invoicedAt`).

### Lesson 108: Multi-Select Filter Dropdowns Standardized Across Sales, Inventory, and Batches

- **Context & Requirement**:
  - Filter dropdowns previously relied on single-select `SearchSelect` or standard HTML `<Select>`, forcing users to clear and re-select one option at a time.
  - Users requested converting filter dropdowns across dialogs and tables to multi-select using the standardized `MultiSearchSelect` component (from `#/components/ui/multi-search-select.tsx`).
- **Implementations**:
  1. **New Sales Order Vehicle Picker Modal (`/sales/new`)**:
     - Converted `filterModelIds` (Dòng xe), `filterColorIds` (Màu xe), and `filterBatchIds` (Lô nhập) into multi-value arrays (`number[]`).
     - Rendered with `MultiSearchSelect`, supporting search, item checkboxes, selected count badge, and a bulk "Bỏ chọn tất cả" button.
     - Preserved sticky header select-all checkbox, pagination infinite scroll, and keyword search integration.
  2. **Inventory Advanced Filter Modal (`/inventory`)**:
     - Converted `delivered` (Giao xe) and `invoiced` (Hóa đơn) from single-value enums to array multi-selects (`z.array(z.enum(['yes', 'no']))`).
     - Replaced single `SearchSelect` with `MultiSearchSelect` for both delivery and invoice filter dropdowns.
  3. **Batch Vehicle Table Filters (`BatchEditor.tsx`)**:
     - Converted `vehicleModelFilters` and `vehicleColorFilters` from single select `<Select>` to `MultiSearchSelect`.
     - Preserves editing row isolation so that a row being actively edited remains visible regardless of filter toggles.

### Lesson 109: Bank Loan Repayment History Inline CRUD and Table Unification

- **Context & Requirement**:
  - Previously, bank loan repayment transactions under `/loans/$loanId` were displayed in a read-only table with a separate create form positioned at the bottom of the page. Users were unable to edit or delete existing repayment entries.
  - Users requested the ability to delete and edit repayment transactions with the same inline editing and creation experience seen in batch editors (`batches/new` and `BatchEditor.tsx`).
- **Backend Implementation**:
  - Added `updateLoanRepayment` and `deleteLoanRepayment` services in [src/server/services/finance.ts](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/server/services/finance.ts).
  - Enforced statement reconciliation safeguard `assertNotMatched('loan_repayment', id)` to block editing or deleting repayments that have already been matched with uploaded bank statement lines.
  - Enforced debt guard preventing principal updates from exceeding remaining loan balance.
  - Exposed server functions `updateLoanPaymentFn` and `deleteLoanPaymentFn` in [src/server/fns/finance.ts](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/server/fns/finance.ts) protected by `loans.manage` permission.
- **Frontend Implementation**:
  - Replaced the disconnected bottom form with an integrated inline row creation/editing system directly within the "Lịch Sử Các Đợt Đã Trả Nợ" table in [src/routes/loans.$loanId.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/loans.$loanId.tsx).
  - Added `+ Thêm đợt trả nợ` button in the card header opening an inline entry row (`editingRepaymentId === 'new'`).
  - Clicking on any existing row switches it into inline editing mode (`editingRepaymentId === r.id`).
  - Supported inline date input, principal and interest `MoneyInput`, and `BankAccountSelect`.
  - Added red border validation highlights (`border-rose-500 ring-1 ring-rose-500 bg-rose-50/20`) on unfinished fields when submitted.
  - Supported `Enter` to save, `Escape` to cancel, blur-to-save (with radix modal/popover isolation), and arrow key row navigation `<-` / `->` via `handleRowArrowNavigation`.
  - Added confirmation modal (`confirmDialog`) for deleting repayment entries with toast feedback.

### Lesson 110: Textarea Input for Bank Statement Descriptions in Import and Edit Dialogs

- **Context & Requirement**:
  - Bank statement transaction descriptions are typically long, multi-line narration strings from bank wire transfers (e.g. transfer remarks, counterparty identifiers, account numbers).
  - Users requested converting the description input to a multi-line `Textarea` so narration strings can be comfortably viewed, pasted, and edited.
- **Implementation**:
  - In [src/components/finance/ImportStatementDialog.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/components/finance/ImportStatementDialog.tsx):
    - Replaced the single-line `Input` with `Textarea` (`rows={3}`, `min-h-[4.75rem]`, `resize-y`) so multi-line narration is comfortably visible with at least 3 full lines.
    - Extended `handlePaste` parameter signature to accept `React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>` so batch copy-pasting from Excel continues working seamlessly directly into the description cell.
  - In [src/routes/reconcile.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/reconcile.tsx):
    - Converted the statement line edit modal description field (`editLine.description`) to `Textarea` (`rows={3}`, `min-h-[4.75rem]`, `resize-y`).

### Lesson 111: Reconcile Match Details Inspection, UI Language Standardization, and Sidebar Visibility

- **Context & Requirements**:
  1. **Bank Statement Reconciliation (`/reconcile`)**:
     - Removed raw English match tags (`(payment)`, `(receipt)`, `(loan_repayment)`) from the "Đối chiếu" column and replaced with clear Vietnamese labels (`Đã khớp · Phiếu chi`, `Đã khớp · Phiếu thu`, `Đã khớp · Trả nợ khế ước`).
     - Added a dedicated button "Xem khớp" with `<Eye />` icon (and made the match badge clickable) allowing users to inspect the exact linked internal document (customer/supplier/loan contract, date, amount, details note, and direct link).
     - Upgraded "Hủy khớp" to a standardized action button "Gỡ khớp" with `<Unlink />` icon and loading feedback.
     - Enriched `getBankStatementDetailFn` in [src/server/fns/finance.ts](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/server/fns/finance.ts) to batch load matched voucher details for matched lines.
  2. **Receivables & Branch Label Normalization**:
     - Standardized colloquial "Trực tiếp KH mẹ" to formal "Công ty mẹ (Trực tiếp)" across [src/routes/finance.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/finance.tsx), [src/routes/sales.index.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/sales.index.tsx), and [src/routes/sales.$orderId.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/sales.$orderId.tsx).
  3. **Dashboard Cleanup (`src/routes/index.tsx`)**:
     - Removed the dual-inventory alert banners (`Kho hóa đơn đã xuất — Xe còn tại kho` and `Đã giao xe vật lý — Chưa lập hóa đơn`) per user request.
  4. **Sidebar Contrast & Legibility (`AppLayout.tsx`)**:
     - Changed sidebar navigation link text, parent buttons, icons, and group section titles to bright white (`text-white/90`, `text-slate-200`, `text-slate-300`) for high contrast against `bg-ink-900`.

### Lesson 112: Bank Loan Interest Cap Validation and Current Debt & Accrued Interest Tracking

- **Context & Requirements**:
  - In `/loans/$loanId`, users were previously able to input arbitrary interest payments exceeding the total interest accrued on the loan at that payment date (e.g. paying hundreds of millions or billions in interest when only a few million had accrued).
  - Users requested:
    1. Displaying clearly how much interest is currently left unpaid (`Lãi còn nợ đến nay`) and how much total debt is currently owed (`Tổng nợ hiện tại = Dư nợ gốc còn lại + Lãi còn nợ`).
    2. Throwing an explicit validation error if an interest payment exceeds the interest accrued up to that payment date.
- **Backend Implementation**:
  - In [src/server/services/finance.ts](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/server/services/finance.ts) inside `recordLoanRepayment` and `updateLoanRepayment`:
    - Validated that `paymentDate >= loan.disbursementDate`.
    - Computed exact accrued interest from disbursement date up to `paymentDate` via `calculateLoanInterest`.
    - Enforced interest ceiling: `maxAllowedInterest = Math.max(0, interestAtPaymentDate.totalInterest - otherInterestPaid)`.
    - Threw `BusinessError`: `Số tiền trả lãi (${formatVnd(interestAmount)}) vượt quá số lãi phát sinh lũy kế đến ngày ${formatDate(paymentDate)} (tối đa: ${formatVnd(maxAllowedInterest)})` if exceeded.
- **Frontend Implementation**:
    - Removed estimated interest line (`Lãi ước tính: ...`) from `PageHeader` description.
    - Contextualized metrics directly inside table headers to completely eliminate redundancy and separate card/ribbon clutter:
      1. **Top Table ("Bảng Tính Lãi Từng Đoạn")**: Displays accumulated interest: `Lãi phát sinh lũy kế: {formatVnd(loanDetail.accruedInterest)}`.
      2. **Bottom Table ("Lịch Sử Các Đợt Đã Trả Nợ")**: Displays currently owed amounts: `Gốc còn nợ: {formatVnd(loanDetail.outstanding)} • Lãi còn nợ: {formatVnd(currentInterestLeft)} • Tổng nợ: {formatVnd(currentTotalOwing)}`.
    - Real-time client validation in `renderEditingRow`: inputs display red ring/border when exceeding ceilings while error explanation text is rendered in a dedicated alert banner above the table, keeping all inputs in the table row vertically centered and baseline-aligned.
    - Inline edit simplification: clicking anywhere on a repayment row activates inline editing mode, so the redundant pencil icon was removed from the actions column.

### Lesson 113: Filter Popup Dialog and Infinite Scroll Pagination for Bank Statement Reconciliation Matches

- **Context & Requirements**:
  - In `/reconcile`, the suggestion modal ("Gợi Ý Chứng Từ Khớp Với Giao Dịch Sao Kê") previously displayed an unfilterable flat list limited to $\pm 5$ days.
  - Users requested a filter popup dialog and pagination with infinite scroll to easily find and match internal vouchers (receipts, payments, loan repayments) against statement lines.
- **Backend Enhancements**:
  - In [src/server/services/finance.ts](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/server/services/finance.ts) inside `suggestMatches`:
    - Broadened candidate search interval from $\pm 5$ days to $\pm 60$ days (`INTERVAL 60 DAY`) to capture a wide window of potential matching vouchers.
    - Added voucher notes and descriptions into candidate objects (`paymentVouchers.description`, `loanRepayments.note`) for rich searchability.
- **Frontend Enhancements**:
  - In [src/routes/reconcile.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PHẦN%20MỀM%20QUẢN%20LÝ%20XE%20MÁY%20TRƯỜNG%20THỊNH%20PHÁT/src/routes/reconcile.tsx):
    - Added in-modal search toolbar with clear button, counter `Hiển thị X / Y chứng từ`, and "Bộ lọc" popup button with active filter badge.
    - Added a nested Filter Popup Dialog (`<Dialog open={showSuggestFilters}>`) allowing multi-selection of voucher types (`Phiếu Thu`, `Phiếu Chi`, `Trả Nợ Khế Ước`), date range (Từ ngày - Đến ngày), and amount range with `PriceRangeFilter`.
    - Implemented infinite scroll pagination: `SUGGEST_PAGE_SIZE = 6`, `visibleSuggestions` slice, scroll listener (`handleSuggestScroll`), loading sentinel (`Loader2`), and completion indicators.
    - Clean reset of suggestion pagination and search filters whenever a new statement line is opened for matching.

---

### Lesson 114: Brand Colour Is Blue `#6b9ace` (supersedes the jade palette of Lesson 18)

- **Client decision**: the whole site uses the blue `#6b9ace` (≈ `oklch(0.682 0.072 254)`). Because pages use `emerald-*` / `teal-*` / `slate-*` / `ink-*` classes directly, `src/styles.css` remaps those scales (hue 254 / 238 / 255) instead of editing pages: `emerald-400` is the exact brand colour, `emerald-600/700` are darker shades used for buttons and text so white text stays readable. `--primary`, `--ring`, `--accent`, chart-1 and the sidebar variables follow the same hue; the sidebar ink is now deep navy.
- **Gotcha**: "emerald" now means blue, so positive-money green and invoiced-stock blue (`blue/sky`) look alike; rose (errors) and amber stay unchanged. The logo (`BrandMark.tsx`) is a white "T" on a `#6b9ace` → `emerald-700` tile, and `public/favicon.svg` matches it (linked as `/favicon.svg?v=2` in `__root.tsx`; bump `v` when the icon changes, browsers cache favicons hard); brass is now only used for the active-nav marker, the loading bar and small captions. Class names still say `emerald` on purpose.
- **Not changed**: hardcoded hex values in `LocaleSwitcher.tsx` and the colour-picker presets.
- **Update 2 — navy sidebar (supersedes the blue sidebar below)**: a solid `#6b9ace` sidebar was too bright ("blinding"), so `ink-*` and `--sidebar` are now a deep navy of the same hue (`ink-900` = `#1e2c3f`); this also applies to the auth brand panel. `#6b9ace` stays the accent there: the active nav item is a `bg-emerald-500` (`#6b9ace`) pill with white text, other items `text-slate-200` with `slate-400` icons and a `white/7` hover, group titles `slate-400`, the logo caption and the auth panel icons `emerald-400`, the logo border `ring-1 ring-white/20`. Buttons and accents in the content area are unchanged (exact `#6b9ace`).
- **Update — exact colour, never darkened (client request)**: `#6b9ace` is now used as-is, not as a darker shade: `emerald-500/600/700`, `--primary`, `--ring`, chart-1 and all `ink-*` are exactly `#6b9ace`, so primary buttons (`bg-emerald-700`), the left menu and the auth brand panel (`bg-ink-900`) are the brand blue. `emerald-800` (`#5f8fc4`) is only the button hover. Text and icons on those blue panels are white / `white/70–90` (grey, brass and `emerald-300` were unreadable there); the active nav item is a solid white pill with `text-ink-900` (blue) text and icon (no side marker), other items are full white with a `white/16` hover, group titles `white/70`. The logo and favicon are a flat `#6b9ace` tile with a white "T" and a white rim (`ring-2 ring-white/70`) so the logo stays visible on the blue menu. Trade-off accepted by the client: white text on `#6b9ace` has low contrast (~2.9:1). `text-emerald-700` labels are now the same light blue.

### Lesson 115: Full-Width Layout on Large Screens & ERP Terminology Polish

- **Context & Bug**:
  - Reviewer noted: `@huynhtanbao hiện cái main content của các trang, khi ở 1 màn hình lớn thì trang nó không tự động rộng ra full` (with a screenshot of `/settings?tab=users` showing the table restricted to a narrow box in the center with huge empty gutters on wide monitors).
  - Cause: In [src/components/layout/AppLayout.tsx](file:///c:/Users/huynh/OneDrive/Documents/github/PH%E1%BA%A6N%20M%E1%BB%80M%20QU%E1%BA%A2N%20L%C3%9D%20XE%20M%C3%81Y%20TR%C6%AF%E1%BB%9CNG%20TH%E1%BB%8ANH%20PH%C3%81T/src/components/layout/AppLayout.tsx), `<main>` had hardcoded `max-w-[1400px] w-full mx-auto`.
  - Fix: Removed `max-w-[1400px] mx-auto` and added `min-w-0` (`<main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 w-full min-w-0">`), and synchronized `<header>` gutters with `lg:px-8`. Across the entire website, tables, forms, and cards now fluidly expand to 100% of the available width on high-resolution and ultrawide displays.
- **Terminology & Reconciliation UI Polish**:
  - Renamed "Bàn làm việc" to "Tổng quan" in navigation, breadcrumbs, page header, and permissions catalogue (`dashboard.view`).
  - Balanced the `/reconcile` table action buttons by setting "Gỡ khớp" to `variant="outline"` (`border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-medium`) and removing disabled edit/delete buttons from matched rows, ensuring smooth vertical alignment without layout jumps.

### Lesson 116: Supplier Image, Address and Supplier Popup (`SupplierDetailDialog`)

- **Client request** (review chat on `/finance?tab=payables` and `?tab=payments`): the supplier column must link to a detail page, suppliers get an **image**, and the detail page shows **only the name and the image**.
- **Data**: `suppliers.image` (varchar 500, nullable; migration `0036_supplier_image.sql`, applied). Same storage rule as bank logos (Lesson 70): an https address or an upload key `suppliers/<uuid>.png`; `'suppliers'` was added to `UPLOAD_FOLDERS`. `saveSupplierFn` accepts `image` (shared `imageField` validator) and deletes the old file when the logo is replaced or removed; `deleteMasterDataFn` deletes the file of a deleted bank **or supplier**. **`getMasterDataFn` selects every supplier column, so the app fails until `npm run migration:run` has applied 0036.**
- **UI**: `/master-data?tab=suppliers` shows the logo next to each name and the supplier dialog has an image field. It uses the new reusable `LogoField` / `uploadImage` (`src/components/ui/logo-field.tsx`: preview stays in the browser, the file is sent to `/api/uploads` only on save) and `SupplierLogo` (`supplier-logo.tsx`, building icon fallback). The bank dialog still has its own inline copy of this logic; use `LogoField` for new image fields.
- **Popup (replaces the page)**: the first version was a page `/suppliers/$supplierId`; it was removed (route file, `getSupplierDetailFn`, `supplierDetailQuery`) in favour of `src/components/suppliers/SupplierDetailDialog.tsx`. `SupplierLink` (a button styled as a link that opens the dialog) is used wherever a supplier name is shown; `SupplierDetailDialog` reads the supplier from the cached master data (`masterDataQuery`, which already returns image and address). View mode shows image, name and address with "Đóng" and, inside `<Can permission="master-data.manage">`, a **"Chỉnh sửa"** button that switches the same dialog to edit mode (name, address, image via `LogoField`; "Hủy" returns to view, "Lưu Nhà Cung Cấp" saves with `saveSupplierFn` and invalidates all queries). It always reopens in view mode. `saveSupplierFn` caps name and address at 255 characters (Lesson 124).
- **Where the popup opens from**: the supplier name in `/finance` → "Công Nợ Nhà Cung Cấp" and "Lịch Sử Phiếu Chi" (a payment to a non-supplier payee stays plain text), the `/batches` list, the `/batches/$batchId` header and the `/master-data` supplier table.
- **Address (follow-up)**: the existing `suppliers.address` column is now editable ("Địa Chỉ" textarea in the supplier dialog, a column in the `/master-data` table, included in the search) and shown under the name on the supplier page ("Chưa có địa chỉ" when empty). No migration needed. Tax code, email and note are still not shown anywhere.
- **Rule**: a new screen with a supplier column should render the name with `<SupplierLink supplierId={...}>` and return `supplierId` from its query (`listBatchesFn` now does). Other screens only show a supplier inside a text label (e.g. the lot label "Lô dd/mm/yyyy · supplier" in inventory, which links to the batch).

### Lesson 117: Dropdown Options Use the Same Text Size as the Selected Value

- **Client feedback**: in dropdowns (e.g. "Điểm Bán Thanh Toán") the option list text was smaller than the selected value in the box ("font chữ không đối xứng").
- **Cause**: triggers are `text-sm` (Lesson 67) but `SearchSelect` / `MultiSearchSelect` options, their empty-state line and the "create" action were `text-xs`, and 81 `SelectItem` / `SearchSelectItem` usages across routes passed `className="text-xs"`.
- **Fix**: options in `search-select.tsx` and `multi-search-select.tsx` are `text-sm py-2` (footers `text-xs`); all `text-xs` / `text-[Npx]` classes were removed from item `className`s (`SelectItem`, `SearchSelectItem`, `MultiSearchSelect` children, including the page-size select in `table-pagination.tsx`).
- **Rule**: never put a font-size class on a dropdown item; options inherit `text-sm` from the component so they always match the trigger.

### Lesson 118: Vehicle Picker (`/sales/new`) — Filters in Their Own Dialog, Colour Swatches

- **Client feedback** ("fix UI"): the three dropdown filters sat in a row under the search box of "Chọn Xe Từ Kho Để Bán", which looked crowded. They now live in a separate **"Bộ Lọc Xe"** dialog (same pattern as Lessons 91 and 113): the picker keeps only the search box, a "Bộ lọc" button with a count badge (number of active dropdown filters: model / colour / batch), "Xóa lọc" (clears search and filters) and the "Hiển thị x / y xe" counter. The dialog has labelled `MultiSearchSelect`s for Dòng xe, Màu xe and Lô nhập, "Xóa lọc" and a primary button "Xem N xe" that closes it. Changing a filter resets the list to the top (`resetPickerScroll`). State is local (`filtersOpen`), not in the URL, because the picker is a dialog.
- **Colour swatch**: the colour filter options use `ColorLabel` (swatch of `colors.hex`, Lesson 62) with `keywords={name}` so search by name still works, and the colour under the model in the picker table shows the swatch too. The hex comes from `listVehicles` (`colorHex`), no server change. The already-added vehicles list (`items` state) does not store the hex, so it still shows plain text.

### Lesson 119: Motorcycle Model Has No Year (`model_year` dropped)

- **Client request**: remove "Đời xe" at the database level. `motorcycle_models.model_year` is gone (migration `0037_drop_model_year.sql`, applied; its down section re-adds an empty `varchar(20)`, the data cannot come back). The only model at the time (`SH`) had no year, so nothing was lost.
- **Code**: removed from the schema, `saveModelFn`, the `/master-data` model dialog, table column and search, the quick-create dialogs (`ModelSelect`, `VehicleFormDialog`), `ModelOption` and `modelLabel` (now "Hãng Dòng", e.g. "Honda SH 150i"). The models tab subtitle is "Danh sách dòng xe nhập khẩu." This supersedes the "Đời xe" parts of Lessons 69 and 73; a model is now just a name (plus the optional brand and suggested colour columns).
- **Gotcha**: the migrations 0036 / 0037 were written by hand and have no drizzle snapshot in `src/db/migrations/meta/`; the custom runner does not need one, but `npm run db:generate` would diff against the 0035 snapshot and re-emit those two changes.

### Lesson 120: Loan Pages — Compact Bank Account Select, Newest Repayment First, Slim `/loans` Filter

- **Client feedback** (review chat on `/loans/3` and `/loans`):
  1. The bank account select in the inline repayment row showed the long bank name and overlapped the neighbouring cells. `BankAccountSelect` has a new `compact` prop (logo + account number only, no bank name); the repayment row uses it. Search still finds the account by bank name, code and short name (they are in `keywords`). Other screens (receipt / payment dialogs) keep the full "bank • number" label.
  2. "Lịch Sử Các Đợt Đã Trả Nợ" is sorted by payment date descending (same day: highest id first) through `sortedRepayments` before pagination; the order has no effect on the interest maths.
  3. The `/loans` filter dialog now has only: contract number search, bank (multi), disbursement date from / to and loan amount min / max (`PriceRangeFilter`). The status filter, the outstanding-balance range and the "Sắp xếp theo / Thứ tự" selects were removed (search params `status`, `minOutstanding`, `maxOutstanding` are gone). Sorting is still available by clicking the column headers (Lesson 91).

### Lesson 121: `/inventory` Splits the Dual-Stock Column Into Two (Trạng Thái / Trạng Thái HĐ)

- **Client feedback**: the single "Kho Kép (2 Kho)" column was confusing, so it became two columns: **"Trạng Thái"** (physical warehouse: `Đã giao` / `Chưa giao`, from `is_delivered`) and **"Trạng Thái HĐ"** (invoiced stock: `Đã HĐ` / `Chưa HĐ`, from `is_invoiced`). The flags stay independent (Core Domain Rule 4): each badge is built from its own flag; the other flag only decides the colour.
- **Components** (`DualInventoryBadge.tsx`): new `DeliveryStatusBadge` and `InvoiceStatusBadge` (shared `StatusChip`, tooltips with the delivery / invoice date). Colours: `Đã giao` emerald, `Đã HĐ` blue, `Chưa …` slate, and a pulsing **amber** when the stocks disagree (invoiced but still in the warehouse → "Chưa giao" amber; delivered but not invoiced → "Chưa HĐ" amber), so the normal "invoiced, awaiting pickup" case stays visible without being treated as a bug. The combined `DualInventoryBadge` (the four "Đã giao · Chưa HĐ" chips of Lesson 107) is still used on the dashboard's "Kho Kép" column; switch it to the two badges if the client wants the same split there.
- The empty-state `colSpan` on `/inventory` is now 10 (9 without the actions column).

### Lesson 122: Form Submission on Enter & Auto-Scroll on New Row (`ImportStatementDialog`)

- **Context & Bug**:
  - In `ImportStatementDialog` ("Nhập Sao Kê Ngân Hàng"), pressing `Enter` on the keyboard after entering transaction data (e.g. into the credit / debit money inputs or description textarea) did not submit the form.
  - Adding rows in the scrollable table left the newly created row below the fold, forcing users to manually scroll down to see it.
  - Cause: The dialog body was not wrapped in an HTML `<form>` element, the submit button had `type="button"`, the textarea didn't capture unshifted `Enter`, and the table container lacked a scroll ref.
  - Fix: Wrapped dialog contents inside `<form onSubmit={handleSubmit}>`, changed submit button to `type="submit"`, updated `handleSubmit` to prevent default form submission, added `onKeyDown` to the description `<Textarea>` so pressing `Enter` without `Shift` also submits the form, and added `tableScrollRef` with smooth auto-scroll to the bottom on `addRow` and `handlePaste`.

### Lesson 123: Vehicle Picker (`/sales/new`) Is Paginated Instead of Infinite Scroll

- **Client request**: the "Chọn Xe Từ Kho Để Bán" dialog uses page numbers like every other list. This replaces the infinite scroll of Lesson 105 (`PICKER_PAGE_SIZE`, `visibleCount`, scroll handler, `IntersectionObserver` sentinel and the "Đang cuộn tải thêm xe" loader are gone).
- **How**: `usePagination(filteredAvailableVehicles, key)` + `<TablePagination>` (Lesson 39; 10 per page, "Hiển thị 1–7 / 7", rows-per-page select, numbered buttons). The key holds `pickerOpen` and the search / filter values, so a new search, a filter change or reopening the dialog returns to page 1. The table scrolls inside `max-h-[45vh]` with a sticky header and the pagination bar sits below it.
- **Selection** (`tempChecked`) still survives page and filter changes. The header checkbox now selects / clears **the current page**; a footer link "Chọn tất cả N xe" (shown when the filtered list is longer than the page) selects every vehicle matching the search / filters across pages, and "Bỏ chọn tất cả" clears everything.

### Lesson 124: Over-Long Values Never Reach the Database (bank account quick-create)

- **Bug** (screenshot from `/loans/2`): typing very long text in the "Thêm Tài Khoản Ngân Hàng" quick-create dialog (`BankAccountSelect`) made MySQL reject the insert, and the raw `Failed query: insert into company_bank_accounts ... params: ...` text was printed inside the dialog, overflowing it (the dialog used `err.message` directly, against Lesson 64).
- **Fix**: (1) `saveBankAccountFn` validates the column limits (account number ≤ 50, account name ≤ 255, branch ≤ 150) so the user sees "Số tài khoản: Tối đa 50 ký tự"; the new field names are in `FIELD_TRANSLATIONS`. (2) The inputs in `BankAccountSelect` and in the `/master-data` bank account dialog have `maxLength`. (3) The dialog error goes through `formatErrorMessage` and wraps (`whitespace-pre-line break-words`). (4) Safety net: `isTooLongError` (MySQL 1406 / `ER_DATA_TOO_LONG`, `services/common.ts`) makes `wrapDup` in `server/fns/master-data.ts` answer "Nội dung nhập quá dài, vui lòng rút gọn lại" for every master-data save, whatever its field.
- **Rule**: a `varchar(N)` column needs `.max(N)` in its validator and `maxLength={N}` on its input; other save functions (suppliers, banks, models…) still rely only on the `wrapDup` safety net.

### Lesson 125: Loading State on Repayment Deletion (`/loans/$loanId`)

- **Context & Request**:
  - On the loan contract detail page (`/loans/$loanId`), in the "Lịch Sử Các Đợt Đã Trả Nợ" table, clicking the trash icon to delete a repayment transaction showed no visual feedback while the server mutation `deleteRepayment` was processing.
- **Fix**:
  - Replaced `<Trash2>` with `<BusyTrash busy={isBusy(`repayment:${r.id}`)} />` from `#/components/ui/busy-trash.tsx`.
  - Added `useBusyKeys()` hook tracking `repayment:${r.id}` throughout `handleDeleteRepayment` execution (`setBusy(busyKey, true)` in `try`, `setBusy(busyKey, false)` in `finally`).
  - Disabled the button when `isBusy(`repayment:${r.id}`)` is true to prevent duplicate clicks during deletion.

### Lesson 126: Loading Indicators on Saving Inline Edits (`/loans/$loanId`, `BatchEditor`, etc.)

- **Context & Request**:
  - When saving an inline repayment row on the loan detail page (`/loans/$loanId`), the checkmark icon (`<Check>`) remained static with no visual feedback while the server mutations (`repayLoan` / `updateRepayment`) were in flight.
- **Fix**:
  - In `loans.$loanId.tsx`, defined `isSaving = repayLoan.isPending || updateRepayment.isPending`.
  - Replaced the check icon with `{isSaving ? <Loader2 className="size-4 animate-spin text-purple-700" /> : <Check className="size-4" />}`.
  - Disabled the save and cancel buttons as well as input controls while `isSaving` is true, guarding `saveRepaymentInline`, `startAddRepayment`, `startEditRepayment`, and blur events against duplicate triggers.
  - Also updated inline editing save buttons in `BatchEditor.tsx` (batch expenses and vehicles) to render `<Loader2 className="size-4 animate-spin text-emerald-700" />` when `isSaving` is true, and added spinners to form submit actions in `sales.new.tsx` and `batches.new.tsx`.

### Lesson 127: Save On Enter / Button Only — No Auto-Save On Unfocus (`/loans/$loanId`)

- **Context & Bug**:
  - In `loans.$loanId.tsx` ("Lịch Sử Các Đợt Đã Trả Nợ"), `handleRepaymentRowBlur` triggered `saveRepaymentInline()` after a 120ms timeout whenever focus left the table row.
  - This caused accidental premature saves and validation errors whenever users clicked between controls, opened the `BankAccountSelect` dropdown, or clicked outside before completing all inputs.
- **Fix**:
  - Removed `handleRepaymentRowBlur` and the `onBlur` listener from the editing `<TableRow>`.
  - Saves now only occur explicitly when the user presses `Enter` on the keyboard (or clicks the checkmark save button).
  - Preserved escape key (`Escape`) and cancel button (`X`) to cancel edits.
  - In `handleRepaymentKeyDown`, checked that `Enter` does not trigger row saving when selecting items within dropdown popovers / dialogs.

### Lesson 128: Empty Default Interest When Adding Repayment Row (`/loans/$loanId`)

- **Context & Request**:
  - When clicking "Thêm đợt trả nợ", `startAddRepayment` calculated and prefilled the maximum accrued interest (`maxToday`) into `rDraft.interestAmount`.
  - The client preferred the interest field ("Tiền Lãi") to start empty (0 with placeholder `Tiền lãi`), matching the principal input ("Tiền Gốc").
- **Fix**:
  - Initialized `interestAmount: 0` in `startAddRepayment` and removed unused interest calculation in the handler. With `blankZero` enabled on `MoneyInput`, it displays empty with placeholder text until typed.
  - The maximum allowed interest calculation (`maxInterestAllowed`) continues to run dynamically for ceiling validation and tooltips.

### Lesson 129: Prevent Double-Submit on Keyboard Enter (`/loans/$loanId`)

- **Context & Bug**:
  - Pressing `Enter` to save an inline repayment row occasionally created two identical database records ("i save once but it create 2 transaction row").
  - Root Cause:
    1. Both `<TableRow>` and child `<Input>` / `<MoneyInput>` components attached `onKeyDown={handleRepaymentKeyDown}` without `e.stopPropagation()`. When pressing `Enter` on an input, the handler executed on the input, then bubbled up to the table row and executed a second time in the exact same event tick.
    2. Because `isSaving` relied only on React mutation state (`repayLoan.isPending`), which updates asynchronously on the next render, both synchronous invocations passed the `if (isSaving) return` check and sent dual `mutateAsync` requests.
- **Fix**:
  - Removed redundant `onKeyDown={handleRepaymentKeyDown}` from child `<Input>` and `<MoneyInput>` controls, leaving single responsibility to `<TableRow>`.
  - Added `e.stopPropagation()` in `handleRepaymentKeyDown`.
  - Added a synchronous reference lock (`const savingRef = React.useRef(false)`) inside `saveRepaymentInline` to guarantee immediate blocking of any rapid duplicate calls before React's state loop.

### Lesson 130: Remove Blur Auto-Save on Batch Expenses & Vehicles (`/batches/new`, `/batches/$batchId`)

- **Context & Bug**:
  - In `batches.new.tsx` and `BatchEditor.tsx`, clicking outside an expense or vehicle editing row fired `handleExpenseRowBlur` or `handleVehicleRowBlur`, attempting to save immediately.
  - If required fields (e.g. "Số tiền *", "Số khung *", "Đơn giá nhập *") were not yet typed, clicking away or opening dropdowns triggered premature validation toasts and red borders.
- **Fix**:
  - Removed `handleExpenseRowBlur` and `handleVehicleRowBlur` and their `onBlur` listeners from `<TableRow>` across `batches.new.tsx` and `BatchEditor.tsx`.
  - Rows now only save when hitting `Enter` on the keyboard (with popover/combobox open guards) or clicking the Checkmark button.
  - Added `e.stopPropagation()` on keyboard handlers and pruned redundant child input `onKeyDown` bindings.

### Lesson 131: Omit Redundant Bank Name in Receipt Vouchers Table (`/finance?tab=receipts`)

- **Context & Request**:
  - In `src/routes/finance.tsx` on the "Lịch Sử Phiếu Thu Tiền Bán Xe" table, the "Tài Khoản Nhận" column rendered `{r.bankName} ({r.accountNumber})` alongside the bank logo.
  - For banks with long legal corporate names (e.g., Vietcombank Neo Limited), this created significant horizontal overflow and clutter.
- **Fix**:
  - Replaced `{r.bankName} ({r.accountNumber})` with `{r.accountNumber}` inside `<BankLabel>`. The bank logo continues to provide instant visual recognition, and the full bank name is accessible via `title` attribute tooltip on hover.

### Lesson 132: Prefer Bank Short Name in Bank Reconciliation & Account Selects (`/reconcile`)

- **Context & Problem**:
  - On `/reconcile` (Bank Statement Reconciliation page), the "Sao kê" select dropdown and the card header "Giao Dịch Trong Kỳ Sao Kê" rendered the full legal name of the bank (e.g. `Ngân hàng Thương mại trách nhiệm hữu hạn một thành viên Ngoại thương Công nghệ số (Vietcombank Neo Limited)`).
  - This excessively long string caused text truncation in the trigger (`... #5 Khớp 0/1`) and crowded the card title.
- **Fix**:
  - Updated `listBankStatementsFn` and `getBankStatementDetailFn` in `src/server/fns/finance.ts` to select `bankShortName: banks.shortName` and `bankCode: banks.code` (and grouped by them).
  - In `src/routes/reconcile.tsx`, computed `bankLabel = s.bankShortName || s.bankCode || s.bankName`, using it in both the statement picker `<SearchSelectItem>` label and the `<CardTitle>` header.
  - Also updated `ImportStatementDialog.tsx` and `BankAccountSelect.tsx` to prefer `bankShortName || bankCode || bankName` for clean, consistent formatting without truncation.

### Lesson 133: Drop Supplier Address Column (`suppliers.address`)

- **Context & Request**:
  - The business does not require physical address tracking for wholesale import motorcycle suppliers.
  - The supplier address field in the popup dialog (`SupplierDetailDialog.tsx`) and the Master Data suppliers table was extraneous and displayed `Chưa có địa chỉ`.
- **Fix**:
  - Created migration `0038_drop_supplier_address.sql` (`ALTER TABLE suppliers DROP COLUMN address;`) and executed it via `npm run migration:run`.
  - Removed `address` from `suppliers` table in `src/db/schema.ts` and from validator in `saveSupplierFn` (`src/server/fns/master-data.ts`).
  - Removed address state, input field, and display from `SupplierDetailDialog.tsx` (view mode now cleanly shows logo and supplier name only).
  - Removed address column and search filter from `/master-data` (Suppliers tab) and pruned unused `Textarea` import.

### Lesson 134: Unified Account-Centric Bank Reconciliation Table (`/reconcile`)

- **Context & Architecture Decision**:
  - Previously, bank reconciliation required picking individual uploaded statement batches (`#1`, `#2`, `#3`, ... `#8`) one by one via a dropdown. Over months of operations, this file-based picker becomes excessively fragmented and unwieldy, making it difficult to monitor unreconciled cash flow across multiple corporate bank accounts.
  - Aligned the module with real-world enterprise accounting standards (QuickBooks, Xero, MISA AMIS): **all statement transactions live in a single consolidated master ledger**, filtered by bank account and reconciliation status.
- **Implementation**:
  - **Server Function** (`src/server/fns/finance.ts`):
    - Added `listReconciliationLinesFn` which queries active company bank accounts alongside aggregate transaction & unreconciled counts (`unreconciledCount`).
    - Fetches statement lines across all uploaded statements (or filtered by `accountId`), joining bank details and enriched matched entities (`matchedReceipt`, `matchedPayment`, `matchedLoanRepayment`).
  - **Client Query Hook** (`src/lib/queries.ts`):
    - Added `reconciliationLinesQuery(accountId?: number)` to fetch and cache unified reconciliation lines and account metadata.
  - **UI / UX Overhaul** (`src/routes/reconcile.tsx`):
    - Replaced the single-statement selector with horizontal Bank Account Switcher pills (`Tất cả tài khoản`, `Vietcombank`, `DBS`, etc.) featuring bank logos, short names, account number suffixes, and real-time unreconciled badges.
    - Synchronized account filtering with URL search params (`?account=...`) for shareable, bookmarkable deep links.
    - Added quick status filter tabs (`Tất cả`, `Chưa đối soát`, `Đã khớp`) directly inside the table header.
    - Added a dedicated "Tài Khoản" column in the table displaying bank logo, short name, and account number for each transaction.
    - Sized the action column to `w-60` (240px) and table to `min-w-[1080px]` to ensure dual action buttons (`Xem khớp` and `Gỡ khớp`) have generous breathing room without touching or overflowing the right table border.
### Lesson 135: Single-Vehicle Delivery vs. Batch Invoicing (`/sales/$orderId`)

- **Context & Business Workflow**:
  - In B2B wholesale motorcycle sales, clients or logistics trucks frequently pick up individual vehicles one at a time across multiple trips. However, internal commercial invoices / financial receipts are issued once in full for all uninvoiced vehicles in the order.
- **Implementation**:
  - **Table Action Column** (`src/routes/sales.$orderId.tsx`):
    - Added a `Thao tác` column (`w-28`) with an individual `[🚚 Giao xe]` button for each undelivered vehicle.
    - Omitted row-level invoice buttons; invoicing retains only the top-level batch action `[📋 Xuất hóa đơn nội bộ]`.
  - **Delivery Modal**:
    - Clicking `Giao xe` on a row opens the delivery modal scoped directly to that single vehicle, featuring a preview card with model name, chassis number, and color.
    - Top-level `Giao xe thực tế` button allows checking/unchecking vehicles to dispatch any combination.
### Lesson 136: In-Order Vehicle Filter Dialog (`/sales/$orderId`)

- **Context & Request**:
  - In sales orders containing multiple motorcycles, users requested search and filtering tools to quickly locate vehicles by chassis number, model, or color, and filter by dual-inventory state (delivered vs. undelivered physical stock, invoiced vs. uninvoiced commercial status).
- **Implementation**:
  - **Toolbar & CardHeader** (`src/routes/sales.$orderId.tsx`):
    - Added a quick search bar with a magnifying glass icon for immediate query matching.
    - Added a "Bộ lọc" button with an active filter badge counter.
  - **Filter Dialog (`Bộ Lọc Danh Sách Xe`)**:
    - Dialog includes text search, dual inventory status dropdowns (Kho thực tế & Kho hóa đơn), distinct motorcycle model select, and exterior color select.
### Lesson 137: Select Mode for Batch Vehicle Delivery from Inventory (`/sales/$orderId`)

- **Context & Request**:
  - In sales orders with multiple motorcycles, users needed a dedicated "Select Mode" to pick a specific subset of vehicles directly in the table to export/deliver them from warehouse inventory ("Giao xe / Xuất kho thực tế").
- **Implementation**:
  - **Select Mode Toggle** (`src/routes/sales.$orderId.tsx`):
    - Added a `[Chế độ chọn]` / `[Thoát chọn]` button in the card header toolbar (visible when undelivered vehicles exist).
  - **Interactive Checkboxes & Action Banner**:
    - Activating select mode inserts a checkbox column into the table with a master header checkbox for all pending vehicles.
    - Clicking anywhere on an undelivered vehicle row toggles selection with row-level emerald highlighting.
    - Displays an action banner above the table indicating the count of selected vehicles and a `[🚚 Xuất kho (X) xe đã chọn]` button.
    - Clicking the action button opens the delivery modal pre-scoped to the selected vehicle IDs.

### Lesson 138: Streamlining Sales Order Vehicle Table by Removing Redundant Invoiced Stock Column (`/sales/$orderId`)

- **Context & Request**:
  - In `/sales/$orderId`, commercial invoicing is strictly an order-level batch action issued via the top header button `[Xuất hóa đơn nội bộ]` (or receipt creation). Users noted that displaying a repetitive `Kho Hóa Đơn` badge column across each individual vehicle row was unnecessary visual clutter.
- **Implementation**:
  - **Table Layout** (`src/routes/sales.$orderId.tsx`):
    - Removed the `Kho Hóa Đơn` column from `TableHeader` and `TableBody`.
    - Adjusted empty state `colSpan` dynamically (`selectMode ? 6 : 5`).
    - Retained the top-level `[Xuất hóa đơn nội bộ]` action button in `PageHeader.actions` for issuing internal commercial invoices/receipts.
  - **Filter Dialog Simplification**:
    - Streamlined the Filter Dialog (`Bộ Lọc Danh Sách Xe`) by removing the unused `Kho Hóa Đơn` filter select, focusing on `Kho Thực Tế`, search query, model, and color.

### Lesson 139: Clean Invoice Status Badge Formatting on Sales Order List (`/sales`)

- **Context & Bug**:
  - In `/sales` (sales orders list), the `Kho Hóa Đơn` badge previously used the fallback template `` `Đã ra HĐ ${o.invoicedCount}/${o.vehicleCount}` `` when `o.invoicedCount !== o.vehicleCount`. When `invoicedCount` was 0 (no vehicles invoiced yet), it produced the confusing badge `Đã ra HĐ 0/1`.
- **Implementation**:
  - In `src/routes/sales.index.tsx`, updated the badge label logic:
    - `o.invoicedCount === o.vehicleCount ? 'Đã lập HĐ' : o.invoicedCount === 0 ? 'Chưa ra HĐ' : 'Ra HĐ một phần'`
    - Eliminates fractional counts (`0/1`) for uninvoiced orders and aligns with the filter option label `Chưa ra HĐ`.

### Lesson 140: Populating Vehicle Filter Options from Master Data & Batches (`/sales/new`)

- **Context & User Request**:
  - In `/sales/new`, the "Bộ Lọc Xe" modal previously extracted filter dropdown options (`Dòng xe`, `Màu xe`, `Lô nhập`) solely from currently available vehicles in inventory. When there were 0 available vehicles (or no unsold vehicles for specific models), the dropdowns showed `(0)` options and prevented users from browsing or filtering catalog items.
- **Implementation**:
  - Updated `src/server/fns/batches.ts`:
    - Adjusted `listBatchesFn` middleware to accept `'sales.create'` in addition to `'batches.view'`.
  - Updated `src/routes/sales.new.tsx`:
    - Included `masterDataQuery()` and `batchesQuery()` in the route loader and component.
### Lesson 141: Mandatory Color Swatch Circles Across UI & sales.$orderId

- **Context & User Request**:
  - The user explicitly requested to mandate in `AGENTS.md` that vehicle colors must ALWAYS be accompanied by the circular color swatch (`ColorLabel` or color dot).
  - In `/sales/$orderId`, the table row, delivery modal preview card, checklist items, and the Filter Dialog's "Màu xe" dropdown were displaying plain text color names without the round color swatch circle.
- **Implementation**:
  - Added Rule 6 to **Section 1: MANDATORY AGENT PROTOCOLS & INSTRUCTIONS** in `AGENTS.md`: "MANDATORY COLOR CIRCLE SWATCH DISPLAY".
  - Updated `src/server/fns/sales.ts`:
    - `getSalesOrderDetailFn` now selects `colorHex: colors.hex`.
  - Updated `src/routes/sales.$orderId.tsx`:
    - Imported `<ColorLabel />` from `#/components/ui/color-label.tsx`.
    - `distinctColors` now maps both `name` and `hex`.
    - Replaced raw text in table rows with `<ColorLabel name={i.colorName} hex={i.colorHex} />`.
    - Replaced raw text in delivery modal preview and checklist with `<ColorLabel />`.
    - Replaced dropdown items in Filter Dialog with `<ColorLabel name={c.name} hex={c.hex} />`.

### Lesson 142: Page-Scoped Select All / Deselect All in Table Header (`/sales/$orderId`)

- **Context & User Request**:
  - In `/sales/$orderId` select mode, clicking the master checkbox previously toggled selection across all vehicles in the order across all pages simultaneously. If a user had selections on page 1 and navigated to page 2 (where nothing had been selected), the header checkbox appeared checked or deselecting it cleared everything across all pages.
- **Implementation**:
  - In `src/routes/sales.$orderId.tsx`:
    - Scoped the table header checkbox strictly to `pageUndelivered = itemsPg.pageItems.filter(i => !i.isDelivered)`.
    - Computed `pageAllChecked` and `pageSomeChecked` based solely on the current page's visible items.
    - `toggleSelectPage()` toggles only the current page's vehicles:
      - Deselecting on the current page preserves selections made on other pages.
      - Selecting on the current page adds the current page items into `selectedForDelivery` without losing selections from other pages.
    - When navigating to another page where nothing is selected, the header checkbox accurately reflects an unchecked state (`false`).
    - Added dedicated banner action links: "Bỏ chọn tất cả" (to clear all pages) and "Chọn tất cả X xe trong phiếu" (to batch select across all pages when multi-page orders exist).

### Lesson 143: Hiding Already Exported Vehicles in Select Mode (`/sales/$orderId`)

- **Context & User Request**:
  - In `/sales/$orderId`, activating select mode is specifically intended for selecting vehicles to deliver / export from the warehouse (`Giao xe thực tế`). Displaying already exported / delivered vehicles (`isDelivered === true`) with disabled labels cluttered the table and confused users.
- **Implementation**:
  - In `src/routes/sales.$orderId.tsx`:
    - Updated `filteredItems` to exclude delivered vehicles when `selectMode === true` (`if (selectMode && i.isDelivered) return false`).
    - Added `selectMode` to `usePagination` reset key, returning to page 1 upon toggling mode.
    - Updated card title in select mode: `Chọn xe chưa xuất kho (${filteredItems.length})`.
    - Every row rendered in select mode is an undelivered vehicle that can be directly selected via checkbox or row click.

### Lesson 144: Hiding Single-Export Button in Select Mode (`/sales/$orderId`)

- **Context & User Request**:
  - In `/sales/$orderId`, when select mode is active to multi-select vehicles for batch dispatch, displaying the individual `[Giao xe]` button in the "Thao tác" column created visual noise and conflicting actions.
- **Implementation**:
  - In `src/routes/sales.$orderId.tsx`:
    - Wrapped `<TableHead>Thao tác</TableHead>` and the action `<TableCell>` with `{!selectMode && ...}`.
    - When select mode is active, the action column is hidden and replaced cleanly by the leading checkbox selection column.
    - Set empty state table `colSpan` to 5 consistently across both modes.

### Lesson 145: Simplifying Delivery Modal by Removing Redundant In-Modal Vehicle Checklist (`/sales/$orderId`)

- **Context & User Request**:
  - In `/sales/$orderId`, vehicles to be delivered are already selected either from the table (via single-vehicle `[Giao xe]` or multi-vehicle `[Chế độ chọn]`) or via the top-level dispatch action. The delivery modal previously rendered an additional inner scrollable checklist of vehicles, adding unnecessary clicks and visual clutter.
- **Implementation**:
  - In `src/routes/sales.$orderId.tsx`:
    - Removed the inner scrollable checklist of individual vehicles from `deliveryDialogOpen`.
    - Modal now directly focuses on delivery details (`Ngày Giao Hàng`, `Tên Người/Tài Xế Nhận Xe`, `Thông Tin Phương Tiện`) and displays the count of vehicles being dispatched (`Số lượng xe xuất kho thực tế: X chiếc`).
    - Aligns the physical delivery modal design with the commercial invoice modal.

### Lesson 146: View/Edit Delivery Details and Un-exporting (Revert Delivery) in Sales Order (`/sales/$orderId`)

- **Context & User Request**:
  - For vehicles that have already been dispatched (`isDelivered === true`), replace the empty placeholder dash (`—`) in the "Thao tác" column with an Eye icon button (`[👁️ Xem]`).
  - Clicking this Eye button allows users to view the delivery note, edit delivery details (date, receiver/driver name, truck/transport details, and notes), and un-export the vehicle (reverting it back to physical inventory stock).
- **Architecture & Implementation**:
  - **Backend Services & Functions (`src/server/services/sales.ts` & `src/server/fns/sales.ts`)**:
    - Enhanced `getSalesOrderDetailFn` to left join `deliveryNoteItems` and `deliveryNotes`, returning `deliveryNoteId`, `deliveryNoteNumber`, `deliveryDate`, `receiverName`, `transportInfo`, and `deliveryNoteContent` directly on each vehicle item.
    - Added `updateDeliveryNote`: updates delivery metadata on `delivery_notes` and synchronizes `vehicles.deliveredAt` across associated vehicles.
    - Added `revertDeliveryNote`: handles single-vehicle and batch delivery un-exporting. Sets `isDelivered = false, deliveredAt = null`, deletes corresponding `delivery_note_items` entry, and deletes the `delivery_notes` row if no items remain. Includes fallback support for legacy unlinked records.
    - Exposed `updateDeliveryNoteFn` and `revertDeliveryNoteFn` guarded by `sales.deliver` permission.
  - **Frontend UI (`src/routes/sales.$orderId.tsx`)**:
    - In `Thao tác` column: rendered `[👁️ Xem]` button with blue outline when `canDeliver && i.isDelivered`.
    - Added `viewDeliveryDialogOpen`: displays vehicle summary card with `<ColorLabel name={item.colorName} hex={item.colorHex} />` (Rule 6 compliant), associated delivery note number, and other vehicles sharing the same dispatch note (if batch).
    - Form inputs allow editing `Ngày Giao Hàng`, `Tên Người/Tài Xế Nhận Xe`, `Thông Tin Phương Tiện / Biển Số Xe Tải`, and `Ghi Chú`.
    - Integrated "Hủy xuất kho" / "Hủy xuất xe này" with `confirmDialog` prompting confirmation before reverting the vehicle back to warehouse inventory. If multiple vehicles share the dispatch note, users can choose to revert only this vehicle or the entire delivery note.

### Lesson 147: Simplifying Direct Receiving Branch Display to "Trực tiếp"

- **Context & User Request**:
  - In sales order listings, detail views, and finance modules, orders or receivables without a sub-branch were displayed as "Công ty mẹ (Trực tiếp)". The user requested simplifying this label to just "Trực tiếp".
- **Implementation**:
  - Updated `src/routes/sales.index.tsx`:
    - Changed filter option `[DIRECT_BRANCH, 'Trực tiếp']`.
    - Changed table cell fallback `o.branchName ?? 'Trực tiếp'`.
  - Updated `src/routes/sales.$orderId.tsx`:
    - Changed description fallback `order.branchName ?? 'Trực tiếp'`.
  - Updated `src/routes/finance.tsx`:
    - Changed filter option, receivables table cell, and receipt branch select item to "Trực tiếp".

### Lesson 148: Bank Account Multi-Select Dropdown in Reconciliation (`/reconcile`)

- **Context & User Request**:
  - In `/reconcile`, the bank account filter previously used single-select button switcher tabs on the page and a single `SearchSelect` dropdown in the filter dialog. The user requested changing the bank account filter into a multi-select dropdown.
- **Architecture & Implementation**:
  - In `src/routes/reconcile.tsx`:
    - Updated `validateSearch` schema:
      `account: z.union([z.number().int(), z.array(z.number().int())]).transform(v => Array.isArray(v) ? v : v !== undefined ? [v] : undefined).optional().catch(undefined)`.
      This cleanly supports multi-select arrays in URL query parameters while remaining backwards compatible with single `account=2` query links.
    - Updated state to `selectedAccountIds: number[]` with `setSelectedAccountIds: (accIds: number[]) => void`.
    - Filtered statement lines across multiple bank accounts via `selectedAccountIds.includes(l.companyBankAccountId)`.
    - In the top "TÀI KHOẢN NGÂN HÀNG" section: replaced the row of button pills with `<MultiSearchSelect>`, including searchable bank logos, account numbers, and unmatched transaction badges, plus a quick "Bỏ chọn" link when accounts are filtered.
    - In the `[Bộ lọc]` dialog: replaced `SearchSelect` with `<MultiSearchSelect>`.
    - Updated transaction table header to display selected account names or count when multiple accounts are chosen.

### Lesson 149: Streamlining View/Edit Delivery Modal by Removing Note Field (`/sales/$orderId`)

- **Context & User Request**:
  - In `/sales/$orderId`, inside the "Chi Tiết Phiếu Giao Xe Thực Tế" modal, the "Ghi Chú" field was deemed unnecessary by the user. The initial delivery creation dialog only collected delivery date, receiver/driver, and transport vehicle info.
- **Implementation**:
  - In `src/routes/sales.$orderId.tsx`:
    - Removed the "Ghi Chú" label and input from `viewDeliveryDialogOpen`.
    - Pruned unused `editDeliveryNote` state and handler assignments.
    - Modal now compactly presents: `Ngày Giao Hàng *`, `Tên Người/Tài Xế Nhận Xe`, and `Thông Tin Phương Tiện / Biển Số Xe Tải`, aligning directly with the initial creation modal.

### Lesson 150: Dashboard Table Alignment with Inventory & Sales Components (`/`)

- **Context & User Request**:
  - In `/` (Dashboard / Tổng quan), the bottom two overview tables previously had non-standard combined badge columns:
    1. Left table ("Xe Mới Nhập & Trạng Thái 2 Kho"): Used a single combined `KHO KÉP` badge (`<DualInventoryBadge>`).
    2. Right table ("Đơn Bán Gần Đây"): Used a single combined `TIẾN ĐỘ` column with stacked miniature badges ("Giao X/Y", "HĐ A/B").
  - The user requested using the same exact separate components and visual column structure from the respective full pages (`/inventory` and `/sales`).
- **Implementation**:
  - Created reusable badge components in `src/components/sales/SalesWarehouseBadges.tsx`:
    - `SalesDeliveryBadge`: Handles delivery progress (`Đã giao đủ` in emerald vs `Đã giao X/Y` in amber).
    - `SalesInvoiceBadge`: Handles internal invoicing progress (`Đã lập HĐ` in blue vs `Chưa ra HĐ` / `Ra HĐ một phần`).
  - Refactored `src/routes/sales.index.tsx` to use `SalesDeliveryBadge` and `SalesInvoiceBadge`.
  - Updated `src/routes/index.tsx`:
    - **Left Table ("Xe Mới Nhập & Trạng Thái 2 Kho")**:
      - Replaced `Kho Kép` with two distinct columns: `Trạng Thái` (`<DeliveryStatusBadge />`) and `Trạng Thái HĐ` (`<InvoiceStatusBadge />`) from `#/components/inventory/DualInventoryBadge.tsx`, matching `/inventory`.
      - Added mandatory color circle swatch preview (`style={{ backgroundColor: v.colorHex }}`) alongside `v.colorName` adhering to Rule 6.
    - **Right Table ("Đơn Bán Gần Đây")**:
      - Replaced `Tiến Độ` with two distinct columns: `Kho Thực Tế` (`<SalesDeliveryBadge />`) and `Kho Hóa Đơn` (`<SalesInvoiceBadge />`), matching `/sales`.
      - Updated direct branch fallback label to `"Trực tiếp"`.

### Lesson 151: Correcting "Ngày Bán" Column Header on Dashboard Recent Orders (`/`)

- **Context & Symptom**:
  - In `src/routes/index.tsx`, the recent wholesale orders table ("Đơn Bán Gần Đây") previously titled its first column "Mã Phiếu", but displayed sale dates (`formatDate(o.orderDate)` e.g. `20/10/2026`).
  - The user flagged "this is not Mã Phiếu" because `20/10/2026` represents the sale date (`Ngày Bán`), directly corresponding to the `Ngày Bán` column on the main `/sales` page.
- **Implementation**:
  - Updated `src/routes/index.tsx`:
    - Changed `<TableHead>Mã Phiếu</TableHead>` to `<TableHead>Ngày Bán</TableHead>`.
    - Enhanced the date link target from generic `/sales` to the specific sales order detail page `/sales/$orderId` (`params={{ orderId: String(o.id) }}`).

### Lesson 152: Table Typography Consistency — Standard Sans (`Inter`) vs. `font-mono`

- **Context & Symptom**:
  - In `src/routes/reconcile.tsx`, dates (`formatDate`), currency amounts (`formatVnd`), and bank account numbers were explicitly tagged with `font-mono` and custom small font sizes (`text-[11px]`).
  - On client systems (especially Windows), `font-mono` fell back to jagged, pixelated monospaced fonts that visually clashed with all other table screens (`/sales`, `/finance`, `/loans`, `/inventory`).
- **Standard**:
  - The design system in `src/styles.css` already enforces `table, .tabular { font-variant-numeric: tabular-nums; }` across all data tables.
  - Numbers, dates, and amounts in tables must use the standard sans-serif typeface (`Inter`) via `className="text-slate-500"` (for dates) and `className="text-right font-medium text-slate-900"` (or `text-emerald-900` / `text-rose-900` for money flows), preserving crisp tabular alignment without unnatural monospaced glyphs.
- **Fix**:
  - Removed `font-mono text-[11px]` from `src/routes/reconcile.tsx` table cells (`formatDate`, `formatVnd`, account labels) to harmonize 100% with `/finance`, `/sales`, and `/inventory`.

### Lesson 153: Client Update Round — Loan Account Number, Batch Loan Link, Per-Vehicle Invoices, VAT Labels, Import Total, Five Banks

- **Loan account**: `loan_contracts.company_bank_account_id` (nullable FK to `company_bank_accounts`, migration `0041`; `0039` had first added a free-text `account_number`, which `0041` drops — the client wanted a select of the COMPANY's own accounts, the same `BankAccountSelect` used when repaying). `loan_contracts.bank_id` is gone (migration `0042`, backfilled from an account of the same bank): the bank is now only derived through the account (`listLoansFn` left-joins `company_bank_accounts` → `banks`, so `bankName`/`bankImage`/`bankId` can be `null`). The account is required in the form and the bank dropdown was removed. Shown in the create/edit loan dialog, the `/loans` list ("Số Tài Khoản") and the `/loans/$loanId` header.
- **Batch ↔ loan link is back (nullable)**: `import_batches.loan_contract_id` (FK `ON DELETE SET NULL`, index `import_batches_loan_idx`) was dropped in `0035` and is re-added in `0039` because a batch may be paid without a loan. `LoanSelect` (`src/components/batches/LoanSelect.tsx`, `0` = "Không vay") is used in `/batches/new` and in the batch info editor (`BatchEditor`); `createBatchFn` / `updateBatchInfoFn` take `loanContractId`, `getBatchDetailFn` returns `loanContractId` + `loanContractNumber` (shown as a link in the `/batches/$batchId` header).
- **`/inventory`**: a leading `ID` column (`vehicles.id`).
- **VAT wording**: the prices typed in `/sales/new` are already VAT-inclusive, so labels read "Đơn Giá Bán Đã VAT" (`/sales/new`, `/sales/$orderId`) and "Tổng Tiền Đã VAT" (`/sales` list + filter, dashboard recent orders). Labels only; no VAT is calculated.
- **One invoice per vehicle**: `recordInvoice` (`src/server/services/sales.ts`) now inserts one `invoices` row + one `invoice_items` row per vehicle, also when several vehicles are invoiced at once (`recordInvoiceFn` returns `{ ids }`). A custom invoice number is only accepted for a single vehicle (server rejects it for several; the dialog disables the box). `/sales/$orderId` has a per-row `Xuất HĐ` button next to `Giao xe` and an `Đã xuất HĐ` badge; the top-level `Xuất hóa đơn nội bộ` button invoices every uninvoiced vehicle as separate invoices. This supersedes the "invoicing retains only the top-level batch action" part of Lesson 135.
- **Dashboard**: new `Tổng giá nhập` stat card = `sum(vehicles.import_price)` (`getInventorySummary().importValue`).
- **Seed** (`bank.seed.ts`): `SEED_BANKS` is a hardcoded list of the five banks (name, VietQR code, short name, logo), so `npm run seed` no longer needs internet and no longer calls the VietQR API (this supersedes Lesson 21's live fetch). It inserts only banks whose code is missing and fills an existing bank's empty logo / short name. The rest of the seed is unchanged: company profile, default roles and the `admin` account (a fresh install cannot log in without them); expense types come from migration `0025`.
- **Five banks only**: ACB, Bản Việt (`VCCB`), Vietcombank (`VCB`), HDBank (`HDB`), Eximbank (`EIB`). `seedBanks()` filters the VietQR catalogue by `ALLOWED_BANK_CODES`; migration `0040_keep_five_banks` deletes every other bank that no loan contract or company bank account uses (its down is a no-op: re-run `npm run seed` to bring banks back). Gotcha: `BVB` is Bảo Việt, not Bản Việt. `0040` matched names with `LIKE`, and the accent-insensitive collation let "Ban Viet" (Timo) and "Ngoại thương Công nghệ số" (VCB Neo) through, so `0043_prune_banks_by_code` deletes by exact code instead. A bank that still has a company bank account is never deleted: move the account to one of the five banks (`/master-data?tab=accounts`), then delete the bank.
- **Deploy**: run `npm run migration:run` (applies `0039`–`0045`).

### Lesson 154: Select Mode Covers Export and Invoice (`/sales/$orderId`)

- Select mode now lists vehicles that are not yet exported **or** not yet invoiced (hidden only when both are done) and every listed row is selectable; a `Kho Hóa Đơn` badge column appears in select mode. The bar has two bulk actions: `Xuất kho (n)` (selected vehicles not yet delivered) and `Xuất hóa đơn (n)` (selected vehicles not yet invoiced; one invoice per vehicle, see Lesson 153). Supersedes the "hide already exported vehicles" part of Lesson 143. `Kho Hóa Đơn` is a permanent column. Clicking the `Kho Hóa Đơn` badge of a row issues (opens the invoice dialog) or cancels (confirm dialog) that vehicle's invoice; cancel is (`revertInvoiceFn` → `revertInvoice`): removes that vehicle's invoice line (deletes the invoice if empty, otherwise lowers its total), sets `is_invoiced = false`, leaves physical stock alone. Every row has `Xem` (column `Thao tác`) opening a vehicle detail dialog: export details (delivery note no., date, receiver, vehicle) with `Xuất kho` / `Hủy xuất kho` and inline-editable date / receiver / vehicle (`Lưu thay đổi`) — the old separate "Chi Tiết Phiếu Giao Xe Thực Tế" dialog was removed as redundant; clicking an `Đã giao` badge now asks to un-export directly (the action dialogs opened from the detail dialog stack on top of it), and invoice details with `Xuất hóa đơn` / `Hủy hóa đơn` and inline-editable invoice number / date (`updateInvoiceFn`; the date also updates `vehicles.invoiced_at`; duplicate numbers are refused). Both `Lưu thay đổi` buttons only show while their fields are dirty. The order detail items now carry `invoiceId` / `invoiceNumber` / `invoiceDate`.

### Lesson 155: Daily Interest Table on `/loans/$loanId`

- The interest table lists **one row per day** (newest first, paginated) instead of one row per repayment segment: `Ngày`, `Gốc Đã Trả`, `Dư Nợ Trong Ngày`, `Lãi Trong Ngày`, `Lãi Lũy Kế`. Rows are derived on every load by `expandInterestByDay(segments)` (`src/lib/business.ts`), nothing is stored. Each segment's interest is spread over its days with running rounding, so the daily rows add up exactly to `totalInterest` / `accruedInterest` (the figures used by the repayment forms are unchanged). The day of `asOf` itself is not counted (interest runs from disbursement up to, not including, that date, as before).

### Lesson 156: Hard-Delete Script (`npm run db:clear`)

- `src/db/clear-data.ts` TRUNCATEs (hard delete, ids restart) every business table and keeps only accounts (`users`, `sessions`, `password_reset_tokens`), permissions (`roles`, `role_permissions`), settings (`company_info`) and the bank list (`banks`). It also deletes `uploads/suppliers/`. This includes `expense_types` (so the six default expense types from migration `0025` are gone until re-added in `/master-data`), customers, suppliers, models, colours, company bank accounts, loans, batches, sales, vouchers and statements.
- **Deletes immediately**: `npm run db:clear` prints the target DB and row counts, then deletes; `npm run db:clear -- --dry-run` only prints. It refuses to run when `DB_HOST/DB_USER/DB_PASSWORD/DB_NAME` are not set, because `src/db/index.ts` falls back to a hard-coded server.
- **Gotcha (empty database)**: never default a foreign-key select to a made-up id (`customers[0]?.id ?? 1`): after `db:clear` that id does not exist and the insert fails with a raw FK error. `/sales/new` now starts with no customer (`null`), asks to choose one, and `createSalesOrder` checks the customer exists. The same `?? 1` pattern is still in `finance.tsx` (receipt customer, payment supplier).
- Unlike `npm run seed -- --reset` it does not delete users, roles, company info or banks.

### Lesson 157: Sales Price = Price Before VAT + VAT % → Price With VAT

- `sales_order_items` has `price_before_vat` and `vat_rate` (%) next to `unit_price` (migration `0044`; old rows: `price_before_vat = unit_price`, VAT 0). **`unit_price` stays the VAT-inclusive price** (= `priceWithVat(before, rate)` in `src/lib/business.ts`), so order totals, invoices and receivables are unchanged. The server (`createSalesOrder`) always derives it; the client sends only `priceBeforeVat` + `vatRate` (`createSalesOrderFn`).
- `/sales/new`: per vehicle `Đơn Giá Chưa VAT` (input, defaults to the batch selling price), `% VAT` (input, default `DEFAULT_VAT_RATE` = 10, max 100) and `Đơn Giá Đã VAT` (read-only, calculated). The below-cost warning compares the price BEFORE VAT with the cost price (cost has no VAT). `/sales/$orderId` shows the three columns.
- **Reports** (`reports.ts`) use `price_before_vat` as revenue, so VAT is not counted as income or profit.

### Lesson 158: Cancelling a Sales Order Deletes It

- `cancelSalesOrder` now **deletes** the `sales_orders` row (and its lines) instead of keeping a `cancelled` shell with 0 vehicles / 0 ₫ in the `/sales` list. Still refused while any vehicle was delivered or invoiced (cancel those first: `Hủy HĐ`, `Hủy xuất kho`). Receipt vouchers pointing at the order keep existing, only losing the link (`ON DELETE SET NULL`). Migration `0045_delete_cancelled_orders` removed the shells already in the database (its down is a no-op). The `cancelled` enum value remains in the schema but is no longer written.

### Lesson 159: Removal of Color Swatches & Color Picker per Client Directive

- **Client Directive**: The client explicitly requested:
  - Users do not need to pick a hex color / palette anymore; they only enter the color name (text input).
  - Remove all color swatch previews / circles / hex pickers across all UI components, displaying ONLY the color name text everywhere.
- **Affected Components & Views**:
  - `src/components/ui/color-label.tsx`: Swatch dot removed, renders plain text name.
  - `src/routes/master-data.tsx`: Removed hex color circle from table and `<ColorPicker>` / hex validation from Add/Edit Color modal. Only "Tên Màu *" is entered.
  - `src/components/batches/ColorSelect.tsx`: Removed `<ColorPicker>` and hex input from quick-add modal, renders `{c.name}` in dropdown options.
  - `src/components/batches/VehicleFormDialog.tsx`: Removed `<ColorPicker>` and hex input from quick-add modal, renders `{c.name}` in dropdown options.
  - `src/routes/inventory.tsx`: Removed color swatch dot from table and multi-select filter options.
  - `src/routes/index.tsx`: Removed color swatch dot from recent vehicles table.
  - `src/routes/sales.new.tsx` & `src/routes/sales.$orderId.tsx`: Removed `<ColorLabel>` swatches in favor of clean text `{colorName}` / `{c.name}`.
  - Rule 6 of `AGENTS.md` updated to forbid color swatches.

### Lesson 160: Loan Contract Uses Bank Selection (Replaced Account Number per Client Directive)

- **Client Directive**: In the "Tạo Khế Ước Vay Ngân Hàng Mới" modal, replace "Số Tài Khoản" with "Ngân Hàng" selected from the bank list (`master.banks`).
- **Database & Migration (`0046_loan_bank_id.sql`)**:
  - `loan_contracts.bank_id` (NOT NULL FK referencing `banks.id`) replaces `company_bank_account_id`.
  - Backfilled from existing account link or lowest bank id.
  - Dropped `company_bank_account_id` and foreign key constraint `loan_contracts_bank_account_fk`.
- **UI & Routes**:
  - `/loans` (`loans.index.tsx`): Form modal now displays "Ngân Hàng *" using `SearchSelect` with `BankLabel` over `master.banks`. The table column header is updated to "Ngân Hàng" and renders `<BankLabel image={l.bankImage} name={l.bankName}>{l.bankName}</BankLabel>`.
  - `/loans/$loanId`: PageHeader description displays `Ngân hàng: {loan.bankName}`.
  - Services & Server functions: `listLoansFn`, `getLoanStatus`, `reports.ts`, and `usage.ts` updated to join and reference `banks` directly on `loan_contracts.bank_id`.

### Lesson 161: Vehicle Import from Excel, Template Download & Vehicle Manufacture Year (Đời Xe)

- **Client Directive**:
  1. Add 2 action buttons to vehicle batch intake:
     - "Tải file mẫu": Downloads official Excel template (`mau-nhap-xe.xlsx`) with columns `STT`, `TÊN HÀNG`, `SK`, `SM`, `MÀU SƠN`, `NĂM`, `GIÁ NHẬP` pre-populated with sample rows.
     - "Import Excel": Uploads and parses vehicle list from `.xlsx` / `.xls` files.
  2. Auto-create Models and Colors:
     - Compare model names and color names case-insensitively with Vietnamese diacritics preserved (`name.trim().toLowerCase()`).
     - If not already in master data, automatically auto-create using `saveModelFn` / `saveColorFn` without interrupting import.
  3. UI Row Layout:
     - Arrange "DÒNG XE" (`ModelSelect`) and "MÀU" (`ColorSelect`) horizontally side-by-side on the same row instead of stacked vertically in `flex-col`.
     - Add input field for vehicle manufacture year / model year ("NĂM" / "Đời xe") on the vehicle itself (not on the model entity).
- **Database & Migration (`0047_vehicle_year.sql`)**:
  - Added `year int` column to `vehicles` table.
- **Components & Files Modified**:
  - `src/lib/excel-import.ts`: Dedicated utility for generating `mau-nhap-xe.xlsx` workbook download and parsing uploaded spreadsheets with auto-creation of missing models/colors.
  - `src/db/schema.ts` & `src/server/services/batches.ts` & `src/server/fns/batches.ts`: Supported `year` across schema, input validation schemas, and queries.
  - `src/routes/batches.new.tsx` & `src/components/batches/BatchEditor.tsx`:
    - Added "Tải file mẫu" and "Import Excel" buttons above the vehicle table.
    - Updated inline row edit (`isEditing` and `editingVehicleId === 'new'`) to place Model, Year, and Color side-by-side.
    - Rendered year badge in read-only rows.
  - `src/components/batches/VehicleFormDialog.tsx`: Placed Model and Color side-by-side, added "Năm / Đời xe" numeric input.
  - `src/routes/inventory.tsx`: Displayed vehicle year badge next to model name in inventory table.

### Lesson 162: Compact Inline Vehicle Input Sizing & Tailwind Merge for UI Primitives

- **Problem / Symptom**:
  - The inline vehicle row in `/batches/new` and `BatchEditor.tsx` was cramped horizontally on standard desktop resolutions (1366px/1440px), causing horizontal scrolling, clipped engine numbers, and truncated import price digits.
  - Sizing classes like `h-8` and `px-2` were failing to override primitive styles like `h-11` and `px-4` because `src/components/ui/input.tsx` and `src/components/ui/table.tsx` were importing `cn` from the `'cn'` npm package (which only concatenates class names without resolving conflicting Tailwind utilities) instead of `#/lib/utils.ts` (which runs `clsx` through `tailwind-merge`).
- **Fix & Visual Design**:
  - **`src/components/ui/input.tsx` & `src/components/ui/table.tsx`**: Updated import to `import { cn } from '#/lib/utils.ts'` so Tailwind class overrides are properly merged and take effect.
  - **Column Width Optimization**:
    - `Số Khung`: Reduced from `w-[170px]` to `w-[145px]`.
    - `Số Máy`: Reduced from `w-[170px]` to `w-[130px]`.
    - `Dòng xe / Năm / Màu`: Adjusted from `min-w-[280px]` to `min-w-[240px]`.
    - `Đơn Giá Nhập`: Reduced from `w-[150px]` to `w-[125px]`.
    - `CP Phân Bổ`: Reduced from `w-[120px]` to `w-[100px]`.
    - `Giá Vốn Xe`: Reduced from `w-[130px]` to `w-[110px]`.
    - `Giá Bán Áp Dụng`: Reduced from `w-[140px]` to `w-[115px]`.
    - Actions: Reduced from `w-[90px]` to `w-[70px]`.
    - Total table footprint reduced to ~1,035px, preventing horizontal scrolling on standard screens.
  - **Compact Input Dimensions & Unified Font Sizing**:
    - Replaced `p-2` with `px-1.5 py-1 align-middle` on edit row cells.
    - Set all inputs and dropdowns (Chassis Number, Engine Number, Model dropdown, Year, Color dropdown, Import Price) to consistent `h-7.5 text-xs px-2 rounded`.
    - Removed `md:text-sm` from base `Input` (`input.tsx`) so `text-xs` overrides are never overridden by desktop `@media (min-width: 768px)` queries.
    - Year input compact at `w-14 text-center px-1` using `type="text"` with `inputMode="numeric"`, `maxLength={4}`, and non-digit filtering so browser stepper arrows are completely eliminated across all platforms.
    - Smaller action buttons (`size-6.5` with `size-3.5` icons).
    - **Unified Typography Across All Inputs**: Removed `font-mono` from Chassis Number and Engine Number inputs and table cells so that all form fields share the identical clean sans-serif UI font (`font-sans`), consistent `text-xs` (12px), and uniform line spacing.
  - Applied consistently across `src/routes/batches.new.tsx`, `src/components/batches/BatchEditor.tsx`, and `src/components/batches/VehicleFormDialog.tsx`.

### Lesson 163: Free-Text Account Number Input on Loan Contracts

- **Client Directive**:
  - In the "Tạo Khế Ước Vay Ngân Hàng Mới" modal, add an input field for Account Number ("Số tài khoản") as a plain string input located directly below the "Ngân Hàng *" dropdown.
- **Database & Migration (`0048_loan_account_number.sql`)**:
  - Added `account_number varchar(50)` (nullable) to `loan_contracts` table.
- **Server Services & Functions**:
  - `src/db/schema.ts`: Added `accountNumber: varchar('account_number', { length: 50 })` on `loanContracts`.
  - `src/server/fns/finance.ts`: Added `accountNumber: z.string().trim().nullable().optional()` to `saveLoanContractFn` validator & insert/update payload; included `accountNumber` in `listLoansFn`.
  - `src/server/services/finance.ts`: Included `accountNumber` in `getLoanStatus` query.
- **UI & Routes**:
  - `src/routes/loans.index.tsx`:
    - Added `accountNumber` state, bound to a dedicated text input labeled "Số Tài Khoản" right beneath the "Ngân Hàng *" select in the Create/Edit Loan modal dialog.
    - Updated `openNewLoan` (resets to empty string) and `openEditLoan` (populates `l.accountNumber`).
    - Enhanced table row in `/loans` to display `STK: {l.accountNumber}` below the bank name when available.
    - Included `accountNumber` in search filtering (`q`).
  - `src/routes/loans.$loanId.tsx`: Rendered account number in PageHeader description next to the bank name when present.
  - `src/components/batches/LoanSelect.tsx`: Rendered account number in bank loan dropdown items and search keywords.

### Lesson 164: Filter Loans by Account Number (STK ILIKE)

- **Client Directive**:
  - In the "Bộ Lọc Khế Ước" dialog (`/loans`), add a dedicated filter input for Account Number ("Số tài khoản") with case-insensitive pattern matching (ILIKE substring match) on `accountNumber`.
- **UI & Routes (`src/routes/loans.index.tsx`)**:
  - `validateSearch`: Added `stk: z.string().optional().catch(undefined)`.
  - Added `accountSearch` state synchronized via `useUrlText(searchParams.stk ?? '', ...)`.
  - Filter logic checks `l.accountNumber.toLowerCase().includes(stk)` when `stk` is provided.
  - Added input labeled "Số tài khoản" with placeholder "Tìm theo số tài khoản..." in the "Bộ Lọc Khế Ước" modal.
  - Updated filter count, pagination cache key, and reset button ("Xóa lọc") to reset `accountSearch`.

### Lesson 165: Vehicle Import VAT (% VAT & VAT-Inclusive Price) & Proportional Expense Allocation

- **Client Directive**:
  - In batch intake and batch editing ("Nhập lô => Danh sách xe"), add 2 columns directly after "Đơn Giá Nhập":
    1. Input "% VAT" (`vatRate`, defaults to 10%).
    2. Auto-calculated "Đơn Giá Đã VAT" (`importPriceWithVat = priceWithVat(importPrice, vatRate)`).
  - All downstream calculations — Allocated Expenses (CP phân bổ), Cost Price (Giá vốn xe), and Batch Selling Price (Giá bán áp dụng) — are now computed based on the VAT-inclusive price (`importPriceWithVat`).
- **Database & Migration (`0049_vehicle_vat.sql`)**:
  - Added `vat_rate decimal(5,2) DEFAULT 0 NOT NULL` and `import_price_with_vat bigint DEFAULT 0 NOT NULL` to `vehicles`.
  - Backfilled existing rows with `import_price_with_vat = import_price` to preserve existing financial records.
  - Set default `vat_rate` to 10% for new records.
- **Core Business Logic (`src/lib/business.ts`)**:
  - `allocateBatchExpenses`: Allocates batch expenses proportionally based on `importPriceWithVat` of each vehicle:
    $$\text{Allocated Expense}_i = \text{Total Batch Expenses} \times \frac{\text{importPriceWithVat}_i}{\sum \text{importPriceWithVat}}$$
    $$\text{Cost Price}_i = \text{importPriceWithVat}_i + \text{Allocated Expense}_i$$
  - `computeSellingPrice`: Uses `v.importPriceWithVat` as the base when `pricingBase === 'import_price'`.
- **Services & Server Functions**:
  - `src/server/services/batches.ts`: Updated `recalculateBatch` and `normalizeVehicle` to compute `importPriceWithVat` and allocate based on it.
  - `src/server/fns/batches.ts`: Updated `createBatchFn`, `addVehiclesToBatchFn`, `updateVehicleFn` schemas to accept `vatRate`, and `getBatchDetailFn` to return `vatRate` and `importPriceWithVat`.
  - `src/server/services/reports.ts`: Selected `vatRate` and `importPriceWithVat` in `listVehicles`.
- **UI Components & Routes**:
  - `src/routes/batches.new.tsx` & `src/components/batches/BatchEditor.tsx`:
    - Added columns `% VAT` and `Đơn Giá Đã VAT` immediately after `Đơn Giá Nhập`.
    - Inline edit rows include a `% VAT` input (`w-14 text-center`) and real-time auto-calculated VAT-inclusive price display.
    - Read-only rows render `{v.vatRate}%` badge and formatted VAT-inclusive price.
  - `src/components/batches/VehicleFormDialog.tsx`: Added `% VAT` input and read-only `Đơn Giá Đã VAT` auto-calculated preview.
  - `src/lib/excel-import.ts`: Updated sample template download and parser to include the optional `% VAT` column (defaults to 10%).

### Lesson 166: Editable Selling Price Before VAT & % VAT in Sales Order (`/sales/$orderId`)

- **Client Directive**:
  - In Sales Order detail (`/sales/$orderId`), allow editing:
    1. Đơn Giá Chưa VAT (`priceBeforeVat`)
    2. % VAT (`vatRate`)
  - Auto-recalculate Đơn Giá Bán Đã VAT (`unitPrice = priceWithVat(priceBeforeVat, vatRate)`).
- **Backend Services & Functions (`src/server/services/sales.ts` & `src/server/fns/sales.ts`)**:
  - Added `updateSalesOrderPricing`: updates `priceBeforeVat`, `vatRate`, and `unitPrice` on `sales_order_items`.
  - Automatically recalculates `sales_orders.totalAmount` (`sum(unitPrice)` of all items in the order).
  - Synchronizes any already-issued commercial invoices (`invoice_items.amount` and `invoices.totalAmount`) ensuring accounting and debt totals stay strictly in sync.
  - Exposed `updateSalesOrderPricingFn` guarded by `sales.create` permission.
- **Frontend UI (`src/routes/sales.$orderId.tsx`)**:
  - **Single Vehicle Pricing Edit**:
    - Added "Sửa giá" button with pencil icon (`<Pencil />`) in the "Thao tác" column next to the "Xem" button.
    - Also enabled clicking directly on the "Đơn Giá Chưa VAT" or "% VAT" cells to open the edit modal.
    - Edit dialog features:
      - Vehicle details summary card (Chassis number, Model, Color, and Cost price `costPrice`).
      - `MoneyInput` for "Đơn Giá Chưa VAT (VNĐ)".
      - `DecimalInput` for "% VAT".
      - Real-time preview box displaying the auto-calculated "Đơn Giá Bán Đã VAT".
      - Prominent below-cost alert if `priceBeforeVat < costPrice`.
  - **Batch Pricing Edit**:
    - In `selectMode`, added "Sửa giá (X) xe đã chọn" button allowing bulk update of `% VAT` and/or `priceBeforeVat` across multiple vehicles in the sales order.
  - React Query invalidation refreshes sales order detail, order listings, receivables, and reports immediately upon saving.

### Lesson 167: Batch Pricing Base Label Updated to "Đơn giá nhập đã VAT"

- **Client Directive**:
  - In "Cài Giá Bán Theo Lô" (Batch Selling Price Configuration), update the text for the import price base option in "Gốc tính giá" to **"Đơn giá nhập đã VAT"**.
  - Since selling price margin is now calculated on top of the VAT-inclusive import price (`importPriceWithVat`), this text change clearly communicates to users that margin is applied to the VAT-inclusive price.
- **Frontend UI Updates**:
  - `src/routes/batches.new.tsx`: Updated `<SelectItem value="import_price">` to "Đơn giá nhập đã VAT".
  - `src/components/batches/BatchEditor.tsx`: Updated `<SelectItem value="import_price">` to "Đơn giá nhập đã VAT".
  - `src/routes/batches.index.tsx`: Updated batch list badge and filter dropdown to "Trên Giá Nhập Đã VAT".

### Lesson 168: Batch Goods Total ("Tiền Hàng") Computed as After-VAT (VAT-Inclusive)

- **Context & Client Directive**:
  - In batch management (`/batches` & `/batches/new` / `/batches/$batchId`), "Tiền Hàng" (goods value / total import price) must be the after-VAT amount (`importPriceWithVat`).
  - Previously, `totalImport` was aggregating `vehicles.importPrice` (pre-VAT), which caused "TIỀN HÀNG" and "TỔNG GIÁ VỐN LÔ" in `/batches` to display the pre-VAT value.
- **Backend & Database Queries**:
  - `src/server/fns/batches.ts`: Updated `listBatchesFn` to compute `totalImport: sql<string>'coalesce(sum(${vehicles.importPriceWithVat}),0)'`. This correctly computes both `totalImport` (Tiền hàng) and `totalCost = totalImport + totalExpense` (Tổng giá vốn lô) on the batch list page.
  - `src/server/services/finance.ts`: Updated supplier debt verification `assertPaymentWithinDebt` to sum `vehicles.importPriceWithVat`.
  - `src/server/services/reports.ts`: Updated `getPayablesSummary` (AP debt to suppliers) and `getInventoryTotals` to sum `vehicles.importPriceWithVat`.
- **Frontend UI Updates**:
  - `src/routes/batches.new.tsx`: Calculated `totalImport` summing `priceWithVat(v.importPrice, v.vatRate)` so the section header reads `(... chiếc — Tiền hàng {formatVnd(totalImport)})` using the VAT-inclusive price.
  - `src/components/batches/BatchEditor.tsx`: Added `— Tiền hàng {formatVnd(totalImport)}` to the vehicle section header using `importPriceWithVat`.

### Lesson 169: Vehicle Import Price ("Đơn Giá Nhập") Displayed After-VAT in Inventory (`/inventory`)

- **Context & Client Directive**:
  - In the Dual Inventory view (`/inventory`, "Kho Xe – Cơ Chế 2 Kho Độc Lập"), the "ĐƠN GIÁ NHẬP" column must display the VAT-inclusive price (`importPriceWithVat`), consistent with batch intake and costing rules.
- **Frontend UI & Filter Updates (`src/routes/inventory.tsx`)**:
  - Table cell for `ĐƠN GIÁ NHẬP`: Updated to render `{formatVnd(v.importPriceWithVat ?? v.importPrice)}`.
  - Filter logic: Updated price filter and allocated fee calculations to use `(v.importPriceWithVat ?? v.importPrice)`.
  - Filter dropdown label: Updated from "Đơn giá nhập (giá nhập thực tế)" to "Đơn giá nhập (đã gồm VAT)".

### Lesson 170: Comprehensive Audit of After-VAT Calculations for Imported Motorbikes

- **Audit & Verification**:
  - Conducted a full audit across all calculations, tables, alerts, and services involving imported motorbikes to ensure strict consistency with after-VAT (`importPriceWithVat`) pricing:
    1. **Expense Allocation & Cost Price Formula (`src/lib/business.ts`)**: Proportional expense allocation $\text{Allocated Expense}_i = \text{Total Batch Expenses} \times \frac{\text{importPriceWithVat}_i}{\sum \text{importPriceWithVat}}$ and $\text{Cost Price}_i = \text{importPriceWithVat}_i + \text{Allocated Expense}_i$.
    2. **Batch Selling Price Formula (`computeSellingPrice` in `src/lib/business.ts`)**: Base for "Đơn giá nhập đã VAT" uses `v.importPriceWithVat`.
    3. **Batch Intake & Batch Editor Header (`batches.new.tsx` & `BatchEditor.tsx`)**: "Tiền hàng" displays `sum(importPriceWithVat)`.
    4. **Below-Cost Warning Alert (`CostWarningAlert.tsx` & `BatchEditor.tsx`)**: Updated `CostWarningAlert` to display `worst.importPriceWithVat` and reference text "(Lưu ý: Đơn giá nhập đã VAT là ...)".
    5. **Inventory View & Filters (`inventory.tsx`)**: Table column "ĐƠN GIÁ NHẬP", fee calculations, and price range filters all evaluate `v.importPriceWithVat`.
    6. **Batch Listing & Total Cost (`batches.ts`)**: `totalImport` and `totalCost` in `listBatchesFn` sum `vehicles.importPriceWithVat`.
    7. **Supplier Debt & AP (`finance.ts` & `reports.ts`)**: `assertPaymentWithinDebt` and `getPayablesSummary` calculate supplier debt based on `vehicles.importPriceWithVat`.
    8. **Warehouse Total Asset Value (`reports.ts`)**: `getInventoryTotals` computes `importValue` using `vehicles.importPriceWithVat`.

### Lesson 171: Stock Widgets Above the `/inventory` Table

- **Client Directive**: above the vehicle table, show 3 widgets styled like the dashboard (`StatCard`): **Đã giao · Đã hóa đơn**, **Chưa giao · Chưa hóa đơn**, **Chưa giao · Đã hóa đơn**. Each shows the total value and the vehicle count; the numbers must follow the current filters; clicking a widget opens a new browser tab with the matching vehicles.
- **Implementation** (`src/routes/inventory.tsx`): `stockWidgets` is computed from `filtered` (the list after every filter), value = `sum(costPrice)` (same "trị giá vốn" basis as the dashboard). Each card is a `<Link to="/inventory" target="_blank">` whose search = current search params + the live chassis/engine text + `delivered: [..]`, `invoiced: [..]` for that widget (overriding any delivered/invoiced filter already set).
- **Also fixed**: "Xóa lọc" now clears `minFee` / `maxFee` too.

### Lesson 172: Nullable Vehicle Notes in Batch Entry and Inventory

- `vehicles.note` is nullable text (migration `0050_vehicle_note.sql`). Batch creation, vehicle additions, and vehicle edits persist trimmed notes; blank notes become `null`. Omitting the note from a full vehicle update preserves the existing value.
- Both batch vehicle tables have a leading sequential `STT` column and an optional note input immediately after the model/year/color column. Vehicle edit dialogs also retain and edit notes.
- Inventory displays notes for every vehicle. Users with the existing `batches.manage` permission can edit or clear notes through `updateVehicleNoteFn`, including for sold, delivered, or invoiced vehicles. This operation changes only the note and does not recalculate pricing or change stock flags. Successful saves invalidate queries so inventory and batch views refresh.
- Apply the schema change with `npm run migration:run` before using this feature.

### Lesson 173: Click Vehicle Notes to Edit in Inventory

- The inventory note column displays clickable note text for users with `batches.manage`; an empty note displays a clickable dash. Clicking opens the existing note editor, including for sold, delivered, or invoiced vehicles. The note column has no pencil icon; the existing vehicle-edit pencil remains in the final actions column and its form includes the note field. Users without management permission see plain text.

### Lesson 174: Edit Inventory Notes Only through the Vehicle Form

- Supersedes the inventory editing interactions in Lessons 172 and 173: the note column now displays plain text only, including the empty dash. Edit notes through the existing vehicle-edit pencil next to the delete button in the final actions column. The vehicle form retains its note field and follows the existing permission and vehicle-status restrictions.
- Removed the separate note dialog, click handling, mutation, and unused note-only server endpoint/service. Batch entry, note persistence, and note display are unchanged.

### Lesson 175: Inventory Note Column Follows the Sales Order Column

- In `/inventory`, both the note header and every vehicle's note cell appear immediately after `Sales Order` and before the optional `Actions` column. Notes remain plain text and are edited through the vehicle form described in Lesson 174.

### Lesson 176: Company Tax Code Validation & QA Bug Tracker Skill

- **QA Bug Log & Feedback Interpretation**:
  - Created skill `qa-bug-log-tracker` in `.agents/skills/qa-bug-log-tracker/SKILL.md` and `.claude/skills/qa-bug-log-tracker/SKILL.md` to instruct agents how to read client QA spreadsheets:
    - **Left column/square**: Bug report / reproduction link (e.g. `prnt.sc/...` Lightshot screenshot) with status pill `[Bug]`.
    - **Right column/square**: Desired fix / outcome (e.g. `trường mã số thuế chỉ cho nhập số thôi chặn kí tự và chữ cái`).
- **Company Tax Code Bug Resolution (`/settings?tab=company`)**:
  - **Issue**: In `Pháp Nhân Doanh Nghiệp`, "Mã Số Thuế" accepted letters and special characters (e.g., `4566455553ggg@@`).
  - **Client-Side Enforcement (`src/routes/settings.tsx`)**:
    - Input sanitization on `onChange`: `e.target.value.replace(/\D/g, '')` strips all non-numeric characters immediately.
    - Added `inputMode="numeric"`, `pattern="[0-9]*"`, and `placeholder="Chỉ nhập số..."`.
    - Real-time inline field validation error and visual red border if blank or invalid.
    - Also enforced email formatting validation and inline error display for "Email Liên Hệ".
  - **Server-Side Enforcement (`src/server/fns/system.ts`)**:
    - `taxCode`: Validated with `.regex(/^\d+$/, 'Mã số thuế chỉ được chứa các chữ số')`.
    - `email`: Validated with `.refine(...)` ensuring valid format when provided.

### Lesson 177: Company Phone & Email Validation, and Duplicate Motorcycle Model Prevention

- **Context & QA Bug Log Reports**:
  - Bug 1: `nhập email sai định dạng không hiển thị lỗi` (https://prnt.sc/wJkVla98GuoJ) -> Company settings email input accepted invalid format (e.g. `ac`) and displayed success banner without error.
  - Bug 2: `số điện thoại nhập sai định dạng không hiển thị lỗi` -> Desired fix: `chỉ cho nhập số` (https://prnt.sc/cUv7_DLRf_6T) -> Phone input accepted non-digits (e.g. `0nfj@`).
  - Bug 3: Duplicate motorcycle model bug -> Desired fix: `không cho tạo/sửa trùng dòng xe` (https://prnt.sc/mc8r8PhxXcq9).
- **Company Settings Resolution (`src/routes/settings.tsx` & `src/server/fns/system.ts`)**:
  - `phone` ("Số Điện Thoại"):
    - Real-time digit stripping: `e.target.value.replace(/\D/g, '')`.
    - Added `inputMode="numeric"`, `pattern="[0-9]*"`, and `placeholder="Chỉ nhập số..."`.
    - Server Zod schema validation: `.regex(/^\d+$/, 'Số điện thoại chỉ được chứa các chữ số')`.
    - Inline error `<p className="text-[11px] font-medium text-rose-600">` and red border highlight.
  - `email` ("Email Liên Hệ"):
    - Inline regex validation checking valid email format prior to submission.
    - Server Zod schema validation: rejects malformed emails.
    - Inline error text rendered under the input when invalid.
- **Motorcycle Model Duplicate Prevention (`src/routes/master-data.tsx` & `src/server/fns/master-data.ts`)**:
  - Server-side check in `saveModelFn`:
    - Queries `motorcycle_models` case-insensitively with `sql`lower(${motorcycleModels.name}) = ${trimmedName.toLowerCase()}`` (excluding current model `id` if editing).
    - Throws user-friendly error `Dòng xe "${trimmedName}" đã tồn tại trong hệ thống`.
  - Client-side pre-validation in `handleSaveModel`:
    - Checks `master.models.some(...)` against trimmed name (case-insensitive) excluding the current editing model.
    - Sets `mError` to display inline error under the model name input and halts form submission.

### Lesson 178: Zod v4 Error Message Translation & Master Data Empty Input Prevention

- **Context & QA Bug Log Report**:
  - Screenshot `https://prnt.sc/4JWleo4_p3Jn` showed `/master-data?tab=models` popping up an error dialog with raw English Zod text:
    `Thông Báo Lỗi` -> `Tên: Too small: expected string to have >=1 characters`.
- **Root Cause Analysis**:
  - In Zod v4 (`zod` ^4.3.6), string validation issue objects provide `origin: 'string'` rather than Zod v3's `type: 'string'`.
  - In `src/components/ui/confirm-dialog.tsx`, `formatErrorMessage` checked `item.code === 'too_small' && item.type === 'string'`. Because `item.type` was `undefined`, it skipped the Vietnamese formatting logic and fell back to `item.message`, which was Zod's default raw English string (`"Too small: expected string to have >=1 characters"`).
  - Additionally, several master-data modal handlers submitted without trimming or validating client-side input.
- **Resolution**:
  - **`src/components/ui/confirm-dialog.tsx` (`formatErrorMessage`)**:
    - Updated `isString` check to `item.origin === 'string' || item.type === 'string'`.
    - Added comprehensive default message detection (`isDefaultZodMessage`: starts with `Too small`, `Too big`, `Expected `, `Invalid `).
    - If empty string (`item.minimum === 1`), formats to `"Không được để trống"`.
    - If `item.minimum > 1`, formats to `"Tối thiểu N ký tự"`.
    - Automatically strips any remaining raw English Zod fragments.
  - **`src/server/fns/master-data.ts`**:
    - Added user-friendly Vietnamese messages to all Zod `.min(1, '...')` schemas (`saveBankFn`, `saveBankAccountFn`, `saveSupplierFn`, `saveModelFn`, `saveColorFn`, `saveExpenseTypeFn`).
  - **`src/routes/master-data.tsx`**:
    - Added client-side trimmed validation across all modal forms (`handleSaveExpenseType`, `handleSaveSupplier`, `handleSaveBank`, `handleSaveAccount`, `handleSaveColor`) before initiating network mutations.

### Lesson 179: Latest Created Vehicle Models Displayed First in List

- **Context & QA Feedback**:
  - QA Feedback ticket (`https://prnt.sc/QziXEt82HkZR`): `hiển thị dòng xe vừa tạo lên đầu danh sách` (Display the newly created motorcycle model at the top of the list).
  - Previously, `getMasterDataFn` ordered `motorcycleModels` by `asc(motorcycleModels.name)`. When users added a new model, it was sorted alphabetically and often placed at the bottom or on later pagination pages, requiring manual search to confirm creation.
- **Resolution**:
  - `src/server/fns/master-data.ts`: Updated `getMasterDataFn` to query `motorcycleModels` with `.orderBy(desc(motorcycleModels.id))`.
  - The latest created vehicle model now automatically appears as the very first item on page 1 of the Dòng Xe catalogue (`/master-data?tab=models`) and at the top of vehicle selection lists.

### Lesson 180: Whitespace Validation Message Localization & Latest Created Suppliers Ordering

- **Context & QA Feedback**:
  - QA Feedback ticket 1 (`https://prnt.sc/eQD-UeDakgJ3`): `việt hóa message lỗi khi nhập khoảng trắng` (Vietnamese localization for error message when entering whitespace).
    - When entering whitespace/blank into required text inputs like "Tên Doanh Nghiệp Cung Cấp *", the system displayed raw Zod error text.
  - QA Feedback ticket 2 (`https://prnt.sc/uESx1QE5pZfo`): `hiển thị NCC vừa tạo lên đầu danh sách` (Display newly created supplier at the top of the list).
- **Resolution**:
  - **Validation Message Localization**:
    - Updated `src/components/ui/confirm-dialog.tsx` (`formatErrorMessage`): When string input fails minimum length / empty check, outputs `"Không được để trống hoặc chỉ chứa khoảng trắng"`.
    - Updated `src/server/fns/master-data.ts`: Applied explicit Vietnamese messages to all master data entity schemas (`saveSupplierFn`, `saveModelFn`, `saveBankFn`, `saveBankAccountFn`, `saveColorFn`, `saveExpenseTypeFn`).
    - Updated `src/routes/master-data.tsx`, `SupplierDetailDialog.tsx`, and `SupplierSelect.tsx`: Added trimmed whitespace checks preventing blank submissions with consistent Vietnamese dialog/inline errors.
  - **Supplier Ordering (`src/server/fns/master-data.ts`)**:
    - Updated `getMasterDataFn` to query `suppliers` with `.orderBy(desc(suppliers.id))` so newly created suppliers automatically appear as the first item on page 1 of the Nhà Cung Cấp catalogue (`/master-data?tab=suppliers`) and at the top of supplier dropdowns.

### Lesson 181: Master Data Global Newest-First Ordering (Banks, Accounts, Colors, Expense Types)

- **Context & QA Feedback**:
  - QA Feedback ticket (`https://prnt.sc/YGi0NgUeANj5`): `hiển thị ngân hàng vừa tạo lên đầu danh sách` (Display newly created bank at the top of the list).
- **Resolution**:
  - `src/server/fns/master-data.ts`: Extended the `.orderBy(desc(id))` strategy to all remaining master data catalogs in `getMasterDataFn`:
    - `banks`: `.orderBy(desc(banks.id))`
    - `companyBankAccounts`: `.orderBy(desc(companyBankAccounts.id))`
    - `colors`: `.orderBy(desc(colors.id))`
    - `expenseTypes`: `.orderBy(desc(expenseTypes.id))`
  - Any new bank, account, color, or expense type added by users will automatically appear as the first row on page 1 of its respective catalogue table.

### Lesson 182: Bank Whitespace Localization & Comprehensive Duplicate Prevention across Master Data

- **Context & QA Feedback**:
  - QA Feedback ticket 1 (`https://prnt.sc/x4cXxIADw2li`): `việt hóa message lỗi khi nhập khoảng trắng` (Localized error message when entering whitespace in bank name).
  - QA Feedback ticket 2 (`https://prnt.sc/z1bLMJX3yOcx, https://prnt.sc/s4bkMLY7x9sp`): `không cho tạo/sửa trùng ngân hàng` (Do not allow creating/editing duplicate banks).
- **Resolution**:
  - **Duplicate Prevention across Master Data**:
    - **Server-Side (`src/server/fns/master-data.ts`)**:
      - `saveBankFn`: Checks existing banks by case-insensitive name (`sql`lower(${banks.name}) = ${trimmedName.toLowerCase()}``) excluding current editing ID, throwing `Ngân hàng "${trimmedName}" đã tồn tại trong hệ thống`.
      - `saveSupplierFn`: Checks existing suppliers, throwing `Nhà cung cấp "${trimmedName}" đã tồn tại trong hệ thống`.
      - `saveColorFn`: Checks existing colors, throwing `Màu sắc "${trimmedName}" đã tồn tại trong hệ thống`.
      - `saveExpenseTypeFn`: Checks existing expense types, throwing `Loại chi phí "${trimmedName}" đã tồn tại trong hệ thống`.
      - `saveBankAccountFn`: Checks duplicate account numbers per bank, throwing `Số tài khoản "${cleanNumber}" đã tồn tại cho ngân hàng này`.
    - **Client-Side Pre-Validation (`src/routes/master-data.tsx`)**:
      - Added instant case-insensitive duplicate checks in modal save handlers (`handleSaveBank`, `handleSaveSupplier`, `handleSaveColor`, `handleSaveExpenseType`, `handleSaveAccount`) alerting users prior to sending network requests.

### Lesson 183: Bank Tab Search Box Placeholder Updated to "Tìm tên ngân hàng"

- **Context & QA Feedback**:
  - QA Feedback ticket (`https://prnt.sc/-wak8m1K3G5P`): `đổi placeholder thành "Tìm tên ngân hàng"`.
  - The previous placeholder (`"Tìm tên, mã hoặc tên viết tắt ngân hàng..."`) was excessively long and was visually truncated (`"Tìm tên, mã hoặc tên viết tắt ngân h"`) inside the `SearchBox` on `/master-data?tab=banks`.
- **Resolution**:
  - `src/routes/master-data.tsx`: Updated `SearchBox` placeholder for the `banks` tab to `"Tìm tên ngân hàng..."`, providing a clean, concise input label consistent with other master data tabs without truncation.

### Lesson 184: Bank Account Number Restricted to Digits Only

- **Context & QA Bug Log Report**:
  - QA Bug ticket (`https://prnt.sc/aeN-bSb9HlAi`): `số tài khoản chỉ nhập số thôi chặn kí tự và chữ cái` (Bank account number must only accept digits, blocking letters and special characters).
  - The previous form accepted arbitrary characters (such as `HHH@@`).
- **Resolution**:
  - **Client-Side Sanitization & Validation (`src/routes/master-data.tsx`, `BankAccountSelect.tsx`, `loans.index.tsx`)**:
    - `onChange`: Automatically strips non-digits with `replace(/\D/g, '')`.
    - Added `inputMode="numeric"`, `pattern="[0-9]*"`, and `maxLength={50}`.
    - Verified `!/^\d+$/.test(cleanNumber)` before submitting, alerting `"Số tài khoản chỉ được chứa các chữ số"`.
  - **Server-Side Enforcement (`src/server/fns/master-data.ts`)**:
    - Added `.regex(/^\d+$/, 'Số tài khoản chỉ được chứa các chữ số')` to `saveBankAccountFn` Zod validator.

### Lesson 185: Color Ordering and Duplicate Color Prevention (`/master-data?tab=colors`)

- **Context & QA Feedback**:
  - QA Feedback ticket 1 (`https://prnt.sc/7kWP1_XMkwDv`): `hiển thị màu sắc vừa tạo lên đầu danh sách` (Display newly created color at the top of the list).
  - QA Feedback ticket 2 (`https://prnt.sc/NM8phj3dVNlu`): `không cho tạo/sửa trùng màu sắc` (Do not allow creating/editing duplicate colors).
- **Resolution**:
  - **Ordering (`src/server/fns/master-data.ts`)**:
    - `getMasterDataFn` orders `colors` by `desc(colors.id)` so any newly created color automatically appears as the very first row on page 1 of the Màu Sắc table (`/master-data?tab=colors`) and at the top of color pickers across batches and sales dispatches.
  - **Duplicate Color Prevention**:
    - **Client-Side Pre-Validation (`src/routes/master-data.tsx`)**:
      - In `handleSaveColor`, trimmed color name is checked against `master.colors.some(...)` (case-insensitive) excluding the current editing ID. If found, displays `alertDialog(`Màu sắc "${trimmed}" đã tồn tại trong hệ thống`)` before making the network request.
    - **Server-Side Enforcement (`src/server/fns/master-data.ts`)**:
      - In `saveColorFn`, queries `colors` for `lower(${colors.name}) = ${trimmedName.toLowerCase()}` excluding `id`. If found, throws `new Error(`Màu sắc "${trimmedName}" đã tồn tại trong hệ thống`)`.

### Lesson 186: Expense Type Ordering and Duplicate Prevention (`/master-data?tab=expenseTypes`)

- **Context & QA Feedback**:
  - QA Feedback ticket 1 (`https://prnt.sc/bO_xEaKCmPXQ`): `hiển thị chi phí vừa tạo lên đầu danh sách` (Display newly created expense type at the top of the list).
  - QA Feedback ticket 2 (`https://prnt.sc/EGhoRcHQzTkq`): `không cho tạo/sửa trùng loại chi phí` (Do not allow creating/editing duplicate expense types).
- **Resolution**:
  - **Ordering (`src/server/fns/master-data.ts`)**:
    - `getMasterDataFn` orders `expenseTypes` with `.orderBy(desc(expenseTypes.id))` so any newly created expense type automatically appears as the very first row on page 1 of the Loại Chi Phí table (`/master-data?tab=expenseTypes`).
  - **Duplicate Expense Type Prevention**:
    - **Client-Side Pre-Validation (`src/routes/master-data.tsx`)**:
      - In `handleSaveExpenseType`, trimmed and normalized name (`replace(/\s+/g, ' ').normalize('NFC')`) is verified against `master.expenseTypes.some(...)` (case-insensitive) excluding the current editing ID. If found, displays `alertDialog(`Loại chi phí "${trimmed}" đã tồn tại trong hệ thống`)` before sending requests.
    - **Server-Side Enforcement (`src/server/fns/master-data.ts`)**:
      - In `saveExpenseTypeFn`, queries `expenseTypes` for `lower(trim(${expenseTypes.name})) = ${trimmedName.toLowerCase()}` excluding `id`. If duplicate exists, throws `new Error(`Loại chi phí "${trimmedName}" đã tồn tại trong hệ thống`)`.

### Lesson 187: Non-Blocking Duplicate Name Warning for Suppliers & Customers/Branches

- **Context & Client Business Rule**:
  - QA Feedback: "Khi nhập tên trùng với khách hàng/NCC đã tồn tại, nên hiển thị cảnh báo để người dùng kiểm tra, nhưng vẫn cho phép tiếp tục lưu vì các khách hàng/NCC khác nhau có thể trùng tên" (When entering a name that duplicates an already existing customer / supplier, display a warning so the user can verify, but still allow saving because different customers/suppliers can have the same name).
- **Architecture & Implementation**:
  - **Suppliers (`src/routes/master-data.tsx`, `SupplierDetailDialog.tsx`, `SupplierSelect.tsx`, `src/server/fns/master-data.ts`)**:
    - Replaced hard-blocking errors with an interactive warning confirmation dialog (`confirmDialog`):
      `Cảnh Báo Trùng Tên Nhà Cung Cấp`: `Nhà cung cấp "${trimmed}" đã tồn tại trong hệ thống. Các nhà cung cấp khác nhau có thể có cùng tên. Bạn có chắc chắn muốn tiếp tục lưu không?`.
    - If user clicks "Tiếp tục lưu" (confirm), the form proceeds with saving. If user cancels ("Kiểm tra lại"), stays in the editor.
    - Server `saveSupplierFn`: Removed duplicate error throwing to permit saving confirmed duplicate trade names.
  - **Customers (`src/routes/customers.index.tsx`)**:
    - When saving or updating a customer (`handleCreateCustomer`), checks `data?.some(...)` for matching name.
    - Prompts with `confirmDialog` ("Cảnh Báo Trùng Tên Khách Hàng") allowing users to proceed or revise.
  - **POS Branches (`src/routes/customers.$customerId.tsx`)**:
    - When saving a branch (`handleCreateBranch`), checks `customer.branches.some(...)` and prompts with `confirmDialog` ("Cảnh Báo Trùng Tên Điểm Bán") allowing users to proceed or revise.

### Lesson 188: Actions Column Header ("Thao tác") in Master Data (`/master-data`)

- **Context & QA Feedback**:
  - QA Feedback ticket (`https://prnt.sc/jWWh7ir5ujEM`): `thêm text Thao tác trên icon sửa xóa` (Add header text "Thao tác" above edit/delete icons).
  - Previously, all tables in `/master-data` had an empty `<TableHead className="w-10"></TableHead>` or `<TableHead className="w-20"></TableHead>` column header above the action buttons.
- **Resolution**:
  - Updated all 6 master data tab tables in `src/routes/master-data.tsx` (`models`, `expenseTypes`, `suppliers`, `banks`, `accounts`, `colors`):
    - Replaced empty `<TableHead>` with `<TableHead className="w-24 text-right pr-4">Thao tác</TableHead>`.
    - Aligns header text right with the `size-7` edit/delete action button groups.

### Lesson 189: Ellipsis Truncation for Long Names in Master Data Tables (`/master-data`)

- **Context & QA Feedback**:
  - QA Feedback tickets (`https://prnt.sc/V6alvEZ-btPn`, `https://prnt.sc/vkf1kLSIL-Ru`, `https://prnt.sc/nVZ5gXEZM9K7`): `tên dài quá thì ... để UI gọn hơn` (If the name is too long, truncate with ellipsis `...` to keep UI neat and compact).
  - Extremely long supplier names, bank names, and company bank account names stretched table cells horizontally and pushed subsequent columns off-screen.
- **Resolution**:
  - Updated `src/routes/master-data.tsx`:
    - **Suppliers**: Constrained cell with `max-w-xl` and truncated text `truncate` with `title={s.name}`.
    - **Banks**: Wrapped `BankLabel` in `<div className="max-w-xl truncate" title={b.name}>`.
    - **Company Bank Accounts**: Fixed column widths (`w-52` for account name, `w-64` for bank, `w-36` for account number, `w-36` for branch, `w-28` for status) and wrapped text in `max-w-[...] truncate` with `title={...}`.
    - **Models, Expense Types, Colors**: Applied `max-w-xl truncate` with `title={...}`.
  - Long entity names now cleanly truncate with ellipsis (`...`), keeping all columns visible while allowing full text inspection on hover.

### Lesson 190: Relocating Rows-Per-Page Selector ("Số dòng") to Right Side in TablePagination Across All Tables

- **Context & QA Feedback**:
  - QA Feedback ticket (`https://prnt.sc/UOzZMNyxGq4p`): `đưa số dòng qua bên phải, dev sửa các trang UI còn lại luôn` (Move the "Số dòng" rows-per-page dropdown to the right side; dev must update across all remaining UI pages as well).
  - In the table footer, the "Số dòng" dropdown was previously on the left alongside the range counter ("Hiển thị X–Y / Z"), separating it from the pagination page navigation controls.
- **Resolution**:
  - The application uses the unified `TablePagination` component (`src/components/ui/table-pagination.tsx`) across all 14+ paginated tables and picker modals (`/batches`, `/customers`, `/finance`, `/inventory`, `/loans`, `/master-data`, `/reconcile`, `/reports`, `/sales`, `/settings`).
  - Updated `TablePagination` in `src/components/ui/table-pagination.tsx`:
    - **Left Container**: Strictly renders range info (`Hiển thị from–to / total`).
    - **Right Container**: Groups the rows-per-page selector (`Số dòng: [10 v]`) side-by-side with the page buttons (`< [1] [2] >` and `Trang X / Y`).
    - Standardized `SelectTrigger` dimensions (`h-8 w-[4.5rem] text-xs rounded-lg`) to cleanly align with page navigation buttons (`h-8`).
  - Because `TablePagination` is the single source of truth for list pagination across the entire codebase, this updates every single table view uniformly across the system.

### Lesson 191: Latest Created Customer & POS Branches Ordering (`/customers` & `/customers/$customerId`)

- **Context & QA Feedback**:
  - QA Feedback ticket (`https://prnt.sc/4O6yiUcOiHVJ`): `hiển thị khách hàng vừa tạo lên đầu danh sách` (Display newly created customer at the top of the list).
  - Previously, `listCustomersFn` queried `customers` with `.orderBy(asc(customers.name))`. When users created a new customer, it sorted alphabetically, often landing near the bottom of the list or on subsequent pages.
- **Resolution**:
  - **Server-Side Ordering (`src/server/fns/customers.ts`)**:
    - Updated `listCustomersFn` to query `customers` with `.orderBy(desc(customers.id))` so newly created customer records appear at the top by default.
    - Updated `getCustomerDetailFn` to query `posBranches` with `.orderBy(desc(posBranches.id))` so newly created POS branches appear at the top of the branch list.
  - **Client-Side Tie-Breaking & Auto-Reset (`src/routes/customers.index.tsx`)**:
    - In custom table sorting (`sorted = sort ? [...filtered].sort(...) : filtered`), added `b.id - a.id` as a tie-breaker when sorted values are identical (e.g., customers with equal branch counts or balance), keeping newer customers higher up.
    - In `handleCreateCustomer`, when saving a newly created customer (non-edit), automatically resets active search text (`q`) and sort parameters, ensuring users immediately see their new customer at the very top of page 1.

### Lesson 192: Accent-Insensitive / Unaccented Customer Search (`/customers`)

- **Context & QA Feedback**:
  - QA Feedback ticket (`https://prnt.sc/KrtcfMxzIeQQ`): `cho phép tìm tên khách hàng không dấu` (Allow searching customer name without diacritics / unaccented search).
  - In `/customers`, the customer filter previously used raw substring matching `c.name.toLowerCase().includes(q)`. Typing unaccented text like "khuong" resulted in 0 matches for "Khương".
- **Resolution**:
  - **Client-Side Filtering (`src/routes/customers.index.tsx`)**:
    - Replaced `c.name.toLowerCase().includes(q)` with `matchesSearch(nameSearch, c.name)` from `#/lib/text.ts`.
    - `matchesSearch` normalizes and folds Unicode diacritics via `foldText` (`normalize('NFD')`, stripping combining marks `[\u0300-\u036f]`, converting `đ`/`Đ` to `d`, and lower-casing).
    - Unaccented queries like "khuong", "thanh thuy", or "mai" match accented customer names ("Khương", "Thanh Thùy", "Mai") immediately.
  - Also extended `matchesSearch` to vehicle and transaction searches in `sales.$orderId.tsx` and `reconcile.tsx` for consistent system-wide search experience.

### Lesson 193: Permission Group Renamed to Match Sidebar Navigation ("Dữ liệu chung")

- **Context & QA Feedback**:
  - QA Feedback ticket (`https://prnt.sc/vjBkCTzW3v9e`): `Đổi tên nhóm "Danh mục hệ thống" thành "Dữ liệu chung" để giống thanh menu` (Rename permission group "Danh mục hệ thống" to "Dữ liệu chung" to match the sidebar menu).
  - While the sidebar menu item was previously renamed to "Dữ liệu chung" (covering Dòng xe, Nhà cung cấp, Ngân hàng, Tài khoản ngân hàng, Màu sắc, Loại chi phí), the role permission checklist in `PERMISSION_GROUPS` (`RolesTab.tsx`) was still displaying the legacy group header "Danh mục hệ thống".
- **Resolution**:
  - Updated `src/lib/permissions.ts`:
    - In `PERMISSION_GROUPS`, changed `label: 'Danh mục hệ thống'` to `label: 'Dữ liệu chung'` for group `key: 'master-data'`.
    - Modal in `/settings?tab=roles` (`RolesTab.tsx`) now displays "Dữ liệu chung", ensuring 100% nomenclature alignment with the application sidebar menu.

### Lesson 194: Bidirectional Permission Coupling (Auto-Grant & Auto-Revoke View Permissions)

- **Context & QA Feedback**:
  - QA Feedback / Bug ticket (`https://prnt.sc/vs_K8K5S3rPI`): `tick vô "Tạo khế ước.." nhưng truy cập vô quyền đó không có menu tạo khế ước` (Ticked "Tạo khế ước..." but the user had no menu to access the loan creation feature).
  - Cause: Action permissions (e.g. `loans.manage`, `sales.create`, `master-data.manage`) could be checked in isolation while the underlying module view permission (e.g. `loans.view`, `sales.view`, `master-data.view`) was left unchecked. Since the sidebar and route guards require the view permission, users holding action permissions could not see the menu item or access the page.
- **Resolution**:
  - **Shared Permission Rule Maps (`src/lib/permissions.ts`)**:
    - Created `VIEW_TO_ACTIONS_MAP` and `ACTION_TO_VIEW_MAP` defining the exact parent/child relationship between view and action permissions across all modules (`batches`, `sales`, `loans`, `finance`, `reconcile`, `customers`, `master-data`).
    - Added `togglePermissionWithRules`:
      - **Auto-grant view**: Ticking ANY action permission in a module automatically ticks its module view permission.
      - **Auto-revoke dependents**: Unticking a view permission automatically removes ALL action permissions within that module.
    - Added `normalizePermissions`: Deduplicates and guarantees that any permission set containing action permissions always contains their corresponding view permissions.
    - Updated `hasPermission`: If checking for a module's view permission, holding ANY action permission within that module automatically grants view access as well (safeguarding legacy role records).
  - **UI & Server Enforcement**:
    - `RolesTab.tsx`: Bound checkbox toggling to `togglePermissionWithRules`, normalized incoming permissions on `openEdit`, and passed normalized permissions on `handleSave`.
    - `saveRoleFn` (`src/server/fns/system.ts`): Passed received permissions through `normalizePermissions` before persisting into `role_permissions`.

### Lesson 195: Role Description Truncation & Table Header Alignment (`/settings?tab=roles`)

- **Context & QA Feedback**:
  - QA Feedback ticket (`https://prnt.sc/EzxsrqnNJsZa`): `mô tả dài quá thì ...` (If description is too long, truncate with `...` / ellipsis).
  - Extremely long role descriptions (up to 255 characters) stretched table cells horizontally and pushed subsequent columns (Quyền, Người Dùng, Thao tác) beyond the viewport, causing unnecessary horizontal scrollbars.
- **Resolution**:
  - **`src/components/settings/RolesTab.tsx`**:
    - Constrained `Mô Tả` table cell with `max-w-md` and wrapped text in `<div className="truncate" title={r.description ?? undefined}>`. Long descriptions truncate cleanly with `...` while full text remains viewable on hover.
    - Constrained `Tên Vai Trò` with `max-w-xs truncate` and tooltip `title={r.name}`.
    - Added `<TableHead className="w-24 text-right pr-4">Thao tác</TableHead>` aligned with action buttons.
    - Sized column widths (`w-48` for role name, `w-28` for permission count and user count) ensuring fixed, clean layout.

### Lesson 196: Eliminating Duplicate Password Reveal Eye Icon (`/login`)

- **Context & QA Feedback**:
  - QA Feedback ticket (`https://prnt.sc/oCa1VM-ELqRp`): `bỏ bớt 1 icon con mắt đi` (Remove one of the duplicate eye icons).
  - In Chromium and Microsoft Edge on Windows, `input[type="password"]` automatically renders a native browser password reveal eye button (`::-ms-reveal`). Because `PasswordInput` already includes a custom Lucide `<Eye />` toggle button, users were presented with two redundant eye icons side-by-side in the password field.
- **Resolution**:
  - In `src/styles.css`: Added global rule `input::-ms-reveal, input::-ms-clear { display: none; }` to suppress native browser password reveal and clear controls.
  - In `src/components/ui/password-input.tsx`: Added `[&::-ms-reveal]:hidden [&::-ms-clear]:hidden` to `Input` className to ensure consistent single-eye behavior across all platforms and browsers.

### Lesson 197: Immediate Account Lockout Notification & Seamless Session Revocation

- **Context & QA Feedback**:
  - QA Feedback ticket (Module: `Quản lý người dùng` / CMS):
    - Requirement: `người dùng đang log in mà admin khóa thì hiển thị thông báo "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ"` (When an active user is logged in and an admin locks/deactivates their account, show notice: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ").
- **Root Cause & Technical Gap**:
  - Previously, `saveUserFn` immediately deleted sessions from `sessions` table upon deactivation. When the user's browser sent subsequent requests, `getUserBySessionToken` found no session record and returned generic 401 unauthenticated, losing the context that the account was explicitly deactivated by an admin.
  - Furthermore, `currentUserQuery` had a 5-minute cache time without periodic polling, causing idle users to remain uninformed for minutes.
- **Architectural Resolution**:
  1. **`src/lib/auth-errors.ts`**:
     - Defined `ACCOUNT_LOCKED_CODE = 'ACCOUNT_LOCKED'` and exact message `ACCOUNT_LOCKED_MESSAGE = 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ'`.
     - Added type-safe detector `isAccountLockedError(error: unknown): boolean`.
  2. **`src/server/services/auth.ts`**:
     - In `getUserBySessionToken`: When session matches but `!row.isActive`, automatically purge the user's sessions from `sessions` and throw `ACCOUNT_LOCKED_CODE: ACCOUNT_LOCKED_MESSAGE`.
     - In `authenticate`: If user exists but `!user.isActive`, return `{ user: null, reason: 'locked' }`.
  3. **`src/server/fns/auth.ts`**:
     - In `loginFn`: When `reason === 'locked'`, throw `ACCOUNT_LOCKED_MESSAGE` so locked users attempting to log in receive this exact message.
  4. **`src/server/fns/system.ts`**:
     - In `saveUserFn`: Deactivated accounts retain their sessions in DB until the next request so `getUserBySessionToken` detects the deactivation and delivers the exact locked message before cleaning up.
  5. **`src/lib/queries.ts`**:
     - Configured `currentUserQuery` with `staleTime: 10_000`, `refetchInterval: 10_000`, and `refetchOnWindowFocus: true` for near real-time detection of account lockouts.
  6. **`src/integrations/tanstack-query/root-provider.tsx`**:
     - In `handleAuthError(error)`: When `isAccountLockedError(error)` triggers, displays an immediate modal dialog (`alertDialog`) with the message `"Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ"`. Clicking "Về trang đăng nhập" redirects to `/login?locked=1`.
  7. **`src/routes/login.tsx`**:
     - Accepts `locked` search param (`/login?locked=1`) and initializes `error` state to `ACCOUNT_LOCKED_MESSAGE`, presenting a prominent red error banner upon arrival.
  8. **`src/routes/__root.tsx`**:
     - Added router `errorComponent` catching `isAccountLockedError(error)` and redirecting to `/login?locked=1`.

### Lesson 198: Password Reset Token Expiry & MySQL Timezone Consistency

- **Context & QA Feedback**:
  - QA Bug ticket (`https://prnt.sc/fpDjCFsvbaI6`): `nhập email -> qua form đặt lại mật khẩu nhưng khi đặt lại mật khẩu đặt không được` (Enter email -> open reset password form, but cannot reset password with error: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn").
- **Root Cause & Smoking Gun**:
  - In `createPasswordResetToken`, the expiration time was inserted using JavaScript's `new Date(Date.now() + 30 * 60_000)` which serialized to UTC string format `YYYY-MM-DD HH:mm:ss`.
  - In `resetPasswordWithToken`, the validation condition evaluated `gt(passwordResetTokens.expiresAt, sql`NOW()`)` against MySQL's `NOW()`.
  - When the MySQL session timezone is `+07:00` (Vietnam, standard on staging/production servers) while Node outputs UTC, MySQL's `NOW()` is 7 hours ahead of the UTC timestamp. Consequently, a token created to expire in 30 minutes was already considered 6.5 hours in the past the instant it was created, immediately causing `resetPasswordWithToken` to fail with "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn".
- **Resolution**:
  1. **`src/server/services/auth.ts`**:
     - Updated `createPasswordResetToken` to use MySQL's clock: `expiresAt: sql`DATE_ADD(NOW(), INTERVAL 30 MINUTE)``. This guarantees the expiration timestamp and subsequent `gt(expiresAt, sql`NOW()`)` evaluations use the exact same MySQL clock, eliminating timezone skew across all server environments.
     - Normalized email matching: `where(sql`LOWER(${users.email}) = ${normalizedEmail}`)`.
     - Trimmed token before hash evaluation and set `usedAt: sql`NOW()``.
     - Updated `createSession` to use `expiresAt: sql`DATE_ADD(NOW(), INTERVAL ${SESSION_TTL_DAYS} DAY)`` and `lastLoginAt: sql`NOW()``.
  2. **`src/server/fns/auth.ts`**:
     - Enforced `z.string().trim().email()` for email input in `forgotPasswordFn` and `z.string().trim().min(10)` for `token` in `resetPasswordFn`.
  3. **`src/routes/reset-password.tsx`**:
     - Passed `token.trim()` to mutation.

### Lesson 199: Invoice Status Filter in Sales Order Details

- `/sales/$orderId` has an invoice-status dropdown in the vehicle filter dialog with all statuses, invoiced, and uninvoiced options. It filters by `isInvoiced` independently of physical delivery and combines with the existing search, delivery, model, color, and selection-mode filters.
- Invoice status participates in the active-filter count, reset action, and pagination reset key, so changing it returns the vehicle list to page 1. No database or server changes are required.

### Lesson 200: Excel Export from Sales Order Details

- `/sales/$orderId` has an Excel export button beside the vehicle filters. It exports the entire current filtered vehicle list across all pages, including selection-mode visibility, rather than only the current page or checked rows.
- The workbook is built in `src/lib/sales-order-excel.ts` (`downloadSalesOrderExcel`). The page loads that module with `await import(...)` on click, so `xlsx` stays out of the page bundle. Export runs in the browser, shows a success toast, and is disabled for an empty result or while exporting.
- Sheet layout: an order block on top (order number, customer, branch or "Trực tiếp", order date, exported count with the active filters in words, export time), one empty row, the table, one empty row, then a totals row. Keep that empty row before the totals: Excel extends the autofilter over any row touching the data, so sorting would move the totals into the list.
- Columns mirror the list on screen, then add detail: row number, chassis/engine numbers, model/color, price before VAT, VAT %, VAT amount (`unitPrice - priceBeforeVat`), price with VAT, `Kho thực tế` (`Đã giao` / `Còn trong kho thực tế`), delivery date, delivery note number, receiver/driver, truck/plate, `Kho hóa đơn` (`Đã xuất HĐ` / `Chưa xuất HĐ`), invoice number/date. The two warehouse columns use the same names and wording as the list's `Kho Thực Tế` / `Kho Hóa Đơn` badges (without the date, which has its own column). Delivery fields are filled only when `isDelivered`, invoice fields only when `isInvoiced` (independent flags). Cost price is never exported.
- Money cells are numbers with `#,##0`. Dates are real Excel date serials with `dd/mm/yyyy` (built from the `yyyy-mm-dd` strings, timezone-free), so they sort and filter as dates. The totals row uses `SUBTOTAL(109/103, ...)` with cached values, so totals follow the Excel autofilter. The autofilter covers only the header and data rows.
- SheetJS Community 0.18.5 cannot write cell styles (bold, fills) or frozen panes; merges, number formats, formulas, column widths and autofilter work. The file name uses the local date: `phieu-ban-<id>-xe-<yyyy-mm-dd>.xlsx`. No server or schema changes are needed.

### Lesson 201: Concurrent Knowledge Log Updates Can Block Merge Requests

- MR !4 conflicted only in `AGENTS.md`: the sales feature branch and `develop` both appended different lessons numbered 176 and 177 after Lesson 175 and updated the same next-lesson marker.
- Merge the latest `develop` into the feature branch, retain both lesson sets, and renumber the feature lessons after the existing target-branch lessons. Keep a single next-lesson marker. The sales route merges automatically, retaining the invoice filter, Excel export, and accent-insensitive search.

### Lesson 204: Debt Row Eye Button (Orders Behind a Debt) and Voucher Notes on `/finance`

- **Client request**: on the "Công nợ phải thu" and "Công nợ phải trả" tabs, each row gets an eye button at the end that lists the orders behind that debt; receipt and payment vouchers get an optional "Ghi chú" box.
- **Eye button** (`DebtOrdersDialog` in `src/routes/finance.tsx`): payables list the supplier's import batches (date, vehicle count, VAT-inclusive goods total, batch expenses; each links to `/batches/$batchId`) through `listSupplierBatchesFn`; receivables list the confirmed sales orders of that customer + receiving entity (`branchId` null = "Trực tiếp"; each links to `/sales/$orderId`) through `listReceivableOrdersFn`. Both need only `finance.view`, so a finance user who cannot open `/batches` still sees the list (the links need the target page's own permission). The Excel exports skip the eye column (it is an action column).
- **Notes**: `receipt_vouchers.note` varchar(255), nullable (migration `0051_receipt_note.sql`; **apply with `npm run migration:run`** or the receipt list fails). Payment vouchers already had `description`; only its label changed ("Nội Dung Chi"/"Nội Dung" -> "Ghi Chú"). Both are optional; the receipt list and the receipts / payments Excel exports gained/renamed the "Ghi Chú" column. This re-adds the note Lesson 32 removed from receipts.
- Opening "Lập Phiếu Thu" / "Lập Phiếu Chi" now clears the note box so an edited voucher's note never leaks into a new one.

### Lesson 205: Loan-Financed Batches Are Not a Supplier Debt

- **Client rule**: a batch with a loan contract selected is paid by the bank, so it adds nothing to what we owe the supplier. Only batches with **no loan** (`import_batches.loan_contract_id IS NULL`) count toward "Công nợ phải trả" (the "Không vay" option in `LoanSelect`).
- **Applied in 3 places that must stay equal**: `getPayablesSummary` (`reports.ts`: payables tab, dashboard, reports), `assertPaymentWithinDebt` (`services/finance.ts`: blocks a payment voucher above the remaining debt) and `listSupplierBatchesFn` (`fns/finance.ts`: the eye-button list on the payables tab). Change one and you must change the others. Batch lists, inventory value and "Tiền hàng" are unchanged (the goods are still ours).
- **Update (client review)**: the eye-button popup on the payables tab now lists **every** batch of the supplier (not only the no-loan ones) and has a "Khế Ước Vay" column: the contract number as a link to `/loans/$loanId`, or "Không vay". Only the debt totals (payables tab, payment limit) still skip loan-financed batches, so the popup's "Tiền Hàng" column can add up to more than the supplier's debt.
- **Effect on existing data**: changing a batch's loan in the batch editor immediately changes the supplier's debt; payments already recorded stay, so a supplier can show a negative balance (overpaid) if their batches were later linked to a loan.

_(Next Agent: Append Lesson 202, 203,... above this line upon completing tasks)_
















### Lesson 202: STT (Row Number) Column on Every Table (No Database ID Columns)

- **Rule**: Every list table has a first column headed `STT` (`<TableHead className="w-12 text-center">STT</TableHead>`) with a `text-center text-muted-foreground` cell. Raw database `ID` columns must not be displayed alongside `STT`.
- **Pagination**: For paginated tables the number continues across pages: `pg.pageSize * (pg.page - 1) + idx + 1`. Non-paginated tables use `idx + 1`.
- **Gotcha**: When adding a column, also bump `colSpan` on empty-state / inline edit rows (e.g. `renderEditingRow` in `loans.$loanId.tsx`).


### Lesson 203: List Page Excel Export (`src/lib/list-excel.ts`)

- **Scope**: `/batches`, `/inventory`, `/sales`, `/loans`, `/finance` (all 4 tabs: `receivables`, `payables`, `receipts`, `payments`), `/reconcile`, and `/customers` each provide an `Xuất Excel` button next to `Bộ lọc`.
- **Column Parity & Filter Fidelity**: Exported spreadsheets strictly mirror the visible table columns in the exact same order (starting with `STT`, omitting the trailing `Thao tác` action column) and export the currently filtered & sorted dataset (`sorted` / `filtered`).
- **Bundle Hygiene**: `src/lib/list-excel.ts` is dynamically imported on button click (`await import('#/lib/list-excel.ts')`) so `xlsx` stays out of initial page bundles.

### Lesson 204: "Giá Vốn" Between Revenue and Gross Profit (`/reports`)

- **Request**: after asking why gross profit was 23.682.728 ₫, the reviewer wanted "Giá Vốn" shown between "Tổng Doanh Thu" and "Lợi Nhuận Gộp", so Doanh Thu − Giá Vốn = Lợi Nhuận Gộp can be read straight off the page.
- **Cards** (`src/routes/reports.tsx`): a "Giá Vốn" card (`totalCost`) sits between the two. The grid is `sm:grid-cols-2 lg:grid-cols-6`: revenue, cost and profit take 2 columns each (one row on desktop), interest and stock value 3 each; on tablets the profit card spans the full row under revenue and cost (`sm:col-span-2`, which is also 2 of 6 on desktop). Subtitles state the VAT basis: revenue "Giá bán chưa VAT, phiếu bán đã xác nhận", cost "Giá nhập đã VAT + chi phí lô phân bổ".
- **Tables**: both revenue tables (by customer, by model) have a "Giá Vốn" column between "Doanh Thu" and "Lợi Nhuận" / "Lợi Nhuận Gộp". No server change: `getReports` already returned `cost` on every row.
- **Calculation (unchanged)**: revenue = `sales_order_items.price_before_vat` of confirmed orders dated in the range, whether or not the vehicles are delivered or invoiced; cost = `sales_order_items.cost_price` captured at sale (= `import_price_with_vat` + allocated batch expense, Lesson 165). Amounts are whole đồng (`priceWithVat`, `roundVnd`), so the displayed figures always add up. Revenue excludes VAT but cost includes the import VAT, which lowers the margin; taking VAT out of cost would be a business decision and has not been requested.

### Lesson 205: Every Date Box Shows dd/mm/yyyy (`DateInput`)

- **Request**: date boxes showed `11/04/2026` (month first) for 4 November; every date input must read day/month/year.
- **Cause**: a native `<input type="date">` is drawn in the browser's / Windows' locale; no `lang` attribute or CSS changes its order.
- **Fix** (`src/components/ui/date-input.tsx`): `DateInput` is a text box that shows `dd/mm/yyyy` (slashes are added while typing digits; `4/1/2026`, `04.01.2026`, `04012026` and a pasted `2026-01-04` are accepted; the text is tidied on blur) plus a calendar button that opens the browser's own picker (`showPicker()`, also Alt+ArrowDown) through a hidden native date input. `Input` renders it for every `type="date"`, so all 30 date boxes (12 files) changed without editing them, and any new `<Input type="date">` gets it too.
- **Contract, unchanged for callers**: `value` and `e.target.value` in `onChange` stay `yyyy-mm-dd`, and `''` while the text is empty or not a full date. The event is real: typed values go through the hidden date input (native value setter + `input` event), which also carries `name`, `min` and `max`. Layout classes in `className` (`w-*`, `flex-*`, margins, grid placement) go on the wrapper, the rest on the visible box.
- **Validation**: `required` sits on the visible box; `FieldValidationHost` treats `data-slot="date-input"` like a date ("Vui lòng chọn ngày"). An impossible date (31/02/2026) sets the custom validity "Ngày không hợp lệ, nhập theo dạng dd/mm/yyyy" and a red border on blur; `min` / `max` give "Ngày nằm ngoài khoảng cho phép".
- **Shared style**: the text-box classes moved to `src/components/ui/input-class.ts` (`INPUT_CLASS`), used by `Input` and `DateInput`, which avoids an import cycle between the two.

### Lesson 206: Report Cost Excludes VAT (supersedes the cost basis of Lesson 204)

- **Request** (reviewer): on `/reports` the "Giá Vốn" figure must use the import price **before** VAT, because revenue (`price_before_vat`) has no VAT either.
- **Fix** (`getReports` in `src/server/services/reports.ts`): each sold row's cost is `sales_order_items.cost_price − greatest(vehicles.import_price_with_vat − vehicles.import_price, 0)`, i.e. the cost captured at sale minus that vehicle's import VAT = import price before VAT + allocated batch expense. The cards, both tables (by customer, by model) and the margin all follow, and the card subtitle reads "Giá nhập chưa VAT + chi phí lô phân bổ".
- **Not changed**: `vehicles.cost_price` and the `cost_price` snapshot still include VAT (Lesson 165); batch pricing, the allocation ratio and the "Trị Giá Tồn Kho Thực Tế" card still use them. Only the report's cost / profit drop the VAT. `greatest(..., 0)` guards rows whose VAT-inclusive price was never filled.

### Lesson 207: `/reconcile` Table Needs a Fixed Width for the Description Column

- **Bug** (review screenshot): after the "Nội Dung Diễn Giải" column was added the header texts overlapped ("NỘI DUNG DIỄN TIỀN RA (GHI NỢ)"). The table is `table-fixed`; the other columns total 1024px, so with `min-w-[1080px]` the description column was left with ~56px.
- **Fix**: the description header is `w-[300px]` and the table `min-w-[1330px]` (1024 + 300). Rule for a `table-fixed` table: the fixed widths plus the flexible column's minimum must fit inside the table's `min-w`; when adding a column, raise `min-w` by its width.

### Lesson 208: "Giá Vốn" Column on the `/sales` List

- **Request**: the `/sales` list gets a "Giá Vốn" column (after "Tổng Tiền Đã VAT"), defined as import price **before VAT** + allocated batch expense, the same basis as the `/reports` cost (Lesson 206).
- **Server**: `listSalesOrdersFn` returns `totalCost` = `sum(sales_order_items.cost_price - greatest(vehicles.import_price_with_vat - vehicles.import_price, 0))` per order (the sale-time cost snapshot minus that vehicle's import VAT). The dashboard "Đơn Bán Gần Đây" uses the same function but does not show the column. The list's Excel export has the matching "Giá Vốn" column (with a total). The column is not sortable.
