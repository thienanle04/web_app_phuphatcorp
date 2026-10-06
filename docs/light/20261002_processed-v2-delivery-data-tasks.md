# Tasks: Chèn Sheet "Processed v2" vào Chức năng Xử lý Data 5 nhà
**Ngày:** 2026-10-02  
**Brief:** `docs/light/20261002_processed-v2-delivery-data-brief.md`  

---

## Danh sách công việc (LIGHT Tasks)

| ID | Tầng | Task | Chi tiết kỹ thuật | Effort |
|----|------|------|-------------------|--------|
| L-01 | FE | Triển khai logic tạo `Processed v2` | Xây dựng logic sinh sheet `Processed v2` từ sheet `Processed`: sao chép dữ liệu, đảo cột `5 nhà` (header nền `#00B050`, text trắng đậm) lên trước `CLF`, thêm cột `Gạo`, ép kiểu số cho các cột O, P, Q và các cột tải trọng, tính lại Khung giá theo tải trọng chuyến từ cột 5 nhà (tô vàng `#FFE599` + gắn Cell Note ghi khung giá cũ khi thay đổi). | M | ✅ Hoàn thành |
| L-02 | FE | Tích hợp vào Step 5 của `processDeliveryDataFromRows` | Trong `frontend/src/utils/processDeliveryData.ts`, sau khi tạo xong sheet `Processed`, gọi logic tạo sheet `Processed v2` trước khi thêm 5 sheets nhà con (`CLF`, `VFM`, `MCC`, `CLV`, `NDFC`). Đảm bảo thứ tự 8 sheets chuẩn. | S | ✅ Hoàn thành |
| L-03 | FE | Kiểm tra tương thích với Data Import | Xác nhận không làm thay đổi sheet đầu tiên (`Sheet`), bảo đảm an toàn 100% cho `POST /api/delivery-data/import` và chức năng xử lý batch trên `DeliveryImportPage.tsx`. | S | ✅ Hoàn thành |
| L-04 | QA | Kiểm thử & Xác thực chất lượng | Chạy `npm run typecheck` và `npm run lint` trên `frontend`. Kiểm thử tạo file bằng unit test/kịch bản test kiểm tra sự tồn tại của 8 sheets, thứ tự sheets, giá trị và định dạng trên `Processed v2`. | S | ✅ Hoàn thành |

---

## Thứ tự thực hiện

```
L-01 (Logic Processed v2) → L-02 (Tích hợp processDeliveryDataFromRows) → L-03 (Kiểm tra tương thích) → L-04 (QA & Test)
```
