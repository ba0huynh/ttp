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


