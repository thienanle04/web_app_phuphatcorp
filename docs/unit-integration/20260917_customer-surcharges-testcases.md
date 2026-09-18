# Test cases: Phụ phí giao hàng

**Ngày:** 2026-09-17  
**BA:** `docs/ba/20260917_customer-surcharges-analysis.md`  
**UI:** `docs/ui/20260917_customer-surcharges-ui-spec.md`

## Unit

- [x] Rule chỉ vùng chồng rule chỉ khung xe thì `conditionsConflict` = true
- [x] Rule cụ thể hơn được sống cùng wildcard
- [x] `pickFee` lấy đơn giá 0, không coi là thiếu rule
- [x] Không khớp vùng thì `NO_RULE`, rate null
- [x] Lookup khớp điểm vẫn trả trường điểm khi giá lấy từ đại lý
- [x] Điểm còn rule tỉnh thì lookup nội thành không rơi về đại lý
- [x] Hai điểm trùng tên và địa chỉ, không gửi mã → `AMBIGUOUS`, không query phí
- [x] Mã khoảng trắng coi như không gửi
- [x] Mã khớp một trong hai điểm trùng địa chỉ → `MATCHED` điểm đó
- [x] Mã không khớp điểm nào → `NO_POINT`, phí đại lý
- [x] Hai điểm cùng mã → `AMBIGUOUS`, không query phí
- [x] Create khách không ghi `boc_xep` từ payload
- [x] `customerService` suite cũ vẫn pass

Chạy: `cd backend && npx jest src/__tests__/customerSurchargeService.test.ts src/__tests__/customerService.test.ts`  
Full suite: 147 passed.

## Regression UI (đối chiếu spec, chưa bấm trên trình duyệt)

- [x] Route `/route-pricing/surcharges` và mục menu không gắn `priceBookId`
- [x] Form thêm có combobox tên, radio phạm vi, đơn vị read-only
- [x] Tra cứu là text tự do, vùng và khung xe bắt buộc, mã nhà cung cấp không bắt buộc
- [x] Ngừng là modal, không `window.confirm`
- [x] Bảng khách bỏ cột bốc xếp; tên là link khi có quyền giá cước
- [x] Form và upload khách không gửi `boc_xep`
- [ ] Chưa chạy tay happy path trên UI đã đăng nhập

## Chưa viết — nhiều tên và xóa cứng

- [x] Tạo hai tên, một transaction, cả hai là giá đại lý cùng bộ số
- [x] Một tên trong batch đã có phụ phí đang mở cùng điều kiện: không insert tên nào, `failures` đủ tên theo thứ tự
- [ ] Chồng ngày và tên không còn active trong cùng batch: rollback, HTTP 409
- [x] Hai tên và `customer_id`: 400 `POINT_NOT_ALLOWED_FOR_BATCH`
- [ ] Một tên vẫn tạo được giá điểm
- [x] Xóa phụ phí đang mở không cập nhật phụ phí cũ
- [ ] Xóa giá điểm hết bản ghi hiệu lực cùng loại: lookup rơi về đại lý
- [ ] Xóa thành công ghi audit; tạo / đổi giá / ngừng không ghi
- [ ] Form không có chọn tất cả; từ hai tên không hiện điểm trả
- [ ] Confirm xóa dùng câu Screen 9, không chữ “dòng”
