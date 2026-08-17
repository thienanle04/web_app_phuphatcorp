# Change Plan: Thêm `diem_giao_hang_tinh_phi` (text) cho customers

**Ngày:** 2026-08-17  
**Impact:** MEDIUM (migration + additive API + UI)  
**BA:** `docs/ba/20260817_customer-route-groups-analysis.md` — **chỉ phần A (BR-T01–T05)**  
**UI Spec:** `docs/ui/20260817_diem-giao-hang-tinh-phi-ui-spec.md`

**Out of scope:** junction `customer_route_groups`, picker nhóm tuyến, `route_group_ids`, Delivery Import lookup.

---

## Thứ tự: Migration → BE → FE

| ID | Layer | Task | Chi tiết | Files |
|----|-------|------|----------|-------|
| CR-01 | Migration | Thêm cột nullable | `ALTER TABLE customers ADD COLUMN IF NOT EXISTS diem_giao_hang_tinh_phi VARCHAR(255);` Idempotent. Không index (không unique, không search SQL). Số: `043_add_diem_giao_hang_tinh_phi_to_customers.sql` | `backend/src/migrations/043_add_diem_giao_hang_tinh_phi_to_customers.sql` |
| CR-02 | BE | Types + SELECT/INSERT/UPDATE/upload | `Customer` + `CustomerData` thêm `diem_giao_hang_tinh_phi: string \| null`. `SELECT_COLS`, `create`, `update`, `uploadMany`. Trim whitespace → `null`. | `backend/src/services/customerService.ts` |
| CR-03 | BE | Validation + controller | `body('diem_giao_hang_tinh_phi').optional({ nullable: true }).isLength({ max: 255 })`. Upload: `rows.*.diem_giao_hang_tinh_phi` optional. Pass field vào create/update/upload. | `backend/src/controllers/customerController.ts` |
| CR-04 | BE | Tests | `mockRow` có field; create/update/upload truyền và persist; optional omitted → null. | `backend/src/__tests__/customerService.test.ts` |
| CR-05 | FE | API types | `Customer`, `CustomerData`, `UploadCustomerRow` thêm field optional/nullable. | `frontend/src/api/customersApi.ts` |
| CR-06 | FE | i18n | Keys UI Spec §5 (vi + en). Cập nhật `customers.search`. | `frontend/src/i18n/vi.json`, `en.json` |
| CR-07 | FE | List + search | Thứ tự: Tuyến-phường → GHTP → **Tên KH**; ẩn **Tuyến-cũ**; `null` → “—”; search gồm GHTP. | `frontend/src/pages/admin/accounting-data/CustomersPage.tsx` |
| CR-08 | FE | Create / Edit form | Yup optional max 255; input sau địa chỉ; payload trim → null; edit prefill. | `CreateCustomerModal.tsx`, `EditCustomerModal.tsx` |
| CR-09 | FE | Excel import | `findCol` alias; thiếu cột → null; template + column guide. | `frontend/src/components/admin/UploadCustomersModal.tsx` |
| CR-10 | Docs | Knowhow | Schema `customers` + API body POST/PUT/upload. BR-T trên system-features §11.2. | `.cursor/knowhow/know-how.md`, `system-features.md` |

---

## Ghi chú kỹ thuật

- Contract **additive, không break**: client cũ không gửi field → BE lưu `null`.
- Không đụng `processDeliveryData.ts` / lookup tuyến.
- `useCustomers.ts` không đổi (types flow từ API).
- Sau CR-01: `npm run db:push` (hoặc lệnh migrate hiện có của repo).
- Lint + typecheck sau BE (CR-04) và sau FE (CR-09).
