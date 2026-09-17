---
name: mobile-responsive
description: Chuyên biệt audit, thiết kế và chuyển đổi UI sang Mobile Responsive cho hệ thống PhuPhatCorp (React 19 + Tailwind CSS + Lucide). Xử lý triệt để Sidebar Drawer, Bảng dữ liệu nhiều cột (Table -> Card/Scroll), Filter toolbar, Modal/Bottom sheet, Form và Touch target. Dùng khi user yêu cầu "làm mobile responsive", "tối ưu giao diện điện thoại", "fix vỡ giao diện trên mobile", "responsive UI".
---

# Skill: Mobile Responsive UI Specialist

## Mô tả
Skill này chuyên trách phân tích, thiết kế giải pháp và trực tiếp refactor/implement giao diện Web App PhuPhatCorp để hiển thị mượt mà, trực quan và tiện dụng trên mọi kích thước màn hình (Mobile: `< 640px`, Tablet: `640px - 1024px`, Desktop: `> 1024px`).

---

## 🎯 Breakpoints Chuẩn (Tailwind CSS v3)

| Ký hiệu | Độ rộng viewport | Thiết bị mục tiêu | Hành vi UI chính |
|---------|------------------|-------------------|-------------------|
| **Mobile (`< sm`)** | `< 640px` | Smartphone dọc | 1 cột, Drawer sidebar, Table dạng Card hoặc Scroll indicator, Bottom sheet modal, full-width inputs |
| **Tablet (`sm -> md`)**| `640px - 768px` | Smartphone ngang, Tablet nhỏ | 1-2 cột, Collapsed sidebar hoặc drawer, modal dạng popup co giãn |
| **Laptop (`md -> lg`)**| `768px - 1024px` | Tablet lớn, Laptop nhỏ | Sidebar thu gọn (icon-only), bảng bắt đầu hiển thị đầy đủ cột |
| **Desktop (`xl+`)** | `> 1280px` | Màn hình lớn | Đầy đủ sidebar, multi-column grid, table rộng |

---

## 🧭 Workflow 5 Bước Thực Hiện

```
Bước 1: AUDIT           → Soát layout, table, modal, toolbar, font-size trên mobile
Bước 2: XÁC ĐỊNH PATTERN → Chọn pattern phù hợp cho từng thành phần UI
Bước 3: IMPLEMENT       → Refactor theo mobile-first Tailwind classes
Bước 4: TOUCH & A11Y    → Tối ưu touch target (>=44px), chống auto-zoom iOS (>=16px)
Bước 5: VERIFICATION    → Test trên các viewport giả lập & check lint/build
```

---

## 📐 Quy Chuẩn & Patterns Cho Các Thành Phần UI

### 1. Main Layout & Navigation (Sidebar -> Mobile Drawer)

- **Vấn đề:** Desktop sidebar chiếm 64-256px cố định, làm mất không gian trên mobile.
- **Giải pháp:**
  - Trên Mobile (`< md`): Ẩn sidebar cố định. Thêm **Top Navigation Bar** với nút Hamburger Menu, Page Title, Theme Toggle, Avatar.
  - Khi bấm Hamburger: Mở **Slide-over Drawer** từ bên trái kèm Backdrop mờ (`bg-black/50`) và khóa cuộn trang (`body overflow: hidden`).
  - Auto-close drawer khi người dùng bấm vào bất kỳ NavLink nào hoặc click backdrop.

```tsx
// Pattern: Responsive MainLayout Drawer
<div className="flex h-screen bg-neutral-50 dark:bg-neutral-950">
  {/* Mobile Top Bar */}
  <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 z-30 px-4 flex items-center justify-between">
    <button onClick={() => setMobileOpen(true)} className="p-2 text-neutral-600 dark:text-neutral-300">
      <Menu className="w-6 h-6" />
    </button>
    <span className="font-semibold text-neutral-900 dark:text-neutral-100">PhuPhatCorp</span>
    <ThemeToggle />
  </header>

  {/* Backdrop Mobile */}
  {mobileOpen && (
    <div 
      className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
      onClick={() => setMobileOpen(false)}
    />
  )}

  {/* Sidebar / Mobile Drawer */}
  <aside className={cn(
    "fixed md:static inset-y-0 left-0 z-50 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-transform duration-200 ease-in-out",
    mobileOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0",
    isCollapsed ? "md:w-16" : "md:w-64"
  )}>
    {/* Sidebar content */}
  </aside>

  {/* Main content container with top padding on mobile */}
  <main className="flex-1 overflow-auto pt-14 md:pt-0">
    <Outlet />
  </main>
</div>
```

---

### 2. Xử lý Bảng Dữ Liệu Lớn (Accounting / Logistics Tables)

Hệ thống có nhiều bảng 10-20 cột (bảng dầu, điều xe, đối chiếu công nợ, đăng kiểm,...). Sử dụng 2 pattern sau:

#### Pattern A: Table-to-Card Switch (Khuyến nghị cho danh mục CRUD, xe, tài xế, khách hàng)
- Trên mobile (`< md`): Ẩn thẻ `<table>`, render danh sách các **Cards** tóm tắt thông tin quan trọng nhất kèm Badge trạng thái và Action menu.
- Trên desktop (`>= md`): Render `<table>` chuẩn.

```tsx
// Pattern: Table (Desktop) + Card View (Mobile)
<div className="w-full">
  {/* Mobile Card List */}
  <div className="grid grid-cols-1 gap-3 md:hidden">
    {data.map((item) => (
      <div key={item.id} className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm space-y-2">
        <div className="flex justify-between items-start">
          <div className="font-medium text-neutral-900 dark:text-neutral-100">{item.code}</div>
          <Badge status={item.status}>{item.statusText}</Badge>
        </div>
        <div className="text-sm text-neutral-500 space-y-1">
          <div><span className="font-medium text-neutral-700 dark:text-neutral-300">Khách:</span> {item.customerName}</div>
          <div><span className="font-medium text-neutral-700 dark:text-neutral-300">Biển số:</span> {item.licensePlate}</div>
          <div><span className="font-medium text-neutral-700 dark:text-neutral-300">Số tiền:</span> {formatCurrency(item.amount)}</div>
        </div>
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(item)}>Sửa</Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(item)}>Xóa</Button>
        </div>
      </div>
    ))}
  </div>

  {/* Desktop Table */}
  <div className="hidden md:block overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
    <Table>{/* table headers & cells */}</Table>
  </div>
</div>
```

#### Pattern B: Responsive Horizontal Scroll with Shadow Indicators (Cho bảng đối chiếu / ma trận giá)
- Đặt `overflow-x-auto` trên container kèm `min-w-[800px]` cho `table`.
- Cột STT hoặc Cột Thao Tác (Actions) có thể sticky: `sticky left-0 bg-white dark:bg-neutral-900 z-10`.
- Thêm hint UI text nhỏ cho mobile: *"Vuốt ngang để xem thêm thông tin →"*.

---

### 3. Toolbar, Bộ Lọc & Tìm Kiếm (Filter Bars)

- **Desktop:** `flex flex-row items-center justify-between gap-4`.
- **Mobile:**
  - Stack dọc: `flex flex-col sm:flex-row gap-3`.
  - Ô tìm kiếm chiếm `w-full sm:w-64`.
  - Các nút action chính (Thêm mới, Xuất Excel, Import) xếp đều hoặc `grid grid-cols-2 sm:flex`.
  - Nếu có >3 filter dropdown: Tạo nút `Bộ lọc nâng cao` mở Bottom Sheet / Accordion co giãn thay vì dàn trải làm choán màn hình.

---

### 4. Modals & Forms

- **Modal Container:**
  - Mobile: `w-full max-sm:m-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:max-h-[90vh] max-sm:fixed max-sm:bottom-0`.
  - Giữ header và footer action luôn **sticky** để nút "Lưu" / "Hủy" không bị trôi khi form dài:
    - Header: `sticky top-0 bg-white dark:bg-neutral-900 z-10`.
    - Footer: `sticky bottom-0 bg-white dark:bg-neutral-900 p-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col-reverse sm:flex-row gap-2 justify-end`.
- **Form Grid:**
  - Luôn chuyển `grid-cols-2` hoặc `grid-cols-3` thành `grid-cols-1 sm:grid-cols-2`.
- **Input Fields & iOS Zooming:**
  - Font chữ input trên mobile tối thiểu **16px** (`text-base sm:text-sm`) để ngăn Safari iOS tự động phóng to màn hình khi focus.
  - Chiều cao touchable tối thiểu 44px (`h-11 sm:h-10`).

---

### 5. Tabs & Thống Kê / Dashboard Widgets

- **Tabs Header:**
  - Sử dụng `overflow-x-auto flex-nowrap scrollbar-none` kèm `whitespace-nowrap` để người dùng có thể vuốt ngang tab dễ dàng.
- **Thống kê / Metric Cards:**
  - Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`.
- **Recharts:**
  - Đảm bảo `ResponsiveContainer` có `width="100%"` và đặt `height={280}` hoặc `minHeight={250}` cố định thay vì tỷ lệ % không xác định.

---

## 📋 Checklist Rà Soát Mobile Responsive (DoD)

Trước khi xác nhận hoàn tất responsive cho 1 màn hình/tính năng, kiểm tra các tiêu chí sau:

- [ ] **Không có thanh cuộn ngang ngoài ý muốn (Horizontal Page Overflow):** Toàn bộ body/main layout không bị vỡ hoặc scroll ngang layout.
- [ ] **Navigation & Menu:** Sidebar mở/đóng mượt mà qua drawer trên mobile; đóng khi click backdrop hoặc chọn route.
- [ ] **Touch Target Size:** Các nút bấm, icon button, checkbox có kích thước chạm tối thiểu `44x44px` (hoặc có padding hỗ trợ).
- [ ] **Input Font Size:** Các thẻ `<input>`, `<select>`, `<textarea>` có class `text-base sm:text-sm` để tránh lỗi zoom trên iOS.
- [ ] **Bảng & Danh sách:** Không bị tràn màn hình; chuyển đổi sang card hoặc có container cuộn ngang mượt mà.
- [ ] **Modals & Drawers:** Vừa vặn trên màn hình điện thoại (đặc biệt là khi bàn phím ảo hiển thị), scrollable body và sticky footer.
- [ ] **Spacings:** Padding trang được co giãn hợp lý (`p-4 sm:p-6 lg:p-8`).
- [ ] **Text Truncation:** Các chuỗi dài (email, tên tuyến, biển số) có `truncate` hoặc xuống dòng tự nhiên, không đẩy lệch bố cục.
- [ ] **Typecheck & Build:** Chạy `cd frontend && npm run typecheck && npm run build` thành công, không phát sinh lỗi.
