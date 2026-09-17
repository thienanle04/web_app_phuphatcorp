# Brief: Edit inline lịch sử bảo hiểm
**Ngày:** 2026-07-21
**Loại:** LIGHT

---

## Tóm tắt

Cho phép edit **inline** ngay trong InsuranceHistoryModal — không mở modal riêng. Chỉ record **active mới nhất** (status = 'active', expiry_date cao nhất) mới có nút edit. Các record khác (superseded, expired, deleted) chỉ hiển thị read-only.

Khi click edit → dòng đó chuyển sang edit mode: purchase_date, expiry_date thành DateInput, notes thành textarea, hiện nút Lưu/Hủy. Sau khi lưu → refetch history list.

## Files ảnh hưởng

| File | Thay đổi |
|------|----------|
| `frontend/src/components/vehicle-data/InsuranceHistoryModal.tsx` | Thêm cột Thao tác, inline edit state, DateInput cho ngày, textarea cho notes, gọi API update, refetch |

## API đã có sẵn

- `PUT /api/vehicle-insurances/:id` — cập nhật purchase_date, expiry_date, notes
- `GET /api/vehicle-insurances?vehicle_id=X&status=all` — refetch history

→ **Không cần thay đổi backend.**

## UI notes

- Thêm cột "Thao tác" (w-24) sau cột "File"
- Chỉ record active mới nhất có nút ✏️ (Pencil), các dòng khác không có nút
- Click ✏️ → dòng chuyển thành edit mode:
  - Ngày mua → DateInput
  - Ngày hết hạn → DateInput
  - Ghi chú → textarea (rows=1)
  - Hiện nút ✓ (Check) Lưu + ✕ (X) Hủy
- Validate FE: expiry_date > purchase_date
- Submit → PUT API → refetch history → toast success
- Props HistoryModal cần thêm: `onSuccess: (message: string) => void`, `onError: (message: string) => void`

## Rủi ro

- **Thấp:** API update đã có sẵn, chỉ cần gọi đúng
- **Thấp:** Xác định "active mới nhất" = record có status='active' và expiry_date lớn nhất trong danh sách
