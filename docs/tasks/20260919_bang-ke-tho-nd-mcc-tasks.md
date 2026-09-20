# Task List: Xử lý Bảng Kê Thô ND-MCC (MCC & NDFC)
**Ngày:** 2026-09-19  
**BA Doc:** `docs/ba/20260919_bang-ke-tho-nd-mcc-analysis.md`  
**UI Spec:** `docs/ui/20260919_bang-ke-tho-nd-mcc-ui-spec.md`  
**Mục tiêu:** Xây dựng engine xử lý bóc tách, áp giá cước và phụ phí, sinh 8 sheets bảng kê thô ND-MCC gắn vào workbook của đợt bảng kê 5 nhà.

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort | Trạng thái |
|---|---|---|---|---|
| BE-01 | Customer & Pricing Lookup Helpers | Tạo `backend/src/services/bangKeTho/pricingLookup.ts`: Tra cứu khách hàng (`customers`: Đại lý `diem_tra_hang`, Điểm thực tế `tuyen_phuong`, Điểm tính phí `diem_giao_hang_tinh_phi`). Tra cứu bảng giá cước vận tải (`route_pricing`: theo Điểm tính phí, Khung tải `≤2.5 tấn`, `>8-16 tấn`, `>16-23 tấn`, và Ngày hóa đơn). Tra cứu phụ phí (`customer_surcharges` / rules). Trả về ô trống (null) khi không tìm thấy giá. | M | ✅ Hoàn thành |
| BE-02 | ND-MCC Generation Engine | Tạo `backend/src/services/bangKeTho/ndMccEngine.ts`: Nhận buffer workbook input từ ExcelJS. Đọc sheet `Processed`. Lọc các dòng MCC (Mã NCC `2000000007`) và NDFC (Mã NCC `2000000008`). Phân bổ vào 8 sheets mới: `MCC (goc)`, `MCC-clv`, `MCC (uni)`, `MCC (tt)`, `NDFC (goc)`, `NDFC-clv`, `NDFC (uni)`, `NDFC (tt)`. Chèn công thức Excel chuẩn (Hóa đơn, Round MT, Tấn/Hóa đơn, Tấn/Chuyến, Thành tiền check, Thành tiền hóa đơn, 5 nhà). Định dạng số và độ rộng cột. Đảm bảo xuất file đúng thứ tự 12 sheets: `NCC`, `Sheet1`, `Processed`, `Processed v2`, `MCC (goc)`, `MCC-clv`, `MCC (uni)`, `MCC (tt)`, `NDFC (goc)`, `NDFC-clv`, `NDFC (uni)`, `NDFC (tt)`. | L | ✅ Hoàn thành |
| BE-03 | Service Method Integration & Package Modularization | Tách module `backend/src/services/bangKeTho/`: `index.ts`, `ndMccEngine.ts`, `pricingLookup.ts`, `processedV2.ts`. Thêm method `processNdMcc(batchId: string, userId: number)`: Lấy input stream từ MinIO, chạy engine sinh output buffer, lưu vào MinIO tại `batches/{batch_id}/outputs/nd_mcc.xlsx`, cập nhật bản ghi `bang_ke_tho_outputs` (`status = 'ready'`, `object_key`, `generated_at = NOW()`). Nếu lỗi, cập nhật `status = 'failed'`, `error_message`. | M | ✅ Hoàn thành |
| BE-04 | Controller & API Endpoint | Thêm method `processNdMcc` trong `backend/src/controllers/bangKeThoController.ts`. Đăng ký route `POST /api/bang-ke-tho/batches/:id/process-nd-mcc` trong `backend/src/routes/bangKeTho.ts` kèm middleware `requirePermission('accounting_data.manage')` và validate UUID params. | S | ✅ Hoàn thành |
| BE-05 | Unit & Integration Tests | Tạo `backend/src/__tests__/bangKeThoNdMccEngine.test.ts`: Kiểm tra bóc tách phân loại đúng các slot (CALOFIC HP, WH Unidepot, UNI 3, UNI 1), sinh đủ 12 sheets, công thức chính xác, và tích hợp service/endpoint. | M | ✅ Hoàn thành |
| BE-06 | Address Normalization & Matching Utility | Tạo `backend/src/utils/addressMatcher.ts` và test `backend/src/__tests__/addressMatcher.test.ts`: Hỗ trợ normalize key, loại bỏ "thửa đất số ...", so khớp chuỗi con, token overlap >= 75%. Đánh dấu partial match, tô nền `#FFF2CC` và gắn Cell Note trên ô địa chỉ cả ở `Processed` và `Processed v2`. | M | ✅ Hoàn thành |
| BE-07 | Processed v2 Generation & Recalculation Engine | Tạo `backend/src/services/bangKeTho/processedV2.ts` và test `backend/src/__tests__/bangKeThoProcessedV2.test.ts`: Nhân bản `Processed` thành `Processed v2`, parse số liệu text tại các cột Số lượng, SP Net, HĐ Net thành kiểu số (`number`), đảo cột `5 nhà` trước cột `CLF` (header xanh lá `#00B050`, text trắng đậm), thêm cột `Gạo`, tính lại Khung giá theo tải trọng chuyến trên cột 5 nhà (tô màu `#FFE599` và gắn Note khi thay đổi). | M | ✅ Hoàn thành |
| BE-08 | Two-table Layout & Pallet Notes | Cập nhật `ndMccEngine.ts`: Tách Bảng A (>2.5 tấn) nhóm theo chuyến xe kèm dòng `Tổng cộng` và kết thúc bằng `TỔNG CỘNG A` (`=SUM(...)/2`); cách 6 dòng trống đến Bảng B (≤2.5 tấn) kết thúc bằng `TỔNG CỘNG B` (`=SUM(...)`). Sub-sheets hiển thị `'Pallet'` ở cột Khung giá và lưu note chi tiết ban đầu. | M | ✅ Hoàn thành |
| BE-09 | Route & Province Aliases Expansion | Cập nhật `backend/src/utils/routeMatcher.ts` và test `backend/src/__tests__/routeMatcher.test.ts`: Bổ sung `CANONICAL_PROVINCES`, hoàn thiện `PROVINCE_ALIASES` (BRVT, Huế, Đồng Nai, v.v.), chuẩn hóa loại bỏ từ chỉ đơn vị hành chính lồng giữa chuỗi (`ADMIN_WORD_REGEX`). | S | ✅ Hoàn thành |

---

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort | Trạng thái |
|---|---|---|---|---|
| FE-01 | API Client Extension | Cập nhật `frontend/src/api/bangKeThoApi.ts`: Thêm `processNdMcc(batchId: string): Promise<BangKeHouse>` và `downloadOutput(id: string, houseCode: string, fallbackName: string): Promise<void>`. | S | ✅ Hoàn thành |
| FE-02 | React Query Hook | Cập nhật `frontend/src/hooks/useBangKeTho.ts`: Thêm `useProcessNdMcc()` mutation, tự động invalidate query `['bang-ke-tho']` khi hoàn tất, trigger Toast thành công / thất bại. | S | ✅ Hoàn thành |
| FE-03 | Nâng cấp Component Cột ND-MCC | Cập nhật `frontend/src/components/bang-ke-tho/BangKeThoHouseBadge.tsx` hoặc tạo `BangKeThoHouseCell.tsx`: Render trạng thái cột ND-MCC gồm nút "Xử lý" (khi pending/failed), nút "Tải file" và "Chạy lại" (khi ready), spinner loading khi đang gọi API. Disable khi không có quyền `accounting_data.manage`. | M | ✅ Hoàn thành |
| FE-04 | i18n Translations | Thêm đầy đủ nhãn nút, tooltip, và thông báo Toast liên quan đến xử lý bảng kê ND-MCC trong `frontend/src/locales/vi.json` và `en.json`. | S | ✅ Hoàn thành |

---

## 📊 Thứ tự thực hiện

- [x] Phase 3: BE-01 → BE-02 → BE-03 → BE-04  
- [x] Phase 4: Run migration (Không có migration mới, tận dụng `046_create_bang_ke_tho.sql`)  
- [x] Phase 5: Viết tests (BE-05)  
- [x] Phase 6: Chạy tests (`npm run test`)  
- [x] Phase 7: FE-01 → FE-02 → FE-03 → FE-04  
- [x] Phase 8: Regression & đối chiếu UI Spec  
- [x] Phase 9: Cập nhật `know-how.md` & `system-features.md`  

---

## Coding Standards
Đọc `.opencode/knowhow/coding-convention.md` (hoặc `.agents/knowhow/coding-convention.md`) trước khi viết code:
- Envelope chuẩn: `{ success: true, message: "...", data: { ... } }`.
- Sử dụng `exceljs` cho xử lý bảng tính phức tạp có công thức.
- Định dạng số: `#,#0` cho tiền tệ / số nguyên, `#,##0.000` cho tấn / khối lượng.
- Quyền: `accounting_data.manage` cho trigger xử lý, `accounting_data.view` cho tải file output.

---

## ⚠️ Lưu ý kỹ thuật
- File input có thể chứa hàng nghìn dòng, cần tối ưu bộ nhớ khi parse qua `exceljs` (sử dụng memory buffer / stream an toàn).
- Đảm bảo công thức Excel sinh ra tương thích cả trên Microsoft Excel và Google Sheets/LibreOffice.
- MinIO key phải theo chuẩn BR-016: `batches/{batch_id}/outputs/nd_mcc.xlsx`.
