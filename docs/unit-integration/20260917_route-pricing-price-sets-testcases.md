# Test cases — bộ giá

Ngày: 2026-09-17

## Unit

| Case | Kỳ vọng |
|------|---------|
| Khung là tập con bộ active (cả hai chiều) | `priceSetsConflict` true |
| Cùng bậc, khác cờ pallet | bộ không pallet là tập con bộ có pallet → conflict |
| Khoảng khác | không conflict |
| Fingerprint weight + pallet + min | `by_weight\|pallet:1\|w:0-2.5:chuyen\|w:2.5-8:tan:min5` |
| Giá 0 / id bậc lạ | `PRICE_NOT_POSITIVE` / `TIER_NOT_IN_SET` |
| Chỉ gửi bậc có giá | không sinh record bậc trống; range/min copy từ bộ |
| Pallet khi bộ không có slot / pallet 0 | `PALLET_NOT_IN_SET` / `PRICE_NOT_POSITIVE` |
| Tạo bộ khoảng chồng / nhãn truck trống | `INVALID_TIERS` trước khi mở transaction |
| Hở chuỗi trips lúc tạo bộ | không `INVALID_TIERS` |
| Chồng khoảng khi lưu giá nhóm | không check trên giá nhóm; check trên bộ |
| Nhãn truck trống / trùng | `INVALID_TIERS` trên bộ, không trên lúc lưu giá |
| Thêm bậc đã có trên kỳ đang sửa | `INVALID_TIERS` |
| Thêm bậc chưa có trên kỳ giữa | insert kỳ này `is_manual_adjusted=true`; kỳ sau insert giá `roundToThousands(prev×1.1)` cờ false |
| Thêm pallet khi bộ có slot, kỳ chưa có | kỳ này `pallet_manual_adjusted=true`; kỳ sau pallet scale %, cờ false |
| Thêm pallet khi bộ không có slot | `PALLET_NOT_IN_SET` |
| Lookup | 501 `LOOKUP_DEFERRED` |
