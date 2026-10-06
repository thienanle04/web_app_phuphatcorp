# Task List: ND-MCC đọc sheet MCC và NDFC
**Ngày:** 2026-10-05  
**BA Doc:** `docs/ba/20261005_nd-mcc-mcc-ndfc-source-analysis.md`  
**UI Spec:** `docs/ui/20261005_nd-mcc-mcc-ndfc-source-ui-spec.md`  
**Mục tiêu:** Engine ND-MCC đọc sheet `MCC` và `NDFC`, áp sổ giá mới cho clv/uni, xuất workbook giữ sheet gốc và thêm 8 sheet xử lý. Không có migration, không có API mới, không sửa UI.

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| BE-01 | Đổi sổ giá trong `pricingLookup.ts` | Sửa `resolveTargetBook`: MCC slot `CALOFIC HP` / `CLV` và slot `WH UNIDEPOT` / `UNI` trả `MCC GH`. MCC `UNI 1` / `TT` giữ `MCC (tt)` hoặc `MCC (tt) GHÉP ND` theo `hasNdfcInTrip`. MCC slot còn lại vẫn trả `CLV` (chỉ hiện trên `MCC (goc)`). NDFC `UNI 1` / `TT` giữ `NDFC (TT)`. Mọi slot NDFC còn lại trả `CLF`. Trong `lookupTransportRate`, khi đã có `targetBook` thì chỉ nhận book khớp đúng tên (giữ alias `GHÉP ND` đang có). Book khác điểm 0, kể cả `CLV`, `NDFC-naic`, `VP-hiep phuoc`. Không thấy book đích thì trả `null`. | S |
| BE-02 | Đọc khối chuyến từ sheet `MCC` và `NDFC` | Trong `ndMccEngine.ts`, bỏ `generateProcessedV2Sheet` và mọi đọc sheet `Processed` làm nguồn dòng. Tìm sheet `MCC` và `NDFC` (trim, không phân biệt hoa thường). Thiếu `MCC` → throw `MISSING_MCC_SHEET`. Thiếu `NDFC` → `MISSING_NDFC_SHEET`. Thiếu cả hai → `MISSING_MCC_NDFC_SHEETS`. Header lấy ở dòng có nhiều ô tiêu đề (file mẫu là dòng 2). Map theo tên cột: `Round(MT)`, `Tấn/ Hóa đơn`, `Tấn/ Chuyến`, `CLF`, `VFM`, `MCC`, `CLV`, `NDFC`, `GẠO`. Cột ngay sau `GẠO` (header trống) là `5 nhà`. Một khối là các dòng liền nhau cùng `Số tàu`. Gán `CLF`…`GẠO` và `5 nhà` từ dòng đầu khối cho mọi dòng trong khối; khi ghi 8 sheet chỉ đổ số đó ở dòng đầu khối. `hasNdfcInTrip` của dòng MCC lấy từ cột `NDFC` của dòng đầu khối trên sheet `MCC` (> 0). Giữ lọc mã `2000000007` / `2000000008`, tra khách, phụ phí, khung giá nguyên văn, layout 8 sheet, công thức Hóa đơn / Round MT / Tấn / Thành tiền, Bảng A-B, note Pallet. | L |
| BE-03 | Ghép workbook xuất | Bỏ bước tô partial-match lên `Processed` và `Processed v2`. Xóa đúng sheet `VFM`, `VFM (2)`, `CLV`, `STHI`, `STHI (uni)`, `NPP`, `TINH` (trim, đúng chữ). Giữ thứ tự các sheet còn lại. Không tạo `NCC` khi chưa có. Không tạo `Processed v2`. Ghi đè nếu tên đích đã tồn tại. Append cuối: `MCC (goc)`, `MCC-clv`, `MCC (uni)`, `MCC (tt)`, `NDFC (goc)`, `NDFC-clv`, `NDFC (uni)`, `NDFC (tt)`. Partial-match chỉ tô trên 8 sheet này. | M |
| BE-04 | Lỗi service ND-MCC | Trong `bangKeTho/index.ts` `processNdMcc`: map ba mã throw của engine sang `BangKeError` 400. Message: `File input thiếu sheet MCC`, `File input thiếu sheet NDFC`, `File input thiếu sheet MCC và NDFC`. Ghi `error_message` đó khi `failed`. Bỏ nhánh `MISSING_PROCESSED_SHEET` của luồng xử lý. Giữ `assertProcessedSheet` lúc upload. Bỏ `export * from './processedV2'`. | S |
| BE-05 | Xóa processed v2 khỏi bangKeTho | Xóa `backend/src/services/bangKeTho/processedV2.ts` và `backend/src/__tests__/bangKeThoProcessedV2.test.ts`. Không đụng `frontend/src/utils/processedV2.ts`. | S |
| BE-06 | Cập nhật test engine và service | Sửa `bangKeThoNdMccEngine.test.ts`: kỳ vọng sổ giá mới; fixture có sheet `MCC`/`NDFC` đúng layout file mẫu (dòng đầu khối có CLF…GẠO và cột sau GẠO); assert thứ tự sheet, không có `Processed v2`, partial-match không nằm trên sheet giữ lại; thiếu từng sheet nguồn. Sửa test giá CLV/NDFC-naic thành MCC GH / CLF và ca không fallback. Sửa `bangKeThoService.test.ts` nếu còn kỳ vọng `MISSING_PROCESSED_SHEET` ở process ND-MCC. Upload thiếu `Processed` vẫn 400. | M |

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| FE-01 | Không sửa UI | UI spec: không thêm key i18n, không sửa `BangKeThoPage` hay `BangKeThoHouseCell`. Toast và tooltip đã hiện `message` / `error_message` từ API. Việc kiểm tra là đối chiếu sau khi BE trả ba message thiếu sheet. | S |

## 📊 Thứ tự thực hiện

Phase 3: BE-01 → BE-02 → BE-03 → BE-04 → BE-05  
Phase 4: Không migration  
Phase 5: BE-06  
Phase 6: `npm run test` trong `backend`  
Phase 7: FE-01 (đối chiếu, không viết component)  
Phase 8: Regression theo AC-01…AC-10 của BA  
Phase 9: Cập nhật mục ND-MCC trong `.opencode/knowhow/system-features.md` (bỏ `processedV2.ts` khỏi danh sách file backend)

## Coding Standards
Đọc `.opencode/knowhow/coding-convention.md` trước khi viết code. Envelope lỗi giữ `{ success: false, message, error: { code } }`. ExcelJS cho workbook có công thức. Số tấn `#,##0.000`, tiền `#,##0`.

## ⚠️ Lưu ý kỹ thuật
- `lookupTransportRate` đang chấm điểm phụ `CLV` / `NDFC-naic` / `VP-hiep phuoc` sau khi đã có `targetBook`. BE-01 phải chặn fallback này, nếu không đổi `resolveTargetBook` vẫn ra giá sổ cũ.
- Sheet nguồn không có dòng phân cách. Tách khối bằng đổi `Số tàu`, không bằng dòng trống mã nhà cung cấp.
- Cột `5 nhà` trên nguồn không có header. Lấy ô kế bên phải cột `GẠO`.
- Save workbook bằng ExcelJS có thể làm sạch style sheet giữ lại. BE-03 cần giữ giá trị các sheet không xóa; không ghi đè nội dung `Sheet1`, `Processed`, `MCC`, `NDFC`.
- `hasNdfcInTrip` không còn quét theo cặp số tàu + ngày trên `Processed`. Một khối số tàu dùng một cờ, dù khối có nhiều ngày hóa đơn.
