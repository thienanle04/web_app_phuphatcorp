# Tasks: Import Excel cho Bảng điều phối xe (Dispatch Schedule)
**Ngày:** 2026-09-11
**Brief:** `docs/light/20260911_import-dispatch-excel-brief.md`

---

## Danh sách công việc (LIGHT Tasks)

| ID | Tầng | Task | Chi tiết kỹ thuật | Effort |
|----|------|------|-------------------|--------|
| L-01 | FE | Tạo component `ImportDispatchExcelModal` | Component modal import file `.xlsx`, kéo thả file, đọc dữ liệu qua thư viện `xlsx`, tìm header row (`STT`, `NƠI GIAO`, `TẤN`, `SỐ XE`, `CAN`, `GHI CHÚ`), validate bắt buộc `bien_so` (SỐ XE), tra cứu đối soát xe với catalog `useGetVehicles`, preview danh sách bảng, hỗ trợ chọn loại xe cho tuyến ngoài, gọi mutation batch create | M |
| L-02 | FE | Cập nhật `ScheduleTable` & `OutsideRouteTable` | Thêm prop `onImport?: () => void` và nút "Import Excel" (`FileSpreadsheet` / `Upload`) cạnh nút Thêm chuyến ở header | S |
| L-03 | FE | Tích hợp vào `SchedulePage` | Khai báo state mở modal import (`isImportOpen`, `importContext: { loai_tuyen, loai_xe }`), viết handler `handleImportXeNho`, `handleImportXeLon`, `handleImportTuyenNgoai`, gắn modal và trigger refetch | S |
| L-04 | FE | Bổ sung i18n keys | Cập nhật `vi.json` và `en.json` với các nhãn: `dispatch.importModal.*`, `dispatch.schedule.importExcel`, thông báo lỗi/thành công | S |
| L-05 | QA | Kiểm thử & xác thực | Typecheck, lint, test parse với file thực tế `test_xe_nho_100926.xlsx`, kiểm tra case thiếu biển số xe | S |

---

## Thứ tự thực hiện

```
L-04 (i18n) → L-01 (ImportModal) → L-02 (Tables) → L-03 (SchedulePage) → L-05 (Verify)
```
