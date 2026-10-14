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
| **01** | **System & Auth**            | `users`, `sessions`, `company_info`                                | `auth.ts`, `system.ts`                                                  | `/login`, `/settings`      | `AppLayout.tsx`, `useAuth.ts`, `avatar.tsx`      |
| **02** | **Master Data**              | `banks`, `company_bank_accounts`, `suppliers`, `motorcycle_models` | `master-data.ts`                                                        | `/master-data`             | `Tabs`, `Table`, `Dialog`                        |
| **03** | **Customers & Branches**     | `customers`, `pos_branches`                                        | `customers.ts`                                                          | `/customers`               | `Card`, `Badge`, `Dialog`                        |
| **04** | **Bank Loans**               | `loan_contracts`, `loan_repayments`                                | `finance.ts` (`listLoansFn`, `createLoanContractFn`)                    | `/loans`                   | `InterestTable`, `RepaymentModal`                |
| **05** | **Batch Imports & Costing**  | `import_batches`, `batch_expenses`, `vehicles`                     | `batches.ts` (`createBatchFn`, `listBatchesFn`)                         | `/batches`, `/batches/new` | `CostWarningAlert.tsx`, `Table`, `Select`        |
| **06** | **Dual Inventory**           | `vehicles`                                                         | `inventory.ts` (`getInventorySummaryFn`, `listVehiclesFn`)              | `/inventory`               | `DualInventoryBadge.tsx`, stock filter buttons   |
| **07** | **Sales & Dispatches**       | `sales_orders`, `sales_order_items`, `delivery_notes`, `invoices`  | `sales.ts` (`createSalesOrderFn`, `recordDeliveryFn`, `issueInvoiceFn`) | `/sales`, `/sales/new`     | `VehiclePicker`, `DeliveryModal`, `InvoiceModal` |
| **08** | **Accounts Receivable (AR)** | `accounts_receivable`, `receipt_vouchers`                          | `finance.ts` (`listReceivablesFn`, `createReceiptVoucherFn`)            | `/finance` (Tab 1 & 3)     | `ReceivableTable`, `ReceiptVoucherModal`         |
| **09** | **Accounts Payable (AP)**    | `accounts_payable`, `payment_vouchers`                             | `finance.ts` (`listPayablesFn`, `createPaymentVoucherFn`)               | `/finance` (Tab 2 & 4)     | `PayableTable`, `PaymentVoucherModal`            |
| **10** | **Bank Reconciliation**      | `bank_statements`, `bank_statement_lines`, `reconciliations`       | `finance.ts` (`reconcileLineFn`)                                        | `/reconcile`               | `StatementLinesTable`, auto-match suggestions    |
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
| **Apply Migrations**            | `npm run migration:run`                                       | Runs `src/db/migrate.ts` (drizzle-orm migrator, table `migrations`); prints progress and errors, auto-baselines a DB whose tables already exist |
| **Push Schema to Database**     | `npm run db:push`                                             | Pushes schema directly from `src/db/schema.ts`                       |
| **Run Migrations via Script**   | `npx tsx src/db/migrate.ts`                                   | Executes migration SQL statements safely via direct MySQL connection |
| **Seed Mock Data**              | `npm run seed` (or `npm run db:seed`)                         | Populates database with full realistic sample dataset                |
| **Open Drizzle Studio**         | `npm run db:studio`                                           | Launches web GUI for database tables inspection                      |
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
  - `reset.ts`: Resets all database tables cleanly in foreign-key safe order (`SET FOREIGN_KEY_CHECKS = 0/1`).
  - `company.ts`: Seeds corporate identity (`company_info`) for Truong Thinh Phat.
  - `users.ts`: Seeds system user accounts (`admin`, `accountant`, `sales`, `warehouse`) with bcrypt passwords.
  - `master-data.ts`: Seeds bank catalogs, company bank accounts, suppliers, motorcycle models, and colors.
  - `customers.ts`: Seeds B2B wholesale corporate customers and affiliated showroom POS branches.
  - `loans.ts`: Seeds bank credit contracts and principal/interest repayments.
  - `batches.ts`: Seeds import shipments, customs/freight expenses, and vehicles with automated cost allocation.
  - `sales.ts`: Seeds wholesale sales orders, delivery notes, and commercial invoices demonstrating all 3 dual inventory permutations.
  - `finance.ts`: Seeds cash receipt/disbursement vouchers and bank statements for transaction reconciliation.
  - `index.ts`: Orchestrates the sequential execution pipeline, closes MySQL connection pool gracefully (`db.$client.end()`), and outputs formatted login credentials.
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

_(Next Agent: Append Lesson 15, 16,... above this line upon completing tasks)_
