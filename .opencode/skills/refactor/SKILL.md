---
name: refactor
description: Workflow cải thiện code quality cho Web App mà không thay
  đổi behavior. Invoke khi user muốn "clean up code", "tách function quá dài",
  "cải thiện readability", "giảm duplication", hoặc "tối ưu performance".
  KHÔNG dùng khi có thay đổi business logic — dùng feature-dev thay thế.
  Dừng 2 lần: sau khi xác định scope và sau khi lên plan.
mode: subagent
temperature: 0.1
steps: 7
---

# Workflow: Refactor
# Web App — Scope → Plan → Refactor → Verify → Document

## Tổng quan

```
User mô tả vùng code cần refactor
            ↓
[PHASE 1] Scope & Assessment   → xác định phạm vi, rủi ro, mục tiêu rõ ràng
            ↓ ✋ dừng confirm
[PHASE 2] Refactor Plan        → liệt kê từng thay đổi cụ thể trước khi làm
            ↓ ✋ dừng confirm
[PHASE 3] Snapshot tests       → capture behavior hiện tại trước khi đổi
            ↓ tự động
[PHASE 4] Refactor             → thực hiện từng thay đổi nhỏ, tuần tự
            ↓ tự động
[PHASE 5] Verify               → chạy toàn bộ test, so sánh behavior
            ↓ tự động
[PHASE 6] Document             → cập nhật know-how nếu cần
            ↓ tự động
         Báo cáo kết quả
```

**Dừng 2 lần:** Sau Phase 1 (confirm scope) và Phase 2 (confirm plan).
**Escape hatch:** Test fail sau refactor mà không fix được trong 3 lần → revert toàn bộ và báo cáo.
**Nguyên tắc bất biến:** Behavior trước và sau refactor phải hoàn toàn giống nhau.

---

## PHASE 1 — Scope & Assessment

### Input
Nhận mô tả từ user: file/function cần refactor, lý do, mục tiêu mong muốn.

Nếu chưa rõ, hỏi tối đa 2 câu:
- "File hoặc function cụ thể nào cần refactor?"
- "Mục tiêu là gì — readability, giảm duplication, tách module, hay performance?"

### Thực hiện

**Bước 0 — Đọc context**
- `.opencode/knowhow/know-how.md` → project structure, hiểu vị trí file trong hệ thống
- `.opencode/knowhow/coding_convention.md` → target state sau refactor phải đạt convention này
- `.opencode/knowhow/lessons-learned.md` → tránh lặp lại vấn đề đã gặp

**Bước 1 — Đọc code hiện tại**

Đọc toàn bộ file/function cần refactor và các file phụ thuộc (import/export).

**Bước 2 — Phân loại refactor**

| Loại | Ví dụ | Rủi ro |
|------|-------|--------|
| Extract function | Tách đoạn code dài thành function nhỏ | Thấp |
| Rename | Đổi tên biến/function cho rõ nghĩa hơn | Thấp |
| Remove duplication | Gộp code lặp lại thành helper | Trung bình |
| Restructure module | Tách file lớn thành nhiều file nhỏ | Cao |
| Performance | Tối ưu query, giảm re-render | Cao |
| Type improvement | Thêm/sửa TypeScript types | Thấp |

**Bước 3 — Đánh giá rủi ro**

```
Thấp   — thay đổi trong 1 file, không ảnh hưởng public API
Trung  — thay đổi interface/export, nhiều file dùng
Cao    — thay đổi DB query, async flow, hoặc shared utility
```

**Bước 4 — Xác định boundary**

```
Trong scope:   [Những gì SẼ thay đổi]
Ngoài scope:   [Những gì KHÔNG được đụng vào]
Files liên quan: [Files có thể bị ảnh hưởng gián tiếp]
```

### Checkpoint 1 ✋

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PHASE 1 HOÀN TẤT — Scope xác định
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mục tiêu:    [Readability / Dedup / Performance / ...]
Loại:        [Extract / Rename / Restructure / ...]
Rủi ro:      [Thấp / Trung bình / Cao]
Trong scope: [Danh sách file/function]
Ngoài scope: [Danh sách không được đụng]

Bạn có muốn:
A) Tiếp tục — lên refactor plan chi tiết
B) Điều chỉnh scope trước
C) Dừng tại đây

Trả lời A, B, hoặc C?
```

---

## PHASE 2 — Refactor Plan

### Thực hiện tự động

Lên danh sách **từng thay đổi cụ thể** sẽ thực hiện, theo thứ tự an toàn nhất (thay đổi ít rủi ro trước):

```markdown
### Refactor Plan: [Tên mô tả ngắn]
**File(s):** [danh sách file]
**Mục tiêu:** [1 câu]

| Bước | Thay đổi | File | Rủi ro |
|------|----------|------|--------|
| R-01 | [Cụ thể — vd: tách `calculateTotal` ra file riêng] | [file] | Thấp |
| R-02 | [Cụ thể — vd: rename `data` → `invoiceList`] | [file] | Thấp |
| R-03 | [Cụ thể — vd: gộp 3 helper functions trùng lặp] | [file] | Trung |

**Không thay đổi:**
- [ ] Function signatures của public API
- [ ] Response format của API endpoints
- [ ] Database schema
- [ ] Business logic và điều kiện rẽ nhánh
```

### Checkpoint 2 ✋

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 PHASE 2 HOÀN TẤT — Plan sẵn sàng
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tổng số thay đổi: [X] bước
Ước tính:         [Thấp / Trung / Cao] rủi ro tổng thể

Bạn có muốn:
A) Bắt đầu refactor (tự động đến khi xong)
B) Điều chỉnh plan
C) Dừng tại đây

Trả lời A, B, hoặc C?
```

---

## PHASE 3 — Snapshot Tests

### Thực hiện tự động

Trước khi thay đổi bất kỳ dòng code nào, capture behavior hiện tại bằng tests.

Dùng skill `test-qa` để viết snapshot tests cho các function/API trong scope:

```typescript
describe('Snapshot: [Tên function/endpoint] — trước refactor', () => {
  it('should return [output] given [input]', async () => {
    // Không test logic — chỉ capture input/output hiện tại
    // Test này phải pass cả trước và sau refactor
  });
});
```

Chạy để confirm tất cả pass trước khi refactor:
```bash
cd backend && npm run test
cd frontend && npm run test
```

Nếu test hiện tại đã fail → **dừng, báo cáo user** — cần fix bug trước, dùng `bug-fix` workflow.

Báo cáo:
```
📸 PHASE 3 HOÀN TẤT — Snapshot tests pass
→ Bắt đầu Phase 4: Refactor...
```

---

## PHASE 4 — Refactor

### Thực hiện tự động

Thực hiện **tuần tự từng bước** trong plan, từ R-01 đến R-N.

**Sau mỗi bước:**
```bash
cd backend && npm run lint && npm run build   # nếu là backend
cd frontend && npm run lint && npm run typecheck  # nếu là frontend
```

Nếu lint/build fail → fix ngay bước đó, không chuyển bước tiếp theo.

**Quy tắc khi refactor:**
- Mỗi bước là một thay đổi nhỏ, độc lập — có thể revert từng bước nếu cần
- Không thêm feature mới dù thấy cơ hội
- Không sửa bug gặp phải trong quá trình — ghi note lại để dùng `bug-fix` sau
- Giữ nguyên behavior: cùng input → cùng output
- Tuân thủ `.opencode/knowhow/coding_convention.md`

**Nếu phát hiện cần thay đổi ngoài scope đã confirm:**
→ Dừng, hỏi user trước khi tiếp tục. Không tự mở rộng scope.

Báo cáo tiến độ sau mỗi bước:
```
✅ R-01 hoàn tất: [Mô tả thay đổi]
✅ R-02 hoàn tất: [Mô tả thay đổi]
...
🔧 PHASE 4 HOÀN TẤT — Refactor xong
→ Bắt đầu Phase 5: Verify...
```

---

## PHASE 5 — Verify

### Thực hiện tự động

Dùng skill `test-qa` để verify behavior không thay đổi:

**Bước 1 — Chạy toàn bộ test suite**
```bash
cd backend && npm run test
cd frontend && npm run test
```

**Bước 2 — So sánh với snapshot**

Tất cả snapshot tests từ Phase 3 phải pass. Nếu fail → behavior đã thay đổi, cần xem lại.

**Bước 3 — Lint & type check toàn bộ**
```bash
cd backend && npm run lint && npm run build
cd frontend && npm run lint && npm run typecheck
```

**Nếu có test fail sau refactor:**
- Lần 1: Đọc lại diff, tìm chỗ vô tình thay đổi behavior
- Lần 2: Revert bước gây ra fail, thực hiện lại cẩn thận hơn
- Lần 3: **Revert toàn bộ** về trạng thái ban đầu, báo cáo user chi tiết

**Checklist verify:**
```
- [ ] Tất cả tests pass (không có test nào bị skip)
- [ ] Lint pass không có warning mới
- [ ] TypeScript không có lỗi mới
- [ ] Snapshot tests pass — behavior không đổi
- [ ] Không có TODO/FIXME mới được thêm vào
```

Báo cáo:
```
✅ PHASE 5 HOÀN TẤT — Verify pass, behavior không thay đổi
→ Bắt đầu Phase 6: Document...
```

---

## PHASE 6 — Document

### Thực hiện tự động

Cập nhật tài liệu nếu refactor thay đổi cấu trúc:

- Nếu tách file, đổi tên file, thay đổi module structure → cập nhật `know-how.md`
- Nếu refactor ảnh hưởng đến cách một feature hoạt động → cập nhật `system-features.md`
- Nếu phát hiện pattern tốt/xấu trong quá trình → ghi vào `lessons-learned.md`

```markdown
## Refactor: [Tên ngắn gọn]
- **Ngày:** YYYY-MM-DD
- **Phạm vi:** [File/module đã refactor]
- **Lý do:** [Vì sao cần refactor]
- **Thay đổi chính:** [Tóm tắt những gì đã làm]
- **Không thay đổi:** Behavior, API contract, DB schema
- **Lưu ý:** [Điều gì cần biết nếu đọc code này lần sau]
```

---

## Báo cáo cuối

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ REFACTOR HOÀN TẤT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mục tiêu:     [Readability / Dedup / Performance / ...]
Files đã sửa:
  - [file 1]: [thay đổi gì]
  - [file 2]: [thay đổi gì]

Tests:        [X] pass, 0 fail
Behavior:     ✅ không thay đổi (snapshot tests pass)
Docs:         [know-how.md / lessons-learned.md] đã cập nhật

→ Nhớ commit với message: refactor([scope]): [mô tả ngắn]
→ Bugs phát hiện trong quá trình (chưa fix): [danh sách nếu có]
```

---

## Quy tắc bất biến

- **KHÔNG thay đổi behavior** — refactor chỉ là cosmetic/structural
- **KHÔNG thêm feature** dù thấy cơ hội trong lúc refactor
- **KHÔNG fix bug** gặp phải — ghi note, dùng `bug-fix` workflow sau
- **KHÔNG mở rộng scope** mà không có confirm của user
- **Snapshot tests là bắt buộc** trước khi bắt đầu refactor bất kỳ thứ gì
- **Escape hatch:** Test fail không fix được sau 3 lần → revert toàn bộ, báo cáo user