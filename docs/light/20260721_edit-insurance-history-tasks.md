# Tasks: Edit inline lịch sử bảo hiểm
**Ngày:** 2026-07-21
**Brief:** docs/light/20260721_edit-insurance-history-brief.md

---

| ID | Tầng | Task | Chi tiết | Effort |
|----|------|------|----------|--------|
| L-01 | FE | Thêm cột Thao tác + xác định record active mới nhất | Thêm `<TableHead className="w-24 text-center">Thao tác</TableHead>`. Tính `latestActiveId` = record có `status='active'` và `expiry_date` lớn nhất. Chỉ dòng đó hiện nút ✏️ | S |
| L-02 | FE | Inline edit state + UI | State: `editingId`, `editForm: { purchase_date, expiry_date, notes }`. Khi editing: DateInput cho 2 ngày, textarea cho notes, nút ✓ Lưu + ✕ Hủy. Import Pencil, Check, X, DateInput | S |
| L-03 | FE | Logic submit + refetch + toast | Click Lưu → validate expiry > purchase → `vehicleInsuranceApi.update(editingId, editForm)` → refetch history → `onSuccess('Đã cập nhật')`. Thêm props `onSuccess`, `onError` vào HistoryModal | S |
| L-04 | FE | InsurancePage truyền onSuccess/onError | Truyền `onSuccess`/`onError` từ InsurancePage vào InsuranceHistoryModal | S |

**Thứ tự:** L-01 → L-02 → L-03 → L-04
