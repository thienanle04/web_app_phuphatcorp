# Test cases: Route pricing `by_truck`

**Ngày:** 2026-09-12  
**BA:** `docs/ba/20260912_route-pricing-by-truck-analysis.md`

## Unit (service)

| ID | Case | Expected |
|----|------|----------|
| T-01 | Mix chuyến/tấn + nhãn `≤` và `<=` | Không `INVALID_TIERS` ở validate |
| T-02 | Nhãn chỉ whitespace | `INVALID_TIERS` |
| T-03 | Hai nhãn trim trùng | `INVALID_TIERS` |
| T-04 | `min_billable_ton` > 0 | `INVALID_TIERS` |
| T-05 | `price` = 0 | `INVALID_TIERS` |
| T-06 | `truckSchemaKey` đảo thứ tự / đổi `0,5` vs `0.5` | Schema khác nhau; không merge subset |
| T-07 | Weight overlap / trips chain / lookup deferred | Regression giữ nguyên |

## UI Spec (manual / browser)

| ID | Screen | Check |
|----|--------|-------|
| U-01 | Modal | Radio Theo loại xe; 1 dòng trống; hint; thêm/xóa ≥1 |
| U-02 | Đổi mode | Confirm xóa bậc |
| U-03 | Card | Badge Theo loại xe; cột Loại xe = text; không hiện 0 tấn |
| U-04 | Ma trận | Section giữa weight và trips; không render khi rỗng |
