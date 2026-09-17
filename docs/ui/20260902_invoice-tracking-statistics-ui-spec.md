# UI Spec: Tab Thống kê Theo dõi hóa đơn

**Ngày:** 2026-09-02  
**BA Doc:** `docs/ba/20260902_invoice-tracking-statistics-analysis.md`  
**Role liên quan:** `invoice_tracking.view`

---

## 1. User Journey

```
Người dùng vào trang "/invoice-tracking"
  → Trang có 2 Tab: "Danh sách ticket" (Mặc định) và "Thống kê"
  → Người dùng click vào tab "Thống kê"
  → Hiển thị thanh lọc (Từ ngày, Đến ngày, Biển số xe, Tài xế)
  → Hiển thị 5 Card KPI tổng quan (Tổng tickets, Tạo mới, Chờ duyệt, Yêu cầu bổ sung, Hoàn thành, Tỷ lệ hoàn thành)
  → Hiển thị Bảng thống kê theo từng tài xế (có phân trang/scroll và dòng Tổng cộng)
  → Người dùng thay đổi bộ lọc → Dữ liệu cập nhật mượt mà (có spinner/skeleton loading)
```

---

## 2. Screen Inventory

### Screen: Tab Thống kê trong `/invoice-tracking`
**Route:** `/invoice-tracking` (Tab 2: `Thống kê`)

#### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ [Theo dõi hóa đơn]                                          │
│ [ Tab: Danh sách ticket ]  [ Tab: Thống kê (Active) ]       │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Filter Bar ────────────────────────────────────────────┐ │
│ │ [Từ ngày: Date] [Đến ngày: Date] [Biển số] [Tài xế] [Xóa]│ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─ KPI Summary Cards (Grid 5 cols) ───────────────────────┐ │
│ │ [Tổng: 120] [Tạo mới: 15] [Chờ duyệt: 25]               │ │
│ │ [Y/C bổ sung: 8] [Hoàn thành: 72 (60%)]                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─ Bảng thống kê theo tài xế ─────────────────────────────┐ │
│ │ STT | Tài xế | Xe phụ trách | Tạo mới | Chờ duyệt |     │ │
│ │ Y/C bổ sung | Hoàn thành | Tổng | Tỷ lệ HT             │ │
│ │ ...                                                     │ │
│ │ Tổng cộng | - | 15 | 25 | 8 | 72 | 120 | 60%            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### States
| State | Trigger | UI hiển thị |
|-------|---------|-------------|
| Loading | Đang fetch | Skeleton cho KPI cards + Skeleton Table |
| Empty | Không có dữ liệu | Empty state "Không có dữ liệu thống kê cho khoảng thời gian này" |
| Error | Fetch fail | Error message + nút "Thử lại" |
| Populated | Thành công | KPI Cards + Bảng chi tiết + Dòng tổng cộng footer |

---

## 3. Component Checklist

| Component | File path | Loại | Mục đích |
|---|---|---|---|
| `InvoiceTrackingStatsTab` | `frontend/src/components/invoice-tracking/InvoiceTrackingStatsTab.tsx` | Mới | Component render toàn bộ nội dung Tab Thống kê |
| `InvoiceTrackingPage` | `frontend/src/pages/invoice-tracking/InvoiceTrackingPage.tsx` | Cập nhật | Bổ sung Tab Switcher ("Danh sách ticket" / "Thống kê") |
| `invoiceTrackingApi` | `frontend/src/api/invoiceTrackingApi.ts` | Cập nhật | Bổ sung API `getStatistics` |
| `useInvoiceTrackingStatistics` | `frontend/src/hooks/useInvoiceTracking.ts` | Cập nhật | Hook React Query nạp thống kê |

---

## 4. i18n Keys
```json
{
  "invoice_tracking": {
    "tabs": {
      "list": "Danh sách ticket",
      "statistics": "Thống kê"
    },
    "stats": {
      "title": "Thống kê hóa đơn theo tài xế",
      "kpi": {
        "total": "Tổng số ticket",
        "created": "Tạo mới",
        "pending_review": "Chờ duyệt",
        "request_supplement": "Yêu cầu bổ sung",
        "completed": "Hoàn thành",
        "completion_rate": "Tỷ lệ hoàn thành"
      },
      "table": {
        "stt": "STT",
        "driver": "Tài xế",
        "vehicles": "Xe phụ trách",
        "created": "Tạo mới",
        "pending": "Chờ duyệt",
        "supplement": "Y/C bổ sung",
        "completed": "Hoàn thành",
        "total": "Tổng cộng",
        "rate": "Tỷ lệ HT",
        "grandTotal": "TỔNG CỘNG"
      },
      "filters": {
        "dateFrom": "Từ ngày",
        "dateTo": "Đến ngày",
        "plate": "Biển số xe",
        "driver": "Tên tài xế",
        "clear": "Xóa lọc"
      },
      "empty": "Không tìm thấy dữ liệu thống kê phù hợp."
    }
  }
}
```
