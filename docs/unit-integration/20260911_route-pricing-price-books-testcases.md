# Test cases: Route pricing price books
**Ngày:** 2026-09-11
**BA:** docs/ba/20260911_route-pricing-price-books-cr.md

## Unit (service)

| Case | Expected |
|------|----------|
| createPriceBook blank name | INVALID_PRICE_BOOK_NAME |
| createPriceBook unique 23505 | DUPLICATE_PRICE_BOOK |
| deletePriceBook missing | PRICE_BOOK_NOT_FOUND |
| lookup | LOOKUP_DEFERRED |

Covered in `backend/src/__tests__/routePricingService.test.ts`.

## Manual QA (UI Spec)

- [ ] Select Bảng giá, URL `priceBookId`
- [ ] Tạo / đổi tên / xóa + confirm
- [ ] Empty / loading / error list books
- [ ] Tab Ma trận giá + Nhóm tuyến + Quản lý giá theo book
- [ ] Tab Kỳ không phụ thuộc book; copy “mọi bảng giá”
- [ ] Lookup không dùng trên UI
