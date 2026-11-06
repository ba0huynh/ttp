---
name: qa-bug-log-tracker
description: "Guide for interpreting QA bug logs, client spreadsheet feedback, and Lightshot/prnt.sc screenshots. Explains how to parse the dual-cell bug format: Left cell (Bug / feedback current description, prnt.sc link, [Bug] pill tag) vs. Right cell (Desired fix / outcome), and step-by-step fix procedures."
---

# QA Bug Log & Client Feedback Interpretation Guide

This skill teaches AI agents how to read, interpret, and resolve bug reports submitted via the client's QA spreadsheet / bug tracker.

---

## 1. Spreadsheet Layout & Anatomy

The client/QA team tracks bugs using a structured spreadsheet with screenshot attachments and status pills:

```
+-----------+-----------------------------------+-------+-------------------------------------------------------------+
| Module    | Bug / Feedback Current Desc (Left)| Tag   | Desired Fix / Outcome (Right)                               |
+-----------+-----------------------------------+-------+-------------------------------------------------------------+
| CMS       | https://prnt.sc/Wm_H7UODN9AZ      | [Bug] | trường mã số thuế chỉ cho nhập số thôi chặn kí tự và chữ cái|
| CMS       | https://prnt.sc/wlky7le99CuL      | [Bug] | nhập email sai định dạng không hiển thị lỗi                 |
+-----------+-----------------------------------+-------+-------------------------------------------------------------+
```

### Column Definitions

1. **Module / Scope (Far Left)**:
   - Tags like `CMS`, `Kho xe`, `Bán hàng`, `Tài chính`, `Khế ước`.
   - Identifies which system module is affected (e.g., `CMS` = System / Settings / Master Data).

2. **Left Square: Bug / Feedback Current Description**:
   - Contains a link (commonly `https://prnt.sc/...` Lightshot screenshot) or text demonstrating the **current buggy behavior** or reproduction state.
   - Contains a status pill such as **`[Bug]`** (red pill) or **`[Feedback]`** (yellow/blue pill).
   - In the screenshot: look for URL bar, active tabs, red bounding boxes, invalid input values (e.g. `4566455553ggg@@` in a tax code input).

3. **Right Square: Desired Fix / Outcome**:
   - Written in Vietnamese describing the **exact requirement or expected outcome**.
   - Examples:
     - `trường mã số thuế chỉ cho nhập số thôi chặn kí tự và chữ cái` -> Tax code input must strictly allow numbers only; block all letters and special characters.
     - `nhập email sai định dạng không hiển thị lỗi` -> If an email is improperly formatted, an explicit error must be shown.

---

## 2. Standard Bug Resolution Workflow for Agents

When receiving an image or report from this bug log, follow these steps:

### Step 1: Decode the Location & Target Field
- Open the Lightshot URL or inspect the attached screenshot from the left column.
- Note the URL path (e.g., `/settings?tab=company`, `/batches/new`, `/sales/1`).
- Locate the highlighted UI component in `src/routes/` or `src/components/`.

### Step 2: Extract the Desired Fix
- Read the right-hand column text carefully.
- Translate Vietnamese domain directives into technical requirements:
  - `"chỉ cho nhập số thôi chặn kí tự và chữ cái"` -> Client-side: `.replace(/\D/g, '')`, `inputMode="numeric"`, `pattern="[0-9]*"`; Server-side: `z.string().regex(/^\d+$/)`.
  - `"sai định dạng không hiển thị lỗi"` -> Ensure client inline error or toast/modal displays validation error cleanly.

### Step 3: Implement Dual-Layer Protection
1. **Frontend / Client-Side UX**:
   - Sanitize inputs on `onChange` to prevent illegal characters from ever being typed or pasted.
   - Provide visual feedback / validation messages before form submission.
2. **Backend / Server-Side Validation**:
   - Update Zod validators in `src/server/fns/` to strictly reject invalid payloads even if bypassed via API.

### Step 4: Verification & Quality Gate
- Run `npx tsc --noEmit` and ensure **0 errors**.
- Test edge cases (paste invalid string, type letters, empty string, boundary limits).

### Step 5: Update Operational Memory
- Per `AGENTS.md` Rule 5, record the bug fix and lesson into **Section 5: Living Knowledge Log & Lessons Learned**.

---

## 3. Reference Bug Catalog

| Date | Module | Field / Issue | Left Cell (Reproduction) | Right Cell (Desired Fix) | Resolution Summary |
|---|---|---|---|---|---|
| 2026-11-03 | CMS | Mã số thuế (Company Tax Code) | `https://prnt.sc/Wm_H7UODN9AZ` (`4566455553ggg@@`) | trường mã số thuế chỉ cho nhập số thôi chặn kí tự và chữ cái | Restricted input in `/settings` to digits only (`\D` filter) and added server regex `^\d+$` in `system.ts`. |
| 2026-11-03 | CMS | Email liên hệ (Company Email) | `https://prnt.sc/wJkVla98GuoJ` (`ac`) | nhập email sai định dạng không hiển thị lỗi | Added email format validation with clear error messages in both client and server schema. |
| 2026-11-03 | CMS | Số điện thoại (Company Phone) | `https://prnt.sc/cUv7_DLRf_6T` (`0nfj@`) | chỉ cho nhập số | Restricted phone input in `/settings` to digits only (`\D` filter) and added server regex `^\d+$` in `system.ts`. |
| 2026-11-03 | CMS | Dòng xe máy (Motorcycle Models) | `https://prnt.sc/mc8r8PhxXcq9` | không cho tạo/sửa trùng dòng xe | Prevented creating/updating duplicate motorcycle model names in `src/routes/master-data.tsx` and `src/server/fns/master-data.ts`. |
| 2026-11-03 | CMS | Dòng xe (Master Data Error Dialog) | `https://prnt.sc/4JWleo4_p3Jn` (`Tên: Too small: expected string to have >=1 characters`) | Hiển thị thông báo tiếng Việt rõ ràng khi để trống tên | Updated `formatErrorMessage` for Zod v4 `origin: 'string'`, added custom Vietnamese messages to Zod schemas, and enforced client-side trimmed validation. |
| 2026-11-03 | CMS | Dòng xe (Model List Ordering) | `https://prnt.sc/QziXEt82HkZR` [Feedback] | hiển thị dòng xe vừa tạo lên đầu danh sách | Changed `motorcycleModels` order in `getMasterDataFn` to `desc(motorcycleModels.id)` so the newest created model appears at the top. |
| 2026-11-03 | CMS | Nhà cung cấp (Whitespace Validation Message) | `https://prnt.sc/eQD-UeDakgJ3` [Feedback] | việt hóa message lỗi khi nhập khoảng trắng | Localized error message to "Không được để trống hoặc chỉ chứa khoảng trắng" across `formatErrorMessage`, Zod schema validators, and client-side modal checks. |
| 2026-11-03 | CMS | Nhà cung cấp (Supplier List Ordering) | `https://prnt.sc/uESx1QE5pZfo` [Feedback] | hiển thị NCC vừa tạo lên đầu danh sách | Changed `suppliers` order in `getMasterDataFn` to `desc(suppliers.id)` so the newest created supplier appears at the top. |
| 2026-11-03 | CMS | Ngân hàng (Bank List Ordering) | `https://prnt.sc/YGi0NgUeANj5` [Feedback] | hiển thị ngân hàng vừa tạo lên đầu danh sách | Changed `banks` order in `getMasterDataFn` to `desc(banks.id)` so the newest created bank appears at the top. |
| 2026-11-03 | CMS | Ngân hàng (Bank Whitespace Message) | `https://prnt.sc/x4cXxIADw2li` [Feedback] | việt hóa message lỗi khi nhập khoảng trắng | Validated bank name against whitespace and localized error to "Không được để trống hoặc chỉ chứa khoảng trắng". |
| 2026-11-03 | CMS | Ngân hàng (Duplicate Bank Prevention) | `https://prnt.sc/z1bLMJX3yOcx`, `https://prnt.sc/s4bkMLY7x9sp` | không cho tạo/sửa trùng ngân hàng | Added duplicate bank check (case-insensitive) both client-side and server-side. |
| 2026-11-03 | CMS | Ngân hàng (Search Box Placeholder) | `https://prnt.sc/-wak8m1K3G5P` [Feedback] | đổi placeholder thành "Tìm tên ngân hàng" | Changed placeholder from verbose truncated text to concise `"Tìm tên ngân hàng..."`. |
| 2026-11-03 | CMS | Tài khoản ngân hàng (Account Number Format) | `https://prnt.sc/aeN-bSb9HlAi` (`HHH@@`) | số tài khoản chỉ nhập số thôi chặn kí tự và chữ cái | Restricted account number to digits only (`\D` filter) on input, added client-side `^\d+$` check and server-side Zod regex validator. |
| 2026-11-03 | CMS | Tài khoản ngân hàng (Account List Ordering) | `https://prnt.sc/dfT2vJ7nxmnr` [Feedback] | hiển thị tài khoản ngân hàng vừa tạo lên đầu danh sách | Changed `companyBankAccounts` order in `getMasterDataFn` to `desc(companyBankAccounts.id)` so newest created accounts appear at the top. |
| 2026-11-03 | CMS | Màu sắc (Color List Ordering) | `https://prnt.sc/7kWP1_XMkwDv` [Feedback] | hiển thị màu sắc vừa tạo lên đầu danh sách | Changed `colors` order in `getMasterDataFn` to `desc(colors.id)` so the newest created color appears at the top. |
| 2026-11-03 | CMS | Màu sắc (Duplicate Color Prevention) | `https://prnt.sc/NM8gbi3dVNlu` | không cho tạo/sửa trùng màu sắc | Added duplicate color check (case-insensitive) both client-side in `handleSaveColor` and server-side in `saveColorFn`. |
| 2026-11-03 | CMS | Loại chi phí (Expense Type List Ordering) | `https://prnt.sc/bO_xEaKCmPXQ` [Feedback] | hiển thị chi phí vừa tạo lên đầu danh sách | Changed `expenseTypes` order in `getMasterDataFn` to `desc(expenseTypes.id)` so the newest created expense type appears at the top. |
| 2026-11-03 | CMS | Loại chi phí (Duplicate Expense Type Prevention) | `https://prnt.sc/EGhoRcHQzTkq` | không cho tạo/sửa trùng loại chi phí | Added duplicate expense type check (case-insensitive) both client-side in `handleSaveExpenseType` and server-side in `saveExpenseTypeFn`. |
| 2026-11-03 | CMS | Nhà cung cấp & Khách hàng (Duplicate Name Warning) | [Feedback] | Khi nhập tên trùng với khách hàng/NCC đã tồn tại, nên hiển thị cảnh báo để người dùng kiểm tra, nhưng vẫn cho phép tiếp tục lưu vì các khách hàng/NCC khác nhau có thể trùng tên | Implemented non-blocking warning confirmation dialog (`confirmDialog`) for duplicate suppliers, customers, and POS branches, allowing saving upon confirmation. Removed hard-blocking server errors for suppliers. |
| 2026-11-03 | CMS | Master Data (Actions Column Header) | `https://prnt.sc/jWWh7ir5ujEM` [Feedback] | thêm text Thao tác trên icon sửa xóa | Added `<TableHead className="w-24 text-right pr-4">Thao tác</TableHead>` above edit/delete actions across all 6 tabs in `/master-data`. |
| 2026-11-03 | CMS | Master Data (Text Truncation with ...) | `https://prnt.sc/V6alvEZ-btPn`, `https://prnt.sc/vkf1kLSIL-Ru`, `https://prnt.sc/nVZ5gXEZM9K7` [Feedback] | tên dài quá thì ... để UI gọn hơn | Applied `max-w-`, `truncate`, and `title={...}` tooltips across all table cells in `/master-data` so long supplier, bank, account, and model names truncate with `...` cleanly. |
| 2026-11-03 | CMS | Pagination (Rows per Page Position) | `https://prnt.sc/UOzZMNyxGq4p` [Feedback] | đưa số dòng qua bên phải, dev sửa các trang UI còn lại luôn | Moved the "Số dòng" rows-per-page selector in `TablePagination` (`src/components/ui/table-pagination.tsx`) to the right side alongside page navigation buttons, uniformly updating all 14+ paginated tables across the entire application. |
| 2026-11-03 | CMS | Khách hàng (Customer List Ordering) | `https://prnt.sc/4O6yiUcOiHVJ` [Feedback] | hiển thị khách hàng vừa tạo lên đầu danh sách | Changed customer and branch queries in `customers.ts` to `desc(customers.id)` and `desc(posBranches.id)`; added `b.id - a.id` tie-breaking and search/sort reset on new creation in `customers.index.tsx` so newly created customers appear at the very top. |
| 2026-11-03 | CMS | Khách hàng (Unaccented Search) | `https://prnt.sc/KrtcfMxzIeQQ` [Feedback] | cho phép tìm tên khách hàng không dấu | Replaced raw string inclusion with `matchesSearch` (`src/lib/text.ts`) in `customers.index.tsx` so searching customer names is diacritics- and accent-insensitive (e.g. typing "khuong" finds "Khương"). Also adopted in sales and reconciliation. |
| 2026-11-03 | CMS | Vai trò & Phân quyền (Permission Group Name) | `https://prnt.sc/vjBkCTzW3v9e` [Feedback] | Đổi tên nhóm "Danh mục hệ thống" thành "Dữ liệu chung" để giống thanh menu | Renamed permission group label from "Danh mục hệ thống" to "Dữ liệu chung" in `PERMISSION_GROUPS` (`src/lib/permissions.ts`) to match the sidebar navigation menu. |
| 2026-11-03 | CMS | Vai trò & Phân quyền (Auto View/Action Permission Link) | `https://prnt.sc/vs_K8K5S3rPI`, `https://prnt.sc/Wr-3tPtHjYux`, `https://prnt.sc/zbJJ57EKqLuO`, `https://prnt.sc/-2utu3GYN4VM`, `https://prnt.sc/x2wofX38fsJ4`, `https://prnt.sc/TLLg2OOlahcV` [Bug] | tick vô các quyền thao tác ("Tạo khế ước..", "Tạo và chỉnh sửa danh mục", "Thêm, sửa, xóa lô..", "Xuất hóa đơn nội bộ", "Lập phiếu thu & chi", "Thêm & sửa khách hàng") nhưng không có menu tương ứng / Khi cấp quyền thao tác cần tự động cấp quyền xem tương ứng | Implemented bidirectional permission coupling: ticking any action permission auto-checks its module's view permission; unticking a view permission auto-removes all dependent action permissions. Updated `hasPermission` to grant view access when holding action permissions, and enforced `normalizePermissions` on role save. |
| 2026-11-03 | CMS | Vai trò & Phân quyền (Role Description Truncation) | `https://prnt.sc/EzxsrqnNJsZa` [Feedback] | mô tả dài quá thì ... | Applied `max-w-md truncate` with `title={r.description}` to role descriptions and role names in `RolesTab.tsx`, preventing horizontal table overflow, and added "Thao tác" column header. |
| 2026-11-03 | CMS | Đăng nhập (Duplicate Browser Password Eye Icon) | `https://prnt.sc/oCa1VM-ELqRp` [Feedback] | bỏ bớt 1 icon con mắt đi | Hidden browser-native password reveal button (`::-ms-reveal` and `::-ms-clear`) in `styles.css` and `password-input.tsx` to eliminate duplicate eye icons in Chromium and Edge browsers. |
| 2026-11-04 | CMS | Quản lý người dùng (Locked Account Notification) | [Feedback] | người dùng đang log in mà admin khóa thì hiển thị thông báo "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ" | Implemented real-time locked account detection with `currentUserQuery` (10s interval & focus refetch). Server returns `ACCOUNT_LOCKED` error when deactivation detected; client displays immediate modal alert with exact message and redirects to `/login?locked=1` with red error alert banner. |
| 2026-11-04 | CMS | Quên mật khẩu (Password Reset Token Expiry) | `https://prnt.sc/fpDjCFsvbaI6` [Bug] | nhập email -> qua form đặt lại mật khẩu nhưng khi đặt lại mật khẩu đặt không được | Fixed timezone mismatch between Node.js UTC timestamp and MySQL server session timezone (+07:00). Switched `expiresAt` creation to `DATE_ADD(NOW(), INTERVAL 30 MINUTE)` in `src/server/services/auth.ts`, ensuring token expiration and validation always share the exact same MySQL clock. |


| 2026-11-04 | Khế ước | Khế ước vay ngân hàng (Error Localization) | `https://prnt.sc/cGvLTpxQqGNV` [Feedback] | việt hóa | Added `principalAmount: 'Số tiền vay'` and comprehensive domain translations to `FIELD_TRANSLATIONS` in `src/components/ui/confirm-dialog.tsx`; enhanced `formatErrorMessage` to avoid redundant prefixing; added client-side validation in `loans.index.tsx` and Vietnamese Zod messages in `finance.ts`. |
| 2026-11-04 | Khế ước | Khế ước vay ngân hàng (Account Number Format) | `https://prnt.sc/GarGvdXVgWQa` (`5811623238sssssss`) [Bug] | số tài khoản chỉ cho nhập số | Sanitized `openEditLoan` with `\D` filter; added `onKeyDown` and `onPaste` character blockers on `accountNumber` `<Input>`; added client-side `^\d+$` validation and server-side regex validator; cleaned dirty DB records. |
| 2026-11-04 | Khế ước | Khế ước vay ngân hàng (Principal Max Cap) | `https://prnt.sc/v8cEEphwz-c-` [Feedback] | giới hạn số tiền vay và validation ngay khi nhập, tránh nhập số quá lớn khiến phần lãi ước tính bị tràn, vỡ giao diện | Added `maxDigits={12}` and `max={999_999_999_999}` to `MoneyInput`; added live keydown & paste limits, inline alert, estimate card overflow protection, and server-side `.max()` validation. |
| 2026-11-04 | Bán hàng | Lập phiếu bán xe mới (Customer Default Selection) | `https://prnt.sc/au0gWeBBEErH` [Feedback] | Để “Chọn khách hàng” và bắt người dùng chọn, tránh lập nhầm khách | Initialized `customerId` to `null` instead of `customers[0]?.id`; disabled branch select until customer selected; enforced client and server validation. |
| 2026-11-04 | Bán hàng | Lập phiếu bán xe mới (Validation Error Dismissal) | `https://prnt.sc/Z_IkMqXsFtCd` [Feedback] | bấm "Xác nhận lập phiếu" khi chưa thêm xe, sau đó thêm xe nhưng mesage lỗi vẫn còn trong khi đó đã thêm | Added automatic reactive clearing of validation errors upon adding vehicles or selecting a customer, and added dismiss button to error banner. |
| 2026-11-04 | Bán hàng | Lọc phiếu bán (Date Range Validation) | `https://prnt.sc/7jwuFmrn0xKJ` [Bug] | Cần validation khi Ngày bán từ lớn hơn Ngày bán đến, hiển thị thông báo "Ngày bán đến phải lớn hơn hoặc bằng Ngày bán từ" | Enforced `from <= to` validation with inline warning, toast notification, input error styling, and main page alert banner. |
| 2026-11-04 | Bán hàng | Lập phiếu bán xe mới (Price Validation Localization) | `https://prnt.sc/nr-oXV8kAJEi` [Feedback] | việt hóa | Added `items: 'Xe'` to `ROW_LABELS`, added `priceBeforeVat: 'Đơn giá chưa VAT'` and `priceWithVat: 'Đơn giá đã VAT'` to `FIELD_TRANSLATIONS`, formatted non-inclusive `too_small` numbers to "Phải lớn hơn 0", added client-side price checks, and Vietnamese Zod validators. |
| 2026-11-04 | Kho xe | Kho xe (2 Kho) (Dual Inventory 4th Status Card) | `https://prnt.sc/iL1e9y548dKB` [Feedback] | bổ sung thêm card trạng thái "Đã giao - Chưa hóa đơn" | Added the 4th dual inventory status card "Đã giao · Chưa hóa đơn" with `Truck` icon and `sky` theme in `src/routes/inventory.tsx`, and updated grid layout to `xl:grid-cols-4`. |
| 2026-11-06 | Tài chính | Thu chi & Công nợ (Finance Voucher Modals Max Height) | User Feedback | have this popup have max height | Applied `max-h-[90dvh] overflow-y-auto` to both Payment and Receipt voucher modals in `src/routes/finance.tsx` to prevent viewport overflow on smaller displays. |
| 2026-11-06 | CMS | Khế ước vay ngân hàng (Repayment Inline Save Unblock) | `https://prnt.sc/rHJY81cSpzYU`, `https://prnt.sc/6yTRkefvk55e` [Bug] | Không bấm lưu được sau khi validation thất bại, ví dụ bỏ trống trường tiền rồi hiển thị lỗi nhập số tiền lại rồi bấm lưu k được | Wrapped inline validation checks inside `try...finally` in `src/routes/loans.$loanId.tsx` so `savingRef.current` is always reset to `false` on validation failures, preventing save clicks from being blocked. |
| 2026-11-06 | CMS | Nhập lô & Giá vốn (% VAT Decimal Input) | `https://prnt.sc/dn80zKb1-YJ0` [Feedback] | cho nhập 8,5% ở trường %VAT | Replaced raw numeric inputs with `DecimalInput` in `BatchEditor.tsx`, `batches.new.tsx`, and `VehicleFormDialog.tsx`, normalized dot/comma in `decimal-input.tsx`, enabling decimal VAT entry (e.g. 8,5%) and correct calculation of VAT-inclusive price. |
| 2026-11-06 | CMS | Nhập lô & Giá vốn (Duplicate Engine Number Validation) | `https://prnt.sc/aKKLfryprP6L` [Bug] | bổ sung validation hoặc cảnh báo trùng số máy để tránh nhập trùng thông tin động cơ. | Added engine number duplicate validation on client (`saveVehicleInline`, live input highlight, `handleSubmit`), server (`assertNotInDb`, `updateVehicle`), and Excel import (`excel-import.ts`). |

| 2026-11-06 | CMS | Nhập lô & Giá vốn (Excel Import Error Summary) | `https://prnt.sc/HiGKD28j7UIA` [Bug] — import 2 dòng excel nhưng 1 dòng excel thiếu SK và SM nhưng không hiển thị lỗi | Hệ thống cần thông báo rõ số dòng import thành công, số dòng thất bại và nguyên nhân lỗi cụ thể để người dùng bổ sung dữ liệu. | Updated `parseVehicleExcel` (`src/lib/excel-import.ts`) to only skip completely blank rows, collect row-level errors (`errors: VehicleImportError[]`) alongside valid rows (`success`), and updated `batches.new.tsx` & `BatchEditor.tsx` to display a detailed summary dialog (`Thành công: X/N dòng`, `Thất bại: Y/N dòng`, and row-by-row reasons). |
