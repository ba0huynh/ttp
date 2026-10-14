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
| **03** | **Customers & Branches**     | `customers`, `pos_branches`                                        | `customers.ts`                                                          | `/customers`               | `Card`, `Badge`, `Dialog`                        |
| **04** | **Bank Loans**               | `loan_contracts`, `loan_repayments`                                | `finance.ts` (`listLoansFn`, `createLoanContractFn`)                    | `/loans`                   | `InterestTable`, `RepaymentModal`                |
| **05** | **Batch Imports & Costing**  | `import_batches`, `batch_expenses`, `vehicles`                     | `batches.ts` (`createBatchFn`, `updateBatchPricingFn`, `updateBatchInfoFn`, add/remove vehicle & expense) | `/batches`, `/batches/new`, `/batches/$batchId` | `CostWarningAlert.tsx`, `batches/BatchEditor.tsx` |
| **06** | **Dual Inventory**           | `vehicles`                                                         | `inventory.ts` (`getInventorySummaryFn`, `listVehiclesFn`)              | `/inventory`               | `DualInventoryBadge.tsx`, stock filter buttons   |
| **07** | **Sales & Dispatches**       | `sales_orders`, `sales_order_items`, `delivery_notes`, `invoices`  | `sales.ts` (`createSalesOrderFn`, `recordDeliveryFn`, `issueInvoiceFn`) | `/sales`, `/sales/new`     | `VehiclePicker`, `DeliveryModal`, `InvoiceModal` |
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

### Lesson 19: Nested Routes Need a Layout With an `<Outlet />` (`/batches`, `/sales`)

- **Symptom**: `/batches/new` and `/sales/new` showed the *list* page instead of the create page.
- **Cause**: `batches.tsx` held the list component, so `batches.new.tsx` became its child, but the list never rendered an `<Outlet />`.
- **Fix**: `batches.tsx` / `sales.tsx` are now thin layouts (`component: Outlet`); the lists moved to `batches.index.tsx` / `sales.index.tsx` (`createFileRoute('/batches/')`). Links to `/batches` still work. Without the layout file, `tsr generate` emitted a `getParentRoute` pointing at a route that did not exist.
- **Detail page**: the batch detail is now the page `/batches/$batchId` (`batches.$batchId.tsx`, editors in `src/components/batches/BatchEditor.tsx`), replacing the dialog. Do the same pattern for any new list → create → detail module.

---

### Lesson 20: Query Latency — Round Trips Are the Bottleneck (`/reports`)

- **Symptom**: `/reports` took ~5.5 s to load.
- **Cause**: the database is remote (~340 ms per round trip) and `getReports` plus its helpers (`getReceivablesSummary`, `getPayablesSummary`, `getInventorySummary`) awaited ~16 independent queries **one after another**. Query execution itself was trivial; 16 × 340 ms was the whole cost.
- **Fix** (`src/server/services/reports.ts`): independent queries now run with `Promise.all` (Drizzle query builders are lazy thenables, so build them first, then await them together), and the three revenue breakdowns (by customer / month / model) share **one** query over `sales_order_items` that is aggregated in memory. Result: ~5.3 s → ~0.6–1.5 s, and the output was verified identical to the old implementation for several date ranges. Full page load measured ~1.5 s.
- **Rule**: when adding a report or loader, count round trips, not query complexity. Don't `await` queries sequentially unless one depends on another's result. The pool holds up to 10 connections (mysql2 default), so batches of ~7–10 concurrent queries are fine; a brand-new connection costs ~1.3 s once, then stays warm.

---

### Lesson 21: Bank Catalog Seed (VietQR, live API)

- **What**: `banks` is seeded with the full VietQR list (75 Vietnamese banks: `code`, `name`, `shortName`), fetched **live** from `https://api.vietqr.io/v2/banks?d=YYYYMMDD` every time `npm run seed` runs. There is no saved copy of the list in the repo.
- **File**: `src/db/seed/bank.seed.ts` exports `seedBanks()` (called first by `seedMasterData()`) and `fetchVietQrBanks()` (20 s timeout; throws a clear error if the API is unreachable or the response is not `code: "00"`). **Seeding therefore needs internet access.**
- **Idempotent and additive**: only codes missing from `banks` are inserted; existing rows are never overwritten. This tops up databases that already had the original 3 banks (VCB, BIDV, TCB; their codes match VietQR's).
- **Behaviour change**: `seedMasterData()` used to skip everything when `banks` had rows. It now calls `seedBanks()` on every run and skips the rest (accounts, suppliers, models, colors) only when `company_bank_accounts` has rows.
- **Logo**: `banks.image` (varchar 500, nullable) stores the VietQR logo URL (migration `0001_curved_next_avengers.sql`). The seed fills it for new banks and backfills it for existing banks that have none; it never overwrites a non-empty value. **Apply the migration (`npm run migration:run`) before running the seed**, otherwise the insert fails with an unknown column `image`.
- **Not stored**: the API also returns `bin` and `swift_code`; the schema has no columns for them. `bin` would be needed to generate VietQR payment QR codes.

---

_(Next Agent: Append Lesson 22, 23,... above this line upon completing tasks)_
