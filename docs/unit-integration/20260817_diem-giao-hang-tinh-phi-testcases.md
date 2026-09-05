# Test cases: `diem_giao_hang_tinh_phi`

**Ngày:** 2026-08-17  
**UI Spec:** `docs/ui/20260817_diem-giao-hang-tinh-phi-ui-spec.md`

## Unit (customerService)

| ID | Case | Kết quả |
|----|------|---------|
| U-01 | create với text GHTP | INSERT param `$6` = text đã trim |
| U-02 | create GHTP = `"   "` | `$6` = `null` |
| U-03 | create omitted GHTP | field `null` trên row |
| U-04 | update với GHTP | UPDATE gồm cột mới |
| U-05 | uploadMany có GHTP | INSERT `$6` = text |

Chạy: `cd backend && npx jest src/__tests__/customerService.test.ts` — 13 passed (2026-08-17).

## QA UI (đối chiếu spec)

| ID | Check | Spec |
|----|-------|------|
| Q-01 | Cột: Điểm trả hàng → Tuyến-phường → Điểm GHTP → Tên KH | Screen 1 |
| Q-02 | Không hiện Tuyến-cũ trên list | Screen 1 |
| Q-03 | GHTP rỗng hiện "—" | Screen 1 |
| Q-04 | Search khớp GHTP | Screen 1 |
| Q-05 | Create/Edit: field sau địa chỉ, optional, max 255 | Screen 2–3 |
| Q-06 | Excel thiếu cột GHTP vẫn import | Screen 5 |
| Q-07 | Template có cột Điểm giao hàng tính phí | Screen 5 |

## Regression

- CRUD khách hàng khác (điểm trả hàng, tuyến, bốc xếp, NCC) không đổi.
- Delivery import / route-pricing lookup không đụng.
