# Task List: Phụ phí giao hàng

**Ngày:** 2026-09-17  
**BA Doc:** `docs/ba/20260917_customer-surcharges-analysis.md`  
**UI Spec:** `docs/ui/20260917_customer-surcharges-ui-spec.md`  
**Knowhow:** `.opencode/knowhow/know-how.md`, `.opencode/knowhow/system-features.md`, `.opencode/knowhow/coding-convention.md`

---

## BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| BE-01 | Migration `056_customer_surcharge_rules.sql` | Idempotent. Bảng `customer_surcharge_rules` đúng BA §2: `ten_khach_hang`, `customer_id` NULL FK `customers(id)`, `fee_type` check 3 giá trị, `zone` NULL check, `vehicle_class` NULL check, `amount INTEGER >= 0`, `pricing_unit` check `tan\|chuyen`, `start_date`, `end_date` NULL, audit. Index `(lower(trim(ten_khach_hang)))`, `(customer_id, fee_type)`, `(start_date, end_date)`. Không unique cứng trên combo vì có lịch sử. Không seed. Không đụng `customers.boc_xep`, không đụng giá tuyến. | M |
| BE-02 | Types + mã lỗi | `backend/src/types/customerSurcharge.ts`: rule, list query, create/replace/stop body, lookup body, `FeeHit`, lookup response. Service throw `{ code, message }` các mã BA §6. | S |
| BE-03 | Service ghi và đọc | File `customerSurchargeService.ts`. `list`, `customerOptions` (tên distinct active + điểm active có địa chỉ, kèm tên và mã nhà cung cấp lúc đọc). Không lưu tên trên rule. `create`, `replace`, `stop`. Khớp tên `lower(trim)` không gộp khoảng trắng. Điểm phải active, đúng tên, có địa chỉ. Một dòng `end_date` null / combo. Replace đóng dòng cũ vào hôm trước ngày mới. Stop mặc định hôm nay, `end_date >= start_date`. Tạo sau khi đã đóng: `start_date` > `end_date` gần nhất. Chặn `RULE_OVERLAP`, `RULE_OPEN_EXISTS`, `RULE_AMBIGUOUS` (một rule chỉ vùng + một rule chỉ khung xe, cùng tầng, cùng loại, ngày chồng). Server gán `pricing_unit`. Không sửa dòng đã đóng. | L |
| BE-04 | Lookup | `lookup` trong cùng service. Khớp điểm active bằng `trim` + `lower` tên và địa chỉ. `supplier_code` tùy chọn, cùng cách chuẩn hóa. Không gửi mã: 0 điểm → `NO_POINT`, 1 điểm → khớp, ≥2 điểm → `AMBIGUOUS`. Có gửi mã: lọc đúng mã, 0 còn lại → `NO_POINT` và phí đại lý, 1 còn lại → khớp, ≥2 cùng mã → `AMBIGUOUS`. Điểm khớp trả `diem_tra_hang`, `tuyen_phuong`, `diem_giao_hang_tinh_phi`, `supplier_name`, `supplier_code`. Không trả `customer_id` / `tuyen_cu`. Mỗi loại phí: rule hiệu lực của điểm thắng cả tầng điểm. Không có thì rule đại lý theo tên gửi lên. | L |
| BE-05 | Route + validation | Gắn vào `backend/src/routes/routePricing.ts`, trước route có `:id`. Express-validator, không Zod. GET `/surcharges`, GET `/surcharges/customer-options`, POST `/surcharges`, POST `/surcharges/:id/replace`, POST `/surcharges/:id/stop`, POST `/surcharges/lookup`. View cho GET và lookup. Manage cho ghi. `handleServiceError` map mã BA §6, message tiếng Việt. `amount` integer ≥ 0. Lookup: vùng và khung xe bắt buộc. Không đụng `GET /lookup`. | M |
| BE-06 | Ngừng ghi `customers.boc_xep` | `customerService` create/update/upload bỏ qua `boc_xep` trong payload, không đổi giá trị cột khi update. Insert mới giữ default DB. Không drop cột. Không đụng `trip_codes`. | S |

## FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| FE-01 | API + hooks | `customerSurchargeApi.ts`, `useCustomerSurcharges.ts`. Query key gồm filter URL. Mutation create / replace / stop invalidate list. Types khớp response lookup. | M |
| FE-02 | Trang danh sách | `CustomerSurchargesPage.tsx`. Route `/route-pricing/surcharges` trong `Router.tsx`. Menu trong `MainLayout.tsx`, icon riêng, không cần `priceBookId`. Đọc UI Spec Screen 1. Filter sync URL. Skeleton, empty, empty-filter, error + Thử lại. Phân trang 50. `tabular-nums` + `Intl`. Icon Đổi giá / Ngừng có `aria-label`, chỉ dòng đang mở và chỉ `manage`. | L |
| FE-03 | Modal thêm và đổi giá | `SurchargeFormModal.tsx` Screen 2 và 3. Combobox tên từ `customer-options`, không submit chuỗi lạ. Điểm chỉ khi phạm vi điểm, lọc theo tên, chỉ điểm có địa chỉ. Đổi tên thì xóa điểm. Đơn vị read-only theo loại phí. Đổi giá: field điều kiện read-only, chỉ số tiền và ngày. Dirty close mở confirm “Bỏ thay đổi?”, không `window.confirm`. Focus ô lỗi đầu. Toast giữ form khi fail. | L |
| FE-04 | Ngừng và tra cứu | `SurchargeStopDialog.tsx` Screen 4. `SurchargeLookupModal.tsx` Screen 5. Tra cứu là text tự do, không combobox. Vùng và khung xe bắt buộc. Kết quả dùng câu i18n, không hiện mã thô. 0 là “0”. `NO_RULE` là “—”. Giữ kết quả cũ khi request lỗi. | M |
| FE-05 | Delta khách hàng | `CustomersTable`: bỏ cột bốc xếp. Tên khách là `a` tới trang phụ phí khi có `route_pricing.view` hoặc `manage`. Create/Edit không còn checkbox, không gửi `boc_xep`. Upload không đọc cột bốc xếp, không fail nếu cột còn. | M |
| FE-06 | i18n | Key UI Spec §5 vào `vi.json` và `en.json`. Không hardcode string mới. Cập nhật subtitle nav nếu cần, không đổi tên accordion. | S |

## Thứ tự thực hiện

```
Phase 3:  BE-01 → BE-02 → BE-03 → BE-04 → BE-05 → BE-06   (lint + build sau mỗi task)
Phase 4:  cd backend && npm run migrate
Phase 5:  test-qa viết unit cho service lookup/create/replace/stop và customer boc_xep bị bỏ qua
Phase 6:  cd backend && npm test   (3 lần fail → dừng)
Phase 7:  FE-01 → FE-02 → FE-03 → FE-04 → FE-05 → FE-06  (đọc UI Spec trước)
Phase 8:  QA regression đối chiếu UI Spec Screen 1–9
Phase 9–10: cập nhật `.opencode/knowhow/know-how.md` và `system-features.md`

Delta còn lại, sau khi bản đầu đã có: BE-07 → BE-08 → FE-07 → FE-08 → FE-09. Không tạo file task mới.
```

## Coding Standards

Đọc `.opencode/knowhow/coding-convention.md` trước khi code. Envelope `{ success, message, data }`. Migration `IF NOT EXISTS`. FE không tự quyết layout. Route pricing đang dùng express-validator. Không chuyển Zod trong feature này.

## Lưu ý kỹ thuật

- `POST /surcharges/lookup` và `GET /surcharges/customer-options` đăng ký trước route `:id`.
- Khớp điểm copy luật `trim().toLowerCase()` của `buildCustomerLookup`. Không fuzzy, không gộp khoảng trắng.
- `RULE_AMBIGUOUS` lúc ghi khác `AMBIGUOUS` lúc tra. Ghi chặn rule sẽ gây hòa. Tra trả hòa nếu data cũ lọt. Test cả hai.
- Override hết hạn không chặn giá đại lý. Rule điểm đang mở của loại phí khác không ảnh hưởng loại phí đang tra.
- Giá `0` là hợp lệ. Không có rule không được trả 0.
- `GET /route-pricing/lookup` vẫn 501. Không sửa `processDeliveryData.ts`.
- Folder migration có số trùng. File mới là `056_`, runner sort theo tên.
- Quyền view được POST lookup. Không coi đó là ghi dữ liệu.
- Form thêm không cho gõ tên tự do. Modal tra cứu thì cho, vì chuyến gửi chuỗi thô.

## Delta: nhiều tên và xóa cứng

Các task trên mô tả bản đầu. Phần dưới là việc còn lại sau grill cùng ngày. Không tạo file task mới.

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| BE-07 | Tạo nhiều tên, một transaction | `create` nhận `ten_khach_hangs`. Không có mảng thì dùng `ten_khach_hang`. Gom trùng `lower(trim)`. `customer_id` chỉ khi còn một tên; từ hai tên mà có `customer_id` → 400 `POINT_NOT_ALLOWED_FOR_BATCH`. Kiểm hết tên rồi mới insert. Rollback nếu có `CUSTOMER_NAME_UNKNOWN`, `RULE_OPEN_EXISTS`, `RULE_OVERLAP`, `RULE_AMBIGUOUS`. `data.failures` theo thứ tự body. 409 nếu có xung đột, 400 nếu chỉ tên không còn. Không audit. | M |
| BE-08 | Xóa cứng + audit | `DELETE /route-pricing/surcharges/:id`, manage. Xóa đang mở hoặc đã ngừng. Không mở lại bản ghi cũ. 404 `SURCHARGE_NOT_FOUND`. Thành công gọi `auditService.logAudit`: action `DELETE`, entityType `customer_surcharge_rule`, details snapshot đủ cột nghiệp vụ. Xóa lỗi không ghi audit. Đăng ký route trước `/:id` khác nếu có, không nuốt lookup. | S |
| FE-07 | Form tick nhiều tên | `SurchargeFormModal`: tick nhiều tên, không chọn tất cả, tick lại để bỏ. Từ hai tên ẩn phạm vi và điểm, xóa điểm đang chọn. Lỗi `failures` hiện trong form, không toast, giữ tên đã tick. Toast “Đã thêm phụ phí” khi một tên; “Đã thêm {n} phụ phí” khi nhiều hơn. | M |
| FE-08 | Dialog xóa | `SurchargeDeleteDialog.tsx`. Nút icon mọi hàng khi manage, `aria-label` “Xóa phụ phí”. Ba câu đúng UI Spec Screen 9. Phụ phí đã ngừng không có Đổi giá / Ngừng. Toast “Đã xóa phụ phí”. | S |
| FE-09 | i18n câu mới | Thêm key Screen 9 và lý do lỗi vào `vi.json` / `en.json`. Không sửa `customerSurcharges.emptyFiltered`. Không hardcode. | S |
