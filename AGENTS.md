# AGENTS.MD — BỘ NHỚ HOẠT ĐỘNG & CẨM NANG KỸ THUẬT CỐT LÕI

> **DỰ ÁN**: PHẦN MỀM QUẢN LÝ XE MÁY TRƯỜNG THỊNH PHÁT  
> **CHỦ ĐẦU TƯ**: Công ty TNHH Kinh doanh Dịch vụ Trường Thịnh Phát (MST: `0316513248`)  
> **ĐƠN VỊ TƯ VẤN & GIẢI PHÁP**: CIT Group  
> **PHIÊN BẢN TÀI LIỆU**: 1.0.0 (Living Document)  
> **PHẠM VI**: Toàn bộ AI Agents, Developers và Kỹ sư tham gia phát triển dự án.

---

## 1. PROTOCOL BẮT BUỘC (MANDATORY AGENT INSTRUCTIONS)

Mọi AI Agent khi nhận bất kỳ tác vụ nào trong repository này **BẮT BUỘC** phải tuân thủ nghiêm ngặt các quy tắc sau:

1. **Đọc AGENTS.md đầu tiên**: Không tự ý phỏng đoán nghiệp vụ hoặc cấu trúc file. Phải kiểm tra bảng thuật ngữ (Glossary), quy tắc nghiệp vụ cốt lõi và bản đồ thư mục trong tài liệu này trước khi bắt đầu chỉnh sửa.
2. **Kiểm tra Type Check trước khi hoàn thành lượt (MANDATORY)**:
   - Mọi thay đổi code TypeScript/React phải vượt qua lệnh:
     ```bash
     npx tsc --noEmit
     ```
   - Tuyệt đối **không được** kết thúc lượt (turn) nếu `tsc --noEmit` còn báo lỗi đỏ.
3. **Tuân thủ quy ước Imports & Aliases**:
   - Sử dụng alias chuẩn đã cấu hình trong `tsconfig.json`:
     - `#/` hoặc `@/` trỏ tới `./src/*` (Ví dụ: `#/components/...`, `#/db/...`, `#/lib/...`).
   - Giữ nguyên `allowImportingTsExtensions: true` và `verbatimModuleSyntax: true` theo thiết lập tsconfig của dự án.
4. **Giao thức tự cập nhật bộ nhớ (Self-Updating Memory Protocol)**:
   - Khi hoàn thành một tính năng mới, giải quyết một bug khó, khám phá một đặc thù/gotcha kỹ thuật, hoặc thay đổi cấu trúc database/routes:
   - Agent **phải cập nhật ngay** thông tin đó vào **Mục 5: Living Knowledge Log (Bộ Nhớ Học Tập)** ở cuối tệp này trước khi bàn giao lại cho người dùng.

---

## 2. TỔNG QUAN DỰ ÁN & NGHIỆP VỤ CỐT LÕI (DOMAIN & BUSINESS RULES)

### 2.1. Bối cảnh & Mục tiêu Phần mềm

- **Khách hàng**: Công ty TNHH Kinh doanh Dịch vụ Trường Thịnh Phát (MST: 0316513248, Địa chỉ: 229 Lê Văn Sỹ, TP. Hồ Chí Minh).
- **Mô hình kinh doanh**: Nhập khẩu xe máy nguyên chiếc theo từng lô từ nước ngoài và bán sỉ (B2B wholesale) cho các khách hàng doanh nghiệp, đại lý và chuỗi cửa hàng xe máy.
- **Hiện trạng trước đây**: Quản lý thủ công bằng nhiều file Excel rời rạc giữa các nhân viên, dẫn đến số liệu tồn kho, công nợ và dòng tiền bị lệch pha nghiêm trọng.
- **Định vị hệ thống**:
  - Là **Web App Quản trị Nội bộ (Internal Operation System)** tinh gọn, tập trung vào việc ghi nhận, quản lý và tra cứu số liệu chuẩn xác.
  - **KHÔNG PHẢI ERP CHUYÊN SÂU**: Không yêu cầu hạch toán kế toán kép phức tạp, không tính giá thành đa công đoạn sản xuất, không tích hợp xuất hóa đơn điện tử tự động ra ngoài (chỉ quản lý hóa đơn chứng từ nội bộ).

---

### 2.2. Các Quy Tắc Nghiệp Vụ Cốt Lõi Cần Làm Đúng (KHÔNG ĐƯỢC SAI)

_(Trích xuất từ tài liệu tóm tắt yêu cầu nghiệp vụ của CIT Group — Sai phần này sẽ dẫn đến sai lệch số liệu tài chính toàn công ty)_:

1. **Khế ước vay ngân hàng & Nhập lô**:
   - Công ty vay vốn ngân hàng thương mại theo từng khế ước cụ thể để tài trợ thanh toán cho từng lô xe nhập khẩu.
   - Khi hàng cập cảng/kho, nhân viên tạo một **Lô nhập (Import Batch)**.
   - Khi nhập lô, nhân viên nhập danh sách từng xe (Số khung, Số máy, Dòng xe, Màu sắc, Đơn giá nhập) kèm các khoản chi phí của lô (Thuế nhập khẩu, chi phí vận chuyển quốc tế & nội địa, phí hải quan, chi phí khác).
   - **Quy tắc kho nhập**: _Nhập lô xong là toàn bộ xe trong lô đã nằm trong kho_, không có quy trình/bước tạo phiếu nhập kho riêng rẽ.

2. **Công thức tính Giá Vốn (Cost Price) của từng chiếc xe**:
   - Chi phí nhập của cả lô được phân bổ tự động vào từng chiếc xe theo **tỉ trọng đơn giá nhập** của xe đó so với tổng giá trị tiền hàng của lô:
     $$\text{Chi phí phân bổ cho xe } i = \text{Tổng chi phí lô} \times \frac{\text{Đơn giá nhập xe } i}{\sum \text{Đơn giá nhập tất cả xe trong lô}}$$
     $$\text{Giá vốn xe } i = \text{Đơn giá nhập xe } i + \text{Chi phí phân bổ cho xe } i$$

3. **Cài đặt Giá Bán & Cảnh Báo Bán Lỗ**:
   - **Giá bán được cài theo LÔ**, không cài riêng cho từng chiếc xe lẻ.
   - Công thức giá bán lô: $\text{Gốc tính} + \% \text{ lợi nhuận}$ hoặc $\text{Gốc tính} + \text{Số tiền cộng thêm cố định}$.
   - Gốc tính có thể cấu hình linh hoạt: dựa trên _Đơn giá nhập_ hoặc _Giá vốn_.
   - **CẢNH BÁO BẮT BUỘC**: Do chi phí nhập khẩu (thuế, logistics) chiếm tỉ trọng rất lớn, nếu người dùng cài % dựa trên đơn giá nhập có thể dẫn đến việc giá bán thấp hơn giá vốn thực tế. **Hệ thống bắt buộc phải hiển thị cảnh báo đỏ khi Giá bán < Giá vốn**.

4. **Cơ Chế KHO KÉP ĐỘC LẬP (2 Kho Song Song trên mỗi xe)**:
   - Trong kinh doanh xe sỉ, việc **Giao xe vật lý** và việc **Xuất hóa đơn tài chính** diễn ra hoàn toàn độc lập theo thỏa thuận với đại lý:
     - **Tồn thực tế (Physical Inventory)**: Giảm khi nhân viên thực hiện thao tác _Giao xe thực tế_ (`is_delivered = true`).
     - **Tồn theo hóa đơn (Invoiced Inventory)**: Giảm khi kế toán thực hiện thao tác _Xuất hóa đơn nội bộ_ (`is_invoiced = true`).
   - Hai cờ này là **hai cờ độc lập**, không được suy diễn cờ này từ cờ kia!
   - _Ví dụ thực tế_: Một xe đã xuất hóa đơn cho khách để họ làm thủ tục đăng kiểm/vay vốn nhưng xe vẫn đang gửi tại kho công ty chờ xe tải tới chở -> Xe đã ra khỏi kho hóa đơn nhưng vẫn còn nằm trong kho thực tế. **Đây là tình trạng nghiệp vụ bình thường, TUYỆT ĐỐI KHÔNG ĐƯỢC COI LÀ LỖI**.

5. **Quy tắc Duy nhất của Số Khung (VIN)**:
   - Một chiếc xe (định danh bằng Số khung - Chassis Number / VIN) **chỉ được phép bán đúng một lần**. Hệ thống phải chặn xuất trùng, bán trùng tuyệt đối ở cả tầng Database constraint và Application logic.

6. **Công thức Lãi Vay Ngân Hàng**:
   - Lãi vay ngân hàng tính theo **dư nợ giảm dần**.
   - Quy ước tính lãi: **365 ngày/năm**.
   - Chia đoạn tính lãi chính xác theo từng lần trả nợ gốc thực tế.

7. **Khách hàng Mẹ & Điểm bán Trực thuộc (Chi nhánh/Showroom)**:
   - Khách hàng doanh nghiệp có thể có một Công ty Mẹ (Headquarter) và nhiều Điểm bán trực thuộc (Showroom/Branch).
   - **Quy tắc phân bổ số liệu**:
     - **Doanh thu bán hàng**: Quy về Khách hàng Mẹ để theo dõi quy mô và chính sách chiết khấu.
     - **Công nợ & Hóa đơn**: Ghi nhận trực tiếp theo Pháp nhân của Điểm bán nhận xe.

8. **Sao kê Ngân Hàng & Đối chiếu**:
   - Nhập sao kê ngân hàng định kỳ để đối soát chéo (reconcile) các khoản khách hàng chuyển khoản trả nợ (Công nợ phải thu) và các khoản công ty chi trả nhà cung cấp / ngân hàng (Công nợ phải trả & Trả nợ vay).

---

### 2.3. Bảng Quy Chuẩn Thuật Ngữ (Glossary)

Để tránh xung đột tên gọi giữa các Agent, hãy dùng thống nhất bảng thuật ngữ sau trong Database, Code TypeScript và UI:

| Thuật ngữ Tiếng Anh (Code / Entity) | Thuật ngữ Tiếng Việt (UI / Business) | Định nghĩa & Ghi chú kỹ thuật                                |
| ----------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| `import_batches` / `Batch`          | Lô nhập xe                           | Một đợt nhập khẩu xe gồm nhiều xe và các khoản chi phí lô    |
| `vehicles` / `Motorcycle`           | Xe máy / Chiếc xe                    | Một chiếc xe cụ thể trong lô (1 dòng = 1 xe đơn lẻ)          |
| `chassis_number` / `vin`            | Số khung                             | Chuỗi ký tự duy nhất định danh xe (`UNIQUE` trong DB)        |
| `engine_number`                     | Số máy                               | Chuỗi ký tự số máy của xe                                    |
| `motorcycle_models` / `Model`       | Dòng xe / Loại xe                    | Phân loại dòng xe (ví dụ: SH 150i, Wave Alpha, Vision,...)   |
| `color`                             | Màu xe                               | Màu sắc của xe (Đỏ, Trắng, Đen, Xám xi măng,...)             |
| `import_price`                      | Đơn giá nhập                         | Giá mua xe nguyên bản từ nhà cung cấp (VNĐ/ngoại tệ quy đổi) |
| `batch_expenses` / `Expense`        | Chi phí lô xe                        | Thuế nhập khẩu, phí vận chuyển, hải quan, lưu kho,...        |
| `allocated_expense`                 | Chi phí phân bổ                      | Chi phí lô được bổ đầu xe theo tỉ trọng giá trị              |
| `cost_price`                        | Giá vốn xe                           | `= import_price + allocated_expense`                         |
| `selling_price`                     | Giá bán xe                           | Giá áp dụng cho cả lô xe (cảnh báo nếu < `cost_price`)       |
| `is_delivered`                      | Đã giao xe (Kho thực tế)             | Boolean: `true` nếu xe đã xuất kho vật lý giao cho khách     |
| `is_invoiced`                       | Đã xuất hóa đơn (Kho hóa đơn)        | Boolean: `true` nếu xe đã được lập hóa đơn chứng từ          |
| `sales_orders` / `Order`            | Phiếu bán xe                         | Đơn bán xe sỉ cho khách hàng (chọn các xe cụ thể)            |
| `delivery_notes`                    | Phiếu giao xe                        | Ghi nhận thời điểm xe rời kho vật lý                         |
| `invoices`                          | Hóa đơn xuất bán                     | Hóa đơn thương mại nội bộ ghi nhận giảm kho hóa đơn          |
| `parent_customer`                   | Khách hàng mẹ                        | Doanh nghiệp đối tác ký hợp đồng khung                       |
| `pos_branches` / `Branch`           | Điểm bán trực thuộc                  | Cửa hàng/đại lý con trực tiếp nhận xe và chịu công nợ        |
| `bank_loans` / `LoanContract`       | Khế ước vay ngân hàng                | Hợp đồng tín dụng ngân hàng tài trợ mua lô xe                |
| `loan_repayments`                   | Khoản trả ngân hàng                  | Thanh toán nợ gốc hoặc lãi theo khế ước vay                  |
| `accounts_receivable` (AR)          | Công nợ phải thu                     | Theo dõi tiền khách hàng/điểm bán còn nợ                     |
| `accounts_payable` (AP)             | Công nợ phải trả                     | Theo dõi tiền còn nợ nhà cung cấp lô xe                      |
| `receipt_vouchers`                  | Phiếu thu                            | Phiếu thu tiền khách thanh toán công nợ                      |
| `payment_vouchers`                  | Phiếu chi                            | Phiếu chi tiền trả nhà cung cấp hoặc chi phí vận hành        |
| `bank_statements`                   | Sao kê ngân hàng                     | Danh sách giao dịch tài khoản dùng để đối chiếu              |

---

## 3. BẢN ĐỒ CẤU TRÚC FILE & TÍNH NĂNG (FEATURE & ARCHITECTURE MAP)

Hệ thống được thiết kế gồm **11 Modules nghiệp vụ cốt lõi**. Bảng sau đây ánh xạ chính xác từ Nghiệp vụ -> Database Entity -> Backend Server Functions -> UI Route/Component:

| #      | Phân hệ / Nghiệp vụ        | Database Entity (`src/db/schema.ts`)                               | Server Functions / API (`src/routes/api/` hoặc Server Fn)               | Giao diện / Routes (`src/routes/`)                                                      | Components & Hooks (`src/components/`)                                   |
| ------ | -------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **01** | **Tài khoản & Hệ thống**   | `users`, `sessions`, `company_info`                                | `auth.ts`, `getCompanyProfile()`, `updateCompanyProfile()`              | `/login`, `/admin/settings`, `/admin/users`                                             | `UserNav.tsx`, `CompanySettingsForm.tsx`, `useAuth.ts`                   |
| **02** | **Danh mục Master Data**   | `banks`, `company_bank_accounts`, `suppliers`, `motorcycle_models` | `getBanks()`, `getSuppliers()`, `getModels()`                           | `/admin/master-data/banks`, `/admin/master-data/suppliers`, `/admin/master-data/models` | `BankTable.tsx`, `SupplierDialog.tsx`, `ModelSelect.tsx`                 |
| **03** | **Khách hàng & Điểm bán**  | `customers`, `pos_branches`                                        | `getCustomers()`, `getCustomerBranches()`, `createCustomer()`           | `/admin/customers`, `/admin/customers/$id`                                              | `CustomerList.tsx`, `BranchManager.tsx`, `CustomerDebtSummary.tsx`       |
| **04** | **Khoản vay ngân hàng**    | `loan_contracts`, `loan_repayments`                                | `getLoanContracts()`, `recordLoanPayment()`, `calculateInterest()`      | `/admin/loans`, `/admin/loans/$id`, `/admin/loans/new`                                  | `LoanContractCard.tsx`, `InterestCalculator.tsx`, `LoanPaymentModal.tsx` |
| **05** | **Nhập kho & Lô hàng**     | `import_batches`, `batch_expenses`, `vehicles`                     | `createBatch()`, `allocateExpenses()`, `setBatchPricing()`              | `/admin/batches`, `/admin/batches/new`, `/admin/batches/$id`                            | `BatchForm.tsx`, `VehicleImportGrid.tsx`, `CostAllocationView.tsx`       |
| **06** | **Kho xe (2 Kho Độc Lập)** | `vehicles` (view `physical_inventory`, `invoiced_inventory`)       | `getPhysicalInventory()`, `getInvoicedInventory()`, `dispatchVehicle()` | `/admin/inventory/physical`, `/admin/inventory/invoiced`, `/admin/inventory/vehicles`   | `DualInventoryBadge.tsx`, `VehicleFilter.tsx`, `StockTransferDialog.tsx` |
| **07** | **Bán hàng & Xuất xe**     | `sales_orders`, `sales_order_items`, `delivery_notes`, `invoices`  | `createSalesOrder()`, `markDelivered()`, `markInvoiced()`               | `/admin/sales`, `/admin/sales/new`, `/admin/sales/$id`                                  | `OrderBuilder.tsx`, `VehiclePickerModal.tsx`, `DeliveryAction.tsx`       |
| **08** | **Công nợ phải thu (AR)**  | `accounts_receivable`, `receipt_vouchers`                          | `getReceivables()`, `createReceiptVoucher()`, `getCustomerStatement()`  | `/admin/finance/receivables`, `/admin/finance/receipts`                                 | `ReceivableTable.tsx`, `ReceiptVoucherModal.tsx`, `DebtAgeBadge.tsx`     |
| **09** | **Công nợ phải trả (AP)**  | `accounts_payable`, `payment_vouchers`                             | `getPayables()`, `createPaymentVoucher()`, `getSupplierStatement()`     | `/admin/finance/payables`, `/admin/finance/payments`                                    | `PayableTable.tsx`, `PaymentVoucherModal.tsx`                            |
| **10** | **Sao kê ngân hàng**       | `bank_statements`, `reconciliations`                               | `importBankStatement()`, `reconcileTransaction()`                       | `/admin/finance/bank-statements`, `/admin/finance/reconcile`                            | `StatementUploader.tsx`, `ReconciliationMatcher.tsx`                     |
| **11** | **Báo cáo & Phân tích**    | Báo cáo tính toán từ các bảng trên                                 | `getRevenueReport()`, `getProfitReport()`, `getInventoryValuation()`    | `/admin/reports/revenue`, `/admin/reports/profit`, `/admin/reports/inventory`           | `ReportFilterBar.tsx`, `RevenueChart.tsx`, `ProfitSummaryCard.tsx`       |

---

## 4. TECH STACK & QUY CHUẨN LỆNH (COMMANDS & QUALITY STANDARDS)

### 4.1. Danh Sách Công Nghệ (Tech Stack)

- **Runtime Environment**: Node.js (>= 20.x) hoặc Bun (>= 1.2.x).
- **Package Manager**: `npm` / `pnpm` / `bun` (Đồng bộ qua lockfile).
- **Core Fullstack Framework**: **TanStack Start** (v1.169+) kết hợp **Vite 8** và **Nitro 3 Server Engine**.
- **Frontend & React**: **React 19** (v19.2+) + Compiler Babel Plugin (`babel-plugin-react-compiler`).
- **Routing**: **TanStack Router** (File-based routing tại `src/routes/`, tự sinh route tree tại `src/routeTree.gen.ts`).
- **Database**: **MySQL 8.x** kết hợp driver `mysql2`.
- **ORM & Migrations**: **Drizzle ORM** (v0.45+) & **Drizzle Kit** (v0.31+).
- **State Management & Caching**: **TanStack Query** (v5.104+) + SSR Query Integration.
- **Styling & Design System**: **Tailwind CSS v4** (`@tailwindcss/vite`), `tw-animate-css`, `class-variance-authority`, `clsx`, `tailwind-merge`.
- **UI Components**: **Shadcn UI** (New York style, Radix UI Primitives, Lucide Icons).
- **Type Safety & Env**: TypeScript 6 (Strict mode), **Zod v4**, `@t3-oss/env-core`.
- **Đa ngôn ngữ (i18n)**: **Paraglide JS** (`@inlang/paraglide-js`).

---

### 4.2. Bộ Lệnh Chuẩn & Kiểm Tra Chất Lượng (Quality Standards)

| Mục đích                            | Câu lệnh thực thi                                             | Ghi chú cho Agent                                                               |
| ----------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Chạy Development Server**         | `npm run dev` (hoặc `bun run dev`)                            | Mở cổng `http://localhost:3000`                                                 |
| **Sinh Route Tree tự động**         | `npm run generate-routes`                                     | Chạy lệnh này nếu thêm mới tệp trong `src/routes/`                              |
| **Biên dịch i18n (Paraglide)**      | `npx @inlang/paraglide-js compile --project ./project.inlang` | Cần chạy nếu sửa file trong `messages/` hoặc khi thiếu module `#/paraglide`     |
| **BẮT BUỘC: Type Check**            | `npx tsc --noEmit` (hoặc `bun x tsc --noEmit`)                | **Agent phải chạy lệnh này và đạt 0 lỗi trước khi hoàn thành bất kỳ task nào!** |
| **Linter / Formatter**              | `npm run format` & `npm run lint`                             | Chạy Prettier và ESLint sửa lỗi tự động                                         |
| **Kiểm tra code style**             | `npm run check`                                               | Prettier dry-run check                                                          |
| **Tạo Drizzle Migration**           | `npm run db:generate`                                         | Sinh file SQL migration trong thư mục `./drizzle`                               |
| **Đẩy trực tiếp Schema lên DB**     | `npm run db:push`                                             | Áp dụng thay đổi từ `src/db/schema.ts` vào DB nhanh (Dev mode)                  |
| **Chạy Drizzle Studio (Web UI DB)** | `npm run db:studio`                                           | Mở giao diện xem trực quan bảng biểu dữ liệu Drizzle                            |
| **Build Production**                | `npm run build`                                               | Kiểm tra khả năng build trơn tru cho deploy Nitro                               |

---

## 5. BỘ NHỚ HỌC TẬP LIÊN TỤC (LIVING KNOWLEDGE LOG & LESSONS LEARNED)

_Khu vực này ghi lại các bài học kiến trúc, lỗi thường gặp (gotchas) và cách giải quyết trong codebase này. Mọi Agent sau khi hoàn thành task hoặc fix bug khó ĐỀU PHẢI BỔ SUNG BÀI HỌC MỚI VÀO ĐÂY._

### Bài học 1: Type Checking & Khởi tạo Paraglide Runtime

- **Triệu chứng**: Khi chạy `npx tsc --noEmit` lần đầu trên máy mới hoặc sau khi clone git, TypeScript sẽ báo lỗi: `Cannot find module '#/paraglide/runtime' or its corresponding type declarations`.
- **Nguyên nhân**: Module Paraglide được tạo động qua Vite plugin lúc dev hoặc thông qua CLI của Inlang.
- **Cách xử lý**: Chạy lệnh `npx @inlang/paraglide-js compile --project ./project.inlang` để sinh thư mục `./src/paraglide/` trước khi chạy `tsc`.

### Bài học 2: Drizzle Config & Biến Môi Trường DATABASE_URL

- **Triệu chứng**: `drizzle.config.ts` báo lỗi TypeScript: `Type 'string | undefined' is not assignable to type 'string'`.
- **Nguyên nhân**: `process.env.DATABASE_URL` có thể trả về `undefined` theo định nghĩa kiểu của Node.js env.
- **Cách xử lý**: Luôn sử dụng Non-null assertion operator `process.env.DATABASE_URL!` trong `drizzle.config.ts` hoặc fallback về chuỗi rỗng có kiểm tra guard.

### Bài học 3: Thiết Kế Kho Kép (Dual Inventory Model) trong Drizzle Schema

- **Triệu chứng**: Không được thiết kế một cột trạng thái xe dạng `status: 'in_stock' | 'sold'` đơn giản như các shop thương mại điện tử thông thường.
- **Nguyên nhân cốt lõi**: Công ty Trường Thịnh Phát có 2 nghiệp vụ độc lập: giao xe thực tế và xuất hóa đơn nội bộ. Một chiếc xe có thể đã xuất hóa đơn nhưng chưa giao, hoặc đã giao nhưng chưa xuất hóa đơn.
- **Cách thiết lập chuẩn**:
  - Trong bảng `vehicles`, bắt buộc phải có ít nhất 2 trường cờ độc lập:
    - `is_delivered: boolean('is_delivered').default(false).notNull()`
    - `is_invoiced: boolean('is_invoiced').default(false).notNull()`
  - Hoặc quản lý qua 2 liên kết khóa ngoại / bảng sự kiện giao xe và xuất hóa đơn riêng rẽ.

### Bài học 4: Ràng Buộc Đơn Nhất Cho Số Khung (Chassis Number / VIN)

- **Triệu chứng**: Nguy cơ nhân viên chọn nhầm xe hoặc xuất 1 chiếc xe cho 2 đơn hàng sỉ khác nhau.
- **Cách xử lý**:
  - Khai báo trường `chassisNumber: varchar('chassis_number', { length: 50 }).notNull().unique()`.
  - Khi tạo phiếu bán hàng (`sales_order_items`), phải có validate kiểm tra xe đó đã tồn tại trong bất kỳ order nào ở trạng thái active chưa, và chặn ngay lập tức nếu đã được gán.

### Bài học 6: Tuân Thủ TypeScript Strictness (`noUnusedLocals` & `noUnusedParameters`)

- **Triệu chứng**: `npx tsc --noEmit` báo lỗi `TS6133` hoặc `TS6192` (unused variable / unused import) sau khi tạo route mới hoặc copy template Shadcn UI.
- **Nguyên nhân**: `tsconfig.json` bật strict rules. Bất kỳ icon Lucide hoặc biến hook nào chưa dùng tới đều bị trình biên dịch coi là lỗi nghiêm trọng làm gián đoạn CI/CD.
- **Cách xử lý**: Luôn kiểm tra kỹ các import icon, import component và dọn dẹp sạch sẽ trước khi kết thúc turn. Nếu loader trả về dữ liệu cho route, chỉ trích xuất các biến thực sự được render trong JSX.

### Bài học 7: Kiến Trúc Tính Toán Nghiệp Vụ Tài Chính Thuần Túy (`src/lib/business.ts`)

- **Mục tiêu**: Đảm bảo công thức phân bổ chi phí lô xe theo tỉ trọng, công thức tính lãi vay ngân hàng 365 ngày trên dư nợ giảm dần, và kiểm tra bán lỗ (`selling_price < cost_price`) đồng nhất 100% giữa Server và Client.
- **Cách xử lý**: Gom toàn bộ logic tài chính thuần túy vào `src/lib/business.ts` không phụ thuộc vào database driver hay Node.js APIs. Cả UI components (như `CostWarningAlert`, `batches.new.tsx`) lẫn Server Functions/Services đều import chung một nguồn logic duy nhất.

### Bài học 8: Thiết Lập Seed Data Thực Tế (`npm run db:seed`)

- **Đặc thù**: Dữ liệu seed phải phản ánh chân thực đầy đủ 4 trường hợp của kho kép (Xe còn tồn cả 2 kho; Xe đã giao nhưng chưa xuất HĐ; Xe đã xuất HĐ nhưng chưa giao; Xe đã hoàn tất cả 2 kho) cùng khế ước vay ngân hàng phân kỳ trả nợ.
- **Cách thực thi**: Lệnh `npm run db:seed` được cấu hình qua `tsx src/db/seed.ts`, sẵn sàng bơm dữ liệu kiểm thử hoàn chỉnh ngay khi database MySQL được kết nối.

---

_(Agent tiếp theo khi hoàn thành tính năng hãy thêm Bài học 9, 10,... vào phía trên dòng này)_
