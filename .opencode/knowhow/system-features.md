---
description: Business logic, feature flows, và role access của dự án PhuPhatCorp. Agents đọc file này khi cần hiểu "cái này hoạt động thế nào". Để biết "cái gì đang có" (schema, endpoints, structure) → đọc know-how.md.
---

# System Features — PhuPhatCorp

## 1. Authentication & Authorization

### 1.1 User Roles & Permissions (RBAC)

Hệ thống dùng **RBAC** (Role-Based Access Control) — mỗi user gắn 1 role, role có nhiều permissions.

**Default roles:**

| Role | Code | Loại | Permissions mặc định |
|------|------|------|----------------------|
| Admin | ADMIN | system | Tất cả — không thể deactivate |
| Kế toán | ACCOUNTANT | system | dashboard.view, delivery_data.view/manage, reports.view |
| Xem | VIEWER | system | dashboard.view, delivery_data.view |

**Permission codes:**

| Code | Mô tả |
|------|-------|
| dashboard.view | Xem Dashboard |
| delivery_data.view | Xem Delivery Data |
| delivery_data.manage | Quản lý Delivery Data |
| users.view | Xem Users |
| users.manage | Quản lý Users |
| reports.view | Xem Báo cáo |
| roles.view | Xem Roles |
| roles.manage | Quản lý Roles |
| permissions.manage | Quản lý Permissions |
| transport.view | Xem dữ liệu vận tải (trip codes, xe, tài xế) |
| transport.manage | Quản lý dữ liệu vận tải (CRUD trip codes, xe, tài xế) |
| dispatch.view | Xem bảng điều phối xe |
| dispatch.manage | Tạo/xóa lịch điều phối xe |
| route_pricing.view | Xem giá theo tuyến |
| route_pricing.manage | Quản lý giá theo tuyến |

**Cơ chế enforcement:**
- JWT payload chứa `roleId` và `permissions: string[]`
- Mỗi request: `authenticateToken` middleware async check `role.is_active` trong DB
- Nếu role bị deactivate → 403 Forbidden ngay lập tức (không cần logout)
- `requirePermission(code)` middleware kiểm tra `req.user.permissions.includes(code)`
- ADMIN: `AuthContext.hasPermission()` luôn trả `true` ở frontend (admin không qua permission check)

**Admin role bất biến:**
- `is_system=true` → không thể deactivate
- Permission matrix: ADMIN checkboxes readonly, luôn hiển thị checked

**Deactivate role flow:**
```
Admin deactivate role
  → BE: kiểm tra is_system → block nếu true
  → FE: DeactivateRoleDialog fetch user count
    → 0 users: auto-deactivate không hiện dialog
    → >0 users: hiện warning với số users bị ảnh hưởng
  → User confirm → PATCH /api/roles/:id/toggle
  → Tất cả users có role này → mất hết permissions ngay lập tức
  → Users đó chỉ có thể dùng lại khi được gán role mới
```

Role được lưu trong `users.role_id` (FK), gắn vào JWT payload. Mỗi user chỉ có **1 role**. Column `users.role` (VARCHAR) vẫn giữ để backward compat với code cũ.

### 1.2 Registration Flow

```
User → RegisterPage (full_name, username, email, password, confirmPassword)
  → React Hook Form + Yup validation
  → POST /api/auth/register
    → Backend: check username unique (409 "Username already taken") → check email unique (409 "Email already registered")
    → hash password (bcrypt, 10 rounds)
    → INSERT users (role mặc định: VIEWER)
    → Return { user, accessToken } + set refreshToken cookie
  → Redirect /login
  → Success message: "Đăng ký thành công!"
```

### 1.3 Login Flow

```
User → LoginPage (username, password)
  → React Hook Form + Yup validation
  → Gọi useAuth().login(username, password)
    → AuthContext.login() → authApi.login()
      → POST /api/auth/login
        → Backend: findUserByUsername → bcrypt.compare
        → OK: generateAccessToken + generateRefreshToken
          → Return { user, accessToken } (body)
          → Set refreshToken cookie (httpOnly, 7d)
        → Fail: return 401 "Invalid credentials"
      → Lưu accessToken vào localStorage
      → setUser(response.user) → Zustand store
      → Return user
    → useNavigate('/')
  → DashboardPage render
```

### 1.4 Session Persistence

- `AuthProvider` mount → kiểm tra `localStorage.access_token` → gọi `GET /api/auth/me`
  - Thành công → `setUser(userData)`, `isAuthenticated = true`
  - Thất bại → xóa tokens, `isAuthenticated = false`
- Nếu chưa đăng nhập → `ProtectedRoute` redirect `/login`

### 1.5 Token Refresh Flow

```
1. Access token hết hạn (15 phút)
2. Request tới endpoint protected → 403 Invalid token
3. Frontend: axios interceptor bắt 403 → redirect /login
   (Note: refresh flow chưa implement ở frontend, cần manual re-login)
```

### 1.6 Logout Flow

```
User click logout (MainLayout header)
  → useAuth().logout()
    → POST /api/auth/logout → clear refreshToken cookie
    → Zustand logout() → xóa localStorage tokens + set user=null
    → navigate('/login')
```

## 2. Protected Routes

| Route | Role required | Behavior |
|-------|--------------|----------|
| / | Any authenticated | Dashboard |
| /accounting | Any authenticated | Placeholder (chưa impl) |
| /reports | Any authenticated | Placeholder (chưa impl) |
| /settings | Any authenticated | Placeholder (chưa impl) |
| /users | users.view | User management |
| /roles | roles.view | Role management |
| /permissions | permissions.manage | Permission matrix |
| /login | None (redirect nếu đã login) | — |
| /register | None (redirect nếu đã login) | — |

**ProtectedRoute logic:**
1. `isLoading === true` → show spinner
2. `isAuthenticated === false` → `<Navigate to="/login" replace />`
3. `isAuthenticated === true` → `<Outlet />` (render nested route)

## 3. API Data Flow

### 3.1 Request Lifecycle

```
Frontend (React)
  → axiosClient.request()
    → Request interceptor: gắn Authorization: Bearer <token>
    → axios.post/get/etc(url, data)
      → Backend: validate → authenticateToken → controller → service → DB
      → Response: { success, message, data }
    → Return response.data (axios envelope)
  → authApi function: unwrap response.data.data (double envelope)
  → Return raw data
```

### 3.2 Error Handling

| Lỗi | Backend trả | Frontend xử lý |
|------|-------------|----------------|
| Validation fail | 400 + error list | Hiển thị inline error dưới field |
| Email đã tồn tại | 409 Conflict | Hiển thị alert "Email already registered" |
| Sai credentials | 401 Unauthorized | Hiển thị alert "Invalid credentials" |
| Token hết hạn | 403 Forbidden | Redirect /login, xóa tokens |
| Không có token | 401 Unauthorized | Redirect /login |
| Không đủ quyền | 403 Forbidden | Hiển thị alert "Insufficient permissions" |
| Server error | 500 | Hiển thị alert generic |

### 3.3 Form Validation (Frontend)

- **Library:** React Hook Form + Yup
- Validation chạy `onChange` + `onBlur` + `onSubmit`
- Mỗi field hiển thị error message bên dưới input
- Submit button disabled khi form invalid
- Submit button show loading spinner khi đang xử lý

## 4. UI/UX Patterns

### 4.1 Layout

**AuthLayout** — cho /login, /register
- Logo + brand name center-top
- Form card centered vertically + horizontally
- Background: `bg-neutral-50`

**MainLayout** — cho tất cả protected routes
- Left sidebar (w-64): logo, nav links, user info + logout
- Right content: `<Outlet />` (scrollable)
- Nav active state: `bg-neutral-100`

### 4.2 Component Usage

```
Trang kế toán (khi implement):
  Container > Card > CardHeader ("Danh sách phiếu")
    > CardContent
      > Table > TableHeader > TableRow > TableHead("STT")/TableHead("Ngày")...
        > TableBody > TableRow > TableCell(data)

Form tạo mới:
  Modal > Card > CardContent
    > form
      > Input(label="Mô tả", error={errors.desc?.message})
      > Input(label="Số tiền", type="number")
      > Select(label="Loại", options=[...])
      > CardFooter
        > Button(variant="outline", "Hủy", onClick=onClose)
        > Button("Lưu", isLoading=isSubmitting)
```

### 4.3 Utilities

**formatCurrency(amount, currency?)** — format số tiền VND, ví dụ: `1500000` → `"1.500.000 ₫"`

**formatDate(date)** — format ngày Việt Nam, ví dụ: `"30/03/2026"`

**formatDateTime(date)** — format ngày + giờ, ví dụ: `"30/03/2026, 14:30"`

**cn(...classes)** — merge Tailwind classes, resolve conflicts (dùng clsx + tailwind-merge)

## 5. Delivery Data Processing (/admin/delivery-data)

**Mục đích:** Upload file Excel ERP giao hàng → phân nhóm theo số tàu/xe + ngày hóa đơn → xuất file output chuẩn.

### 5.1 Flow

```
User upload file .xlsx ERP (Delivery Report)
  → DeliveryDataPage (browser-side processing, không qua backend)
    → processDeliveryData(file: File) [src/utils/processDeliveryData.ts]
      → Đọc file qua FileReader → ArrayBuffer
      → XLSX.read() parse workbook
      → Bỏ qua 4 dòng đầu (metadata ERP), row 4 = header, row 5+ = data
      → Filter dòng trống
      → Lọc dòng có Diễn giải chứa "thay thế" / "điều chỉnh" (filterExcludedRows)
      → Verify trọng lượng với masterdata weight_adjustments (nếu có thay đổi → confirm dialog)
      → Normalize Số tàu/xe: strip suffix " /L2" nếu có (normalizeVehicle)
      → Group theo key = (Số tàu/xe + Ngày HĐ + Tên KH)
        - Nếu SUM(HĐ Trọng lượng)/1000 >= 13 và Thông tin bổ sung có 2+ giá trị → add "Thông tin bổ sung" vào key
      → Sort mỗi nhóm theo Số HĐ ASC (numeric-aware), rồi Mã NCC ASC
      → Final sort các nhóm theo Số tàu/xe ASC (natural sort: prefix numeric-aware → number numeric)
      → Tính Round(MT) = SUM(HĐ Trọng lượng Net) / 1000 per group
      → Build output XLSX (6 sheets):
          Sheet "Processed": tất cả dòng (44 cols), header + data + separator xám giữa nhóm
          Sheet "CLF": chỉ dòng factory CLF (46 cols), thêm Tấn/Hóa đơn & Tấn/Chuyến
          Sheet "VFM": chỉ dòng factory VFM (46 cols)
          Sheet "MCC": chỉ dòng factory MCC (46 cols)
          Sheet "CLV": chỉ dòng factory CLV (46 cols)
          Sheet "NDFC": chỉ dòng factory NDFC (46 cols)
      → Return: { outputBlob, outputFilename, processedRows, groupCount, dateRange, warnings }
  → User tải file output xuống
```

### 5.2 Column Mapping (Source → Output)

| Output Column | Source Column Index | Ghi chú |
|---------------|--------------------|----|
| Mã nhà cung cấp | 20 | MA_NCC |
| Số hóa đơn | 32 | SO_HD — dùng để sort ASC trong nhóm |
| Ngày hóa đơn | 31 | NGAY_HD — dùng làm group key; convert từ Excel serial |
| Số tàu | 28 | SO_TAU_XE — dùng làm group key; strip " /L2" suffix nếu có; hiển thị `.slice(-9)` |
| Mã khách hàng | 21 | MA_KH |
| Tên khách hàng | 22 | TEN_KH |
| Địa chỉ giao hàng | 15 | DIA_CHI |
| Khung giá | — | Phân loại: ≤2.5 / >8-16 / >16-23 / Pallet dựa trên tổng Round(MT) nhóm |
| Đơn vị tính | — | "Chuyến" nếu Khung giá = "≤2.5 tấn", còn lại "Tấn" |
| Mã hàng hóa | 23 | MA_HANG |
| Tên hàng hóa (Vie) | 16 | TEN_HANG_HOA |
| Tên hàng hóa (En) | 24 | TEN_HANG_EN |
| Mã liên hệ giao hàng | 26 | MA_LH_GIAO |
| Mã DVT | 17 | MA_DVT |
| Số lượng (DVT bán hàng) | 27 | SO_LUONG |
| SP Trọng lượng net | 18 | SP_TRONG_LUONG |
| HĐ Trọng lượng (Net) | 19 | HD_TRONG_LUONG |
| Round(MT) | — | HD_TRONG_LUONG / 1000 per row, làm tròn 3 chữ số thập phân |
| CLF | — | Factory col: first row of invoice = SUM(Round(MT)) nếu MA_NCC=2000000001, else 0 |
| VFM | — | Factory col: MA_NCC=2100000002 |
| MCC | — | Factory col: MA_NCC=2000000007 |
| CLV | — | Factory col: MA_NCC không khớp bất kỳ factory nào |
| NDFC | — | Factory col: MA_NCC=2000000008 |
| Col1 (không tiêu đề) | — | Dòng đầu tiên của khối = tổng Round(MT) khối; các dòng còn lại = 0 |
| Col2 (không tiêu đề) | — | Tất cả dòng trong khối = tổng Round(MT) khối |
| Tài xế | 29 | TAI_XE |
| Thông tin bổ sung | 33 | THONG_TIN_BS |
| Slot | 4 | SLOT |
| Diễn giải | 3 | DIEN_GIAI |
| Channel | 0 | CHANNEL |
| SubChannel | 1 | SUB_CHANNEL |
| SlotNo | 6 | SLOT_NO |
| user tạo HĐ | 7 | USER_TAO_HD |
| User tạo PXK | 8 | USER_TAO_PXK |
| PO number | 9 | PO_NUMBER |
| Warehouse No | 10 | WAREHOUSE_NO |
| Warehouse Name | 11 | WAREHOUSE_NAME |
| Phiếu XK | 12 | MA_PXK |
| Chứng từ ghi sổ | 13 | SO_CHUNG_TU |
| Số seri | 14 | SO_SERI |
| Loại hàng | 25 | LOAI_HANG |
| Tuyến cũ | — | Tra từ `customers.tuyen_cu` qua `lookupCustomer(TEN_KH, DIA_CHI)` |
| Tuyến mới | — | Tra từ `customers.tuyen_phuong` qua `lookupCustomer(TEN_KH, DIA_CHI)` |
| Tuyến lên hóa đơn | — | Ghép: `tuyenPhuong + " " + khungGia + " (" + soXe + ")"`; rỗng nếu không có tuyenPhuong |

**Customer lookup priority (BR-013):** Khi `MA_NCC = 2000000007` (MCC) hoặc `2000000008` (NDFC) và `Slot = "UNI 1"`:
- Ưu tiên tra customer bằng `TEN_KH + DIA_CHI + MA_NCC` (khớp với `customers.supplier_code`)
- Nếu không tìm thấy → fallback tra bằng `TEN_KH + DIA_CHI` như bình thường
- Các trường hợp khác: tra bằng `TEN_KH + DIA_CHI`

**Sheets CLF / VFM / MCC / CLV / NDFC (46 cols):**

Giống sheet Processed, nhưng chèn thêm 2 cột giữa "Đơn vị tính" và "CLF": "Tấn/ Hóa đơn" (col 18) và "Tấn/ Chuyến" (col 19). Các cột CLF..NDFC bị đẩy sang col 20-24.

| Khác biệt | Mô tả |
|------------|-------|
| Cột CLF/VFM/MCC/CLV/NDFC (col 20-24) — **dòng đầu tiên của khối** | Hiển thị sum của **toàn bộ group** (tất cả factories), giống separator row ở sheet Process. Các dòng còn lại giữ nguyên giá trị invoice-level |
| Col 18: **Tấn/ Hóa đơn** | Hiển thị ở dòng đầu tiên của mỗi invoice+factory = tổng tấn của invoice đó cho factory tương ứng. Các dòng còn lại = '' |
| Col 19: **Tấn/ Chuyến** | Chỉ hiển thị ở dòng đầu khối = tổng tấn của factory đó trong khối. Các dòng còn lại = '' |

### 5.3 Business Rules

- **BR-000:** ⚠️ DEPRECATED (removed 2026-04-25) — Pre-sort rows by vehicle+date+invoice was removed. Final sort groups by vehicle is now performed in BR-003.
- **BR-001:** Grouping key ban đầu = Số tàu/xe + Ngày hóa đơn + (Thông tin bổ sung nếu có, ngược lại Tên khách hàng)
  - Số tàu/xe được normalize: strip suffix `" /L2"` nếu có trước khi dùng làm group key (BR-010)
  - Nếu cột Thông tin bổ sung có dữ liệu → key = Xe + Ngày + Thông tin BS
  - Nếu không → key = Xe + Ngày + Tên KH
  - Tính SUM(HĐ Trọng lượng) / 1000 của group sơ bộ
  - Nếu < 13: giữ nguyên group key (Số tàu/xe + Ngày HĐ + Tên KH)
  - Nếu >= 13: kiểm tra cột "Thông tin bổ sung"
    - Nếu Tên KH **không** nằm trong danh sách `inner_city_customers` → bypass, giữ nguyên group key (BR-014)
    - Nếu Tên KH nằm trong danh sách `inner_city_customers`:
      - Có từ 2 giá trị trở lên → group key += Thông tin bổ sung
      - Có 0-1 giá trị → giữ nguyên group key
- **BR-002:** Trong mỗi nhóm, sort rows theo Số HĐ ASC (numeric-aware localeCompare), sau đó Mã nhà cung cấp ASC (numeric-aware)
- **BR-003:** Final sort groups theo **biển số hiển thị** (`.slice(-9)` của Số tàu/xe đã normalize) ASC. Dùng `compareVehicleNumbers()` — sort theo prefix alphabetically → number numerically. Lý do: source data có nhiều format prefix khác nhau (`PPH `, `PPH-`, `PPH-P-`, `PPH-G-`, `PPH-ND-`, etc.) gây sai thứ tự nếu sort full string.
- **BR-004:** Round(MT) = HD_TRONG_LUONG (col 19) / 1000, làm tròn 3 chữ số thập phân — tính per row (không phải per group)
- **BR-005:** Output có 1 separator row giữa các nhóm (không có giữa row cuối và end-of-file). Separator row hiển thị SUM tại các cột: Round(MT), CLF, VFM, MCC, CLV, NDFC.
- **BR-006:** Ngày HĐ là Excel serial number → convert sang DD/MM/YYYY string trong output
- **BR-007:** Factory sheets (CLF/VFM/MCC/CLV/NDFC) — dòng đầu tiên của mỗi khối: cột CLF/VFM/MCC/CLV/NDFC hiển thị sum toàn group (giống separator row ở Process sheet)
- **BR-008:** Factory sheets — cột "Tấn/ Hóa đơn" (col 18): hiển thị ở dòng đầu tiên của mỗi invoice+factory = tổng tấn invoice đó theo factory đó
- **BR-009:** Factory sheets — cột "Tấn/ Chuyến" (col 19): chỉ hiển thị ở dòng đầu khối = tổng tấn của factory đó trong khối
- **BR-010:** Normalize Số tàu/xe: nếu 4 ký tự cuối là `" /L2"` → strip suffix này trước khi dùng làm group key, sort, và hiển thị
- **BR-011:** Cột "Khung giá" và "Đơn vị tính" nằm ngay sau "Địa chỉ giao hàng". "Khung giá" phân loại dựa trên tổng Round(MT) nhóm: ≤2.5 / >8-16 / >16-23 / Pallet. "Đơn vị tính" = "Chuyến" nếu Khung giá = "≤2.5 tấn", còn lại "Tấn".
- **BR-012:** Lọc dòng trước khi xử lý: dòng có cột "Diễn giải" chứa "thay thế" hoặc "điều chỉnh" bị loại bỏ (filterExcludedRows). Đây là các hóa đơn chỉnh sửa, không phải giao hàng thực tế.
- **BR-013:** Customer lookup cho tuyến: mặc định tra bằng `TEN_KH + DIA_CHI`. Nếu `MA_NCC = 2000000007` hoặc `2000000008` và `Slot = "UNI 1"` → ưu tiên tra bằng `TEN_KH + DIA_CHI + MA_NCC` (khớp `customers.supplier_code`), nếu không có thì fallback về key mặc định.
- **BR-014:** Bypass group splitting cho KH không nội thành: nếu Tên KH **không** khớp với `customer_name` trong `inner_city_customers`, bỏ qua bước tách nhóm (Step 1b), giữ nguyên group key. Chỉ thực hiện tách nhóm cho KH nội thành khi tổng trọng lượng >= 13.

### 5.4 Verify trọng lượng (Weight Adjustment Check)

Trước khi xử lý chính, hệ thống tự động kiểm tra từng dòng với masterdata "điều chỉnh trọng lượng":

```
User click "Xử lý"
  → [verifying] parse file + fetch /api/weight-adjustments
  → So sánh từng dòng:
      - MA_HANG (col 23) có trong masterdata?
        - Có: so sánh TEN_HANG_HOA (col 16) với masterdata.ten_hang
          - Trùng tên → dùng gia_tri_cu thay thế SP_TRONG_LUONG (col 18)
          - Khác tên → dùng gia_tri_dieu_chinh thay thế SP_TRONG_LUONG (col 18)
          - Sau đó: HD_TRONG_LUONG (col 19) = SO_LUONG (col 27) × SP_TRONG_LUONG mới
          - Nếu MA_HANG khớp + tên trùng + gia_tri_cu = NULL → bỏ qua dòng này
        - Không: giữ nguyên
  → Không có thay đổi → xử lý trực tiếp
  → Có thay đổi → hiện WeightAdjustmentConfirmDialog
      - Xác nhận → áp dụng → xử lý
      - Bỏ qua   → xử lý nguyên gốc
```

### 5.5 Files liên quan

```
src/utils/processDeliveryData.ts   ← exports: parseDeliveryFile(), processDeliveryDataFromRows(),
                                      processDeliveryData() (wrapper), COL, RawRow, ParsedFileData
src/pages/admin/DeliveryDataPage.tsx ← UI page với verify flow
src/components/delivery-data/WeightAdjustmentConfirmDialog.tsx ← modal xác nhận điều chỉnh
src/api/weightAdjustmentApi.ts     ← fetchAll() dùng để load masterdata
```

### 5.5 Access

- Route: `/admin/delivery-data`
- Guard: AuthGuard + AdminGuard (admin/manager role)
- Sidebar: "Xử lý Data Giao Hàng" / "Delivery Data Processing"

---

## 7. Quản lý dữ liệu xe

Module "Quản lý dữ liệu xe" có nhiều sub-menu, mỗi sub-menu là một bảng masterdata.

### 7.1 Mã chuyến (/vehicle-data/trip-codes)

**Mục đích:** Quản lý danh sách mã chuyến vận chuyển.

**Data model — bảng `trip_codes`:**
```sql
trip_codes (id, ma, tuyen, so_tien, status, start_date, end_date, boc_xep, ghi_chu, created_at, updated_at)
```

**Business Rules:**
- Soft update: update → deactivate old row (status=deactive, end_date=now) + insert new row
- Soft delete: UPDATE SET status=deactive, end_date=now (không xóa vật lý)
- Mã case-sensitive unique among active rows (enforced at service layer, NOT DB constraint)
- Upload Excel: parse ở frontend (xlsx lib) → gửi JSON array lên backend → backend check duplicate → bulk insert
- Upload fail-fast: nếu bất kỳ dòng nào lỗi → không insert gì cả, trả về chi tiết lỗi từng dòng

**API Endpoints:**
```
GET    /api/trip-codes          → list active rows
POST   /api/trip-codes          → create (409 if duplicate ma)
PUT    /api/trip-codes/:id      → soft-update (transaction: deactivate + insert)
DELETE /api/trip-codes/:id      → soft-delete
POST   /api/trip-codes/upload   → bulk insert JSON rows ({ rows: [...] })
```

**Files:**
```
backend/src/migrations/003_create_trip_codes.sql
backend/src/services/tripCodeService.ts
backend/src/controllers/tripCodeController.ts
backend/src/routes/tripCodes.ts
frontend/src/api/tripCodeApi.ts
frontend/src/hooks/useTripCodes.ts
frontend/src/components/vehicle-data/TripCodeFormModal.tsx
frontend/src/components/vehicle-data/TripCodeUploadModal.tsx
frontend/src/pages/admin/vehicle-data/TripCodePage.tsx
```

**Access:** Tất cả authenticated users. Route: `/vehicle-data/trip-codes`

---

### 7.2 Dữ liệu xe (/vehicle-data/vehicles)

**Mục đích:** Quản lý danh sách xe vận chuyển (biển số, loại xe, tài xế).

**Data model — bảng `vehicles`:**
```sql
vehicles (id, bien_so, loai, tai_xe JSONB, status, start_date, end_date, created_at, updated_at)
```

**Business Rules:**
- Soft update: deactivate old row (status=deactive, end_date=now) + insert new row (transaction)
- Soft delete: UPDATE SET status=deactive, end_date=now
- Biển số case-sensitive unique among active rows (service layer, NOT DB constraint)
- tai_xe: JSONB array of driver name strings; empty array [] if no driver
- Loại: one of 'Xe lớn' | 'Xe nhỏ' (validated at service + controller)
- Upload: FE parses Excel → JSON rows → backend validates → bulk insert
  - Excel Tài xế column: comma-separated → split to array
  - Fail-fast: any error → no insert, return all errors with row numbers

**API Endpoints:**
```
GET    /api/vehicles          → list active rows (DESC start_date)
POST   /api/vehicles          → create (409 if duplicate bien_so)
PUT    /api/vehicles/:id      → soft-update (transaction: deactivate + insert)
DELETE /api/vehicles/:id      → soft-delete
POST   /api/vehicles/upload   → bulk insert JSON rows ({ rows: [...] })
```

**Files:**
```
backend/src/migrations/005_create_vehicles.sql
backend/src/services/vehicleService.ts
backend/src/controllers/vehicleController.ts
backend/src/routes/vehicles.ts
frontend/src/api/vehicleApi.ts
frontend/src/hooks/useVehicles.ts
frontend/src/components/vehicle-data/VehicleFormModal.tsx
frontend/src/components/vehicle-data/VehicleUploadModal.tsx
frontend/src/pages/admin/vehicle-data/VehiclePage.tsx
```

**Access:** Tất cả authenticated users. Route: `/vehicle-data/vehicles`

---

### 7.3 Thông tin tài xế (/vehicle-data/drivers)

**Mục đích:** Quản lý hồ sơ tài xế (master data) — tích hợp với VehicleFormModal để chọn tài xế từ dropdown.

**Data model:**
```sql
drivers (id, ten_ky_hieu VARCHAR(100) NOT NULL UNIQUE, ho_ten, lien_he, cccd, ghi_chu, status, created_at, updated_at)
driver_documents (id, driver_id FK→drivers, file_name, mime_type, file_data TEXT(base64), file_size, created_at)
```

**Business Rules:**
- ten_ky_hieu: DB UNIQUE constraint (across all rows, active + deactive) — dùng làm identifier trong vehicles.tai_xe
- Delete driver → soft delete (status=deactive), không xóa vật lý
- Update driver → standard UPDATE (no soft-update / versioning)
- vehicles.tai_xe vẫn lưu string[] của ten_ky_hieu; VehicleFormModal dùng multi-select searchable dropdown từ active drivers
- Document upload: base64 JSON (no multer), max 5MB. FE validate trước khi gửi. Lưu TEXT trong DB.
- Deactivated driver trong vehicles.tai_xe → hiển thị với "(đã xóa)" hint trong VehicleFormModal

**API Endpoints:**
```
GET    /api/drivers                          → list active drivers (ORDER BY ten_ky_hieu ASC)
POST   /api/drivers                          → create (409 if duplicate ten_ky_hieu)
PUT    /api/drivers/:id                      → update (409 if duplicate ten_ky_hieu)
DELETE /api/drivers/:id                      → soft-delete
GET    /api/drivers/:id/documents            → list docs metadata (no file_data)
POST   /api/drivers/:id/documents            → upload doc (base64 JSON, max 5MB)
DELETE /api/drivers/:id/documents/:docId     → delete doc
GET    /api/drivers/:id/documents/:docId     → download doc (with file_data)
```

**Files:**
```
backend/src/migrations/006_create_drivers.sql
backend/src/services/driverService.ts
backend/src/controllers/driverController.ts
backend/src/routes/drivers.ts
frontend/src/api/driverApi.ts
frontend/src/hooks/useDrivers.ts
frontend/src/hooks/useDriverDocuments.ts
frontend/src/components/vehicle-data/DriverFormModal.tsx
frontend/src/components/vehicle-data/DriverDocumentsModal.tsx
frontend/src/pages/admin/vehicle-data/DriverPage.tsx
```

**Access:** Tất cả authenticated users. Route: `/vehicle-data/drivers`

---

## 11. Quản lý dữ liệu kế toán

### 11.1 Điều chỉnh trọng lượng (/accounting-data/weight-adjustments)

**Mục đích:** Masterdata điều chỉnh trọng lượng hàng hóa — cho phép lưu giá trị cũ và giá trị điều chỉnh theo từng mã hàng, có tracking version đầy đủ.

**Data model — bảng `weight_adjustments`:**
```sql
weight_adjustments (
  id SERIAL PK,
  ma_hang VARCHAR(100) NOT NULL,          -- Mã hàng hóa
  ten_hang VARCHAR(255) NOT NULL,          -- Tên hàng hóa
  gia_tri_cu NUMERIC(15,3),               -- Giá trị cũ, nullable
  gia_tri_dieu_chinh NUMERIC(15,3) NOT NULL, -- Giá trị điều chỉnh
  status VARCHAR(20) DEFAULT 'active',    -- 'active' | 'deactive'
  version INTEGER DEFAULT 1,              -- tăng mỗi lần soft-update
  start_date TIMESTAMPTZ DEFAULT NOW(),   -- khi version này có hiệu lực
  end_date TIMESTAMPTZ,                   -- null nếu vẫn active
  action_type VARCHAR(20),                -- 'create' | 'update' | 'delete' | 'upload'
  action_by INTEGER FK→users.id,          -- user thực hiện
  action_by_name VARCHAR(255),            -- denormalized full_name
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
```

**Business Rules:**
- BR-001: `ma_hang` UNIQUE trong active rows
- BR-002: Soft-update: deactivate row cũ + INSERT mới với `version+1`, `action_type=update`
- BR-003: Soft-delete: UPDATE `status=deactive`, `action_type=delete`
- BR-004: Create: version=1, action_type=create
- BR-005: Upload: fail-fast (in-file + DB duplicate check), action_type=upload
- BR-006: `gia_tri_cu` nullable (lần đầu nhập có thể không có giá trị cũ)
- BR-007: `action_by_name` denormalized để bảo toàn lịch sử khi user bị xóa

**API Endpoints:**
```
GET    /api/weight-adjustments          → list active rows (accounting_data.view)
POST   /api/weight-adjustments          → create (accounting_data.manage)
PUT    /api/weight-adjustments/:id      → soft-update (accounting_data.manage)
DELETE /api/weight-adjustments/:id      → soft-delete (accounting_data.manage)
POST   /api/weight-adjustments/upload   → bulk insert fail-fast (accounting_data.manage)
```

**Permissions:**
| Code | Role mặc định |
|------|--------------|
| accounting_data.view | ADMIN, ACCOUNTANT, VIEWER |
| accounting_data.manage | ADMIN, ACCOUNTANT |

**Files:**
```
backend/src/migrations/009_create_weight_adjustments.sql
backend/src/services/weightAdjustmentService.ts
backend/src/controllers/weightAdjustmentController.ts
backend/src/routes/weightAdjustments.ts
backend/src/__tests__/weightAdjustmentService.test.ts
frontend/src/api/weightAdjustmentApi.ts
frontend/src/hooks/useWeightAdjustments.ts
frontend/src/pages/admin/accounting-data/WeightAdjustmentPage.tsx
frontend/src/components/accounting-data/WeightAdjustmentFormModal.tsx
frontend/src/components/accounting-data/WeightAdjustmentUploadModal.tsx
```

**Access:** Route `/accounting-data/weight-adjustments`, sidebar menu "Quản lý dữ liệu kế toán" → "Điều chỉnh trọng lượng"

---

### 11.2 Danh sách khách nhận hàng (/accounting-data/customers)

**Mục đích:** Quản lý masterdata danh sách khách hàng nhận hàng — cho phép CRUD thủ công và import hàng loạt từ Excel.

**Data model — bảng `customers`:**
```sql
customers (
  id SERIAL PK,
  diem_tra_hang VARCHAR(255) NOT NULL,       -- Điểm trả hàng, business key (unique per active)
  ten_khach_hang VARCHAR(255) NOT NULL,       -- Tên khách hàng
  tuyen_phuong VARCHAR(255),                  -- Tuyến-phường (nullable)
  tuyen_cu VARCHAR(255),                      -- Tuyến cũ (nullable)
  dia_chi_giao_hang TEXT,                     -- Địa chỉ giao hàng (nullable)
  diem_giao_hang_tinh_phi VARCHAR(255),       -- Điểm giao hàng tính phí (nullable, optional text)
  boc_xep BOOLEAN NOT NULL DEFAULT TRUE,      -- Có bốc xếp không
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'deactive'
  created_by INTEGER FK→users.id,
  updated_by INTEGER FK→users.id,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
```

**Business Rules:**
- BR-001: `diem_tra_hang` unique trong active rows (service-level check, không phải DB constraint)
- BR-002: Soft delete — UPDATE SET status='deactive' (không xóa vật lý)
- BR-003: Create → 409 nếu diem_tra_hang đã tồn tại (active record)
- BR-004: Update → 409 nếu diem_tra_hang conflict với record khác
- BR-005: Upload fail-fast — nếu bất kỳ dòng nào lỗi → không insert gì cả, trả 422 + error list
- BR-006: Cột boc_xep trong Excel: "Không"/"Khong" (case-insensitive) → false; rỗng/other → true
- BR-007: Excel column order (positional, col index từ 0): col0=Điểm trả hàng, col1=Tuyến-phường, col2=Tuyến-cũ, col3=bỏ qua, col4=Tên khách hàng, col5=Địa chỉ giao hàng, col6=Bốc xếp
- BR-008: fetchAll → chỉ trả active records
- BR-009: Liên kết N-N với `suppliers` qua junction table `customer_suppliers`, tự động populate khi import `delivery_data` (match `ten_kh` → `ten_khach_hang`, `ma_ncc` → `supplier_code`)
- BR-010: Response `list()` include `suppliers: [{ supplier_code, name }]` dạng JSON array
- BR-011: `diem_giao_hang_tinh_phi` optional text (VARCHAR 255). Rỗng / whitespace → `null`. Không unique, không FK. Excel: map nếu có header “Điểm giao hàng tính phí” (alias GHTP); thiếu cột → `null`, không fail.

**Junction table — `customer_suppliers`:**
```sql
customer_suppliers (
  id SERIAL PK,
  customer_id INTEGER FK→customers(id) ON DELETE CASCADE,
  supplier_id INTEGER FK→suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, supplier_id)
)
```

**API Endpoints:**
```
GET    /api/customers          → list active rows + suppliers[] (accounting_data.view)
POST   /api/customers          → create (accounting_data.manage) → 409 if duplicate diem_tra_hang
PUT    /api/customers/:id      → update (accounting_data.manage) → 409 if conflict, 404 if not found
DELETE /api/customers/:id      → soft-delete (accounting_data.manage) → 404 if not found
POST   /api/customers/upload   → bulk insert fail-fast (accounting_data.manage)
                                  → 422 { success: false, errors: [{ row, diem_tra_hang, reason }] }
```

**Flow — Upload Excel:**
```
User chọn/kéo thả .xlsx
  → Frontend parse Excel (xlsx lib, header:1 positional)
    → Filter dòng header (row[0] = "Điểm trả hàng")
    → Filter dòng trống (col0 rỗng)
    → Map columns: col0 → diem_tra_hang, col1 → tuyen_phuong, ...
    → boc_xep: col6.toLowerCase() === 'không'||'khong' → false, else true
  → Preview: hiện số dòng + 3 dòng đầu
  → Confirm import → POST /api/customers/upload { rows: [...] }
  → 200: toast success "Đã import N bản ghi"
  → 422: hiện bảng lỗi trong modal (dừng lại, không toast)
```

**Files:**
```
backend/src/migrations/012_create_customers.sql
backend/src/migrations/020_add_supplier_code_to_customers.sql
backend/src/migrations/043_add_diem_giao_hang_tinh_phi_to_customers.sql
backend/src/services/customerService.ts
backend/src/services/deliveryDataService.ts  (gọi populateCustomerSuppliers sau import)
backend/src/controllers/customerController.ts
backend/src/routes/customers.ts
backend/src/__tests__/customerService.test.ts  (17 tests)
frontend/src/api/customersApi.ts
frontend/src/hooks/useCustomers.ts
frontend/src/pages/admin/accounting-data/CustomersPage.tsx
frontend/src/components/admin/CreateCustomerModal.tsx
frontend/src/components/admin/EditCustomerModal.tsx
frontend/src/components/admin/DeleteCustomerDialog.tsx
frontend/src/components/admin/UploadCustomersModal.tsx
```

**Permissions:** Same as weight-adjustments — `accounting_data.view` / `accounting_data.manage`

**Access:** Route `/accounting-data/customers`, sidebar menu "Quản lý dữ liệu kế toán" → "Danh sách khách hàng"

---

### 11.3 Hóa đơn tài xế (/vehicle-data/driver-invoices)

**Mục đích:** Upload file Excel hóa đơn từ tài xế (format "Xe Nhỏ"), tự động parse cột G để tách số hóa đơn, lưu vào database có kiểm tra trùng.

**Data model — bảng `driver_invoices`:**
```sql
driver_invoices (
  id SERIAL PK,
  ma VARCHAR(50) NOT NULL,
  ten_tx VARCHAR(255) NOT NULL,
  ngay DATE NOT NULL,
  so_xe VARCHAR(50) NOT NULL,
  noi_giao VARCHAR(255) NOT NULL,
  ghi_chu TEXT,                            -- Ghi chú — raw text cột G từ file Excel
  so_hoa_don JSONB DEFAULT '[]'::jsonb,    -- Array số hóa đơn đã parse (click để xem popup)
  original_filename VARCHAR(255),
  uploaded_by INTEGER FK→users.id,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
)
```

**Business Rules:**
- BR-001: Upload file .xlsx, đọc sheet "HCM" và "Tỉnh", dữ liệu từ row 5+(0-indexed)
- BR-002: Columns: A=Mã, B=Tên TX, C=Ngày, D=Số xe, E=Nơi giao, F=Số hóa đơn
- BR-002a: so_xe được normalize: bỏ `-`, `,`, space (vd: "50H-55116" → "50H55116")
- BR-003: Bỏ qua dòng có cột B (Mã) rỗng hoặc cột G rỗng
- BR-004: Parse cột G: tách bằng "+" → filter chỉ giữ số nguyên dương
- BR-005: Lưu raw text vào `ghi_chu`, kết quả parse vào `so_hoa_don` (JSONB)
- BR-005a: Dedup nội bộ trong payload trước khi INSERT (tránh UNIQUE violation)
- BR-006: Check trùng theo composite key `(ma, ngay, so_xe, ghi_chu)`
- BR-007: Upload fail-soft: nếu có trùng → trả 409 + list duplicates, user chọn skip
- BR-008: Upload fail-soft + dedup nội bộ: check trùng với DB + trong payload. User chọn skip nếu có trùng.
- BR-009: Edit hỗ trợ qua PUT endpoint: sửa text fields + thêm/sửa/xóa số hóa đơn
- BR-010: Hard delete cho DELETE endpoint. Edit = full update.

**API Endpoints:**
```
GET    /api/driver-invoices           → list + pagination + filters (ma, ten_tx, so_xe, noi_giao, so_hoa_don, ghi_chu, ngay_from/to)
POST   /api/driver-invoices/upload     → parse & bulk insert (accounting_data.manage)
                                         → 409 nếu có duplicate (skip_duplicates=false)
GET    /api/driver-invoices/:id        → single record (accounting_data.view)
PUT    /api/driver-invoices/:id        → update record (accounting_data.manage)
DELETE /api/driver-invoices/:id        → hard delete (accounting_data.manage)
```

**Flow — Upload Excel:**
```
User chọn file .xlsx
  → Frontend parse (xlsx lib): đọc sheet "HCM" + "Tỉnh", rows 5+
  → Parse cột F: split("+") → filter /^\d+$/ → so_hoa_don
  → Preview: hiện 10 dòng đầu + tổng số dòng/tổng số hóa đơn
  → User confirm → POST /api/driver-invoices/upload { rows, original_filename, skip_duplicates }
  → Không trùng → 200 "Đã import N bản ghi"
  → Có trùng + skip_duplicates=false → 409 → DuplicateConfirmDialog → user chọn skip → import dòng mới
```

**Files:**
```
backend/src/migrations/014_create_driver_invoices.sql
backend/src/migrations/015_normalize_so_xe.sql
backend/src/services/driverInvoiceService.ts
backend/src/controllers/driverInvoiceController.ts
backend/src/routes/driverInvoices.ts
frontend/src/api/driverInvoiceApi.ts
frontend/src/hooks/useDriverInvoices.ts
frontend/src/utils/parseDriverInvoiceFile.ts
frontend/src/pages/admin/accounting-data/DriverInvoicesPage.tsx
frontend/src/components/accounting-data/DriverInvoiceUploadModal.tsx
frontend/src/components/accounting-data/DriverInvoiceEditModal.tsx
frontend/src/components/accounting-data/DuplicateConfirmDialog.tsx
frontend/src/components/accounting-data/InvoiceNumbersPopup.tsx
```

**Permissions:** Same as weight-adjustments — `accounting_data.view` / `accounting_data.manage`

**Access:** Route `/vehicle-data/driver-invoices`, sidebar menu "Quản lý dữ liệu xe" → "Hóa đơn tài xế"

---

- [ ] Trang Sổ kế toán (/accounting) — CRUD phiếu thu/chi, nhật ký chứng từ
- [ ] Trang Báo cáo (/reports) — báo cáo tài chính, biểu đồ doanh thu
- [ ] Trang Cài đặt (/settings) — quản lý tài khoản, đổi mật khẩu
- [x] Quản lý users (/users) — list users, phân quyền (users.view / users.manage)
- [x] Quản lý vai trò (/roles) — CRUD roles, soft-deactivate, permission-gated (roles.view / roles.manage)
- [x] Quản lý quyền (/permissions) — permission matrix role×perm (permissions.manage)
- [ ] Auto token refresh ở frontend
- [ ] Unit tests
- [ ] Export báo cáo (PDF, Excel)
- [x] Dark/Light Mode — toggle button ở sidebar (MainLayout) và AuthLayout, persist localStorage
- [x] Bảng điều phối xe (/dispatch/schedule) — tạo/xóa chuyến xe theo ngày

---

## 10. Điều hành vận tải

Nhóm tính năng "Điều hành vận tải" trong sidebar — collapsible accordion.

### 10.1 Bảng điều phối xe (/dispatch/schedule)

**Mục đích:** Quản lý lịch điều phối xe theo ngày — tạo và xóa chuyến xe.

**Data model — bảng `dispatch_schedules`:**
```sql
dispatch_schedules (
  id, ngay DATE, loai_tuyen VARCHAR(20),  -- 'Tuyến cố định' | 'Tuyến ngoài'
  loai_xe VARCHAR(10), xe_type VARCHAR(10),
  bien_so VARCHAR(50) NOT NULL,  -- text value, NOT FK
  tai_xe TEXT,                   -- text value, NOT FK
  ma_chuyen VARCHAR(100),        -- text value, NOT FK
  diem_nhan TEXT, diem_tra TEXT, gio_nhan TIME, ghi_chu TEXT,
  vehicle_id FK nullable, trip_code_id FK nullable,  -- convenience refs only
  created_by FK nullable, created_at, updated_at
)
```

**Business Rules:**
- BR-001: Lưu text values (bien_so, tai_xe, ma_chuyen) — KHÔNG lưu FK ID. Dữ liệu lịch sử theo ngày phải giữ nguyên kể cả khi masterdata thay đổi.
- BR-002: `loai_xe = 'Xe nhỏ'` → hiển thị bảng "Lịch xe nhỏ"; `'Xe lớn'` → "Lịch xe lớn"
- BR-003: `xe_type = 'Xe nhà'` → biển số chọn từ vehicles; `'Xe ngoài'` → nhập tay
- BR-004: Tài xế (Xe nhà): tự điền từ `vehicle.tai_xe[0]`, read-only
- BR-005: Sort theo `gio_nhan ASC` trong mỗi bảng — backend sort trước khi trả về
- BR-006: Hard delete — không có soft delete cho dispatch_schedules
- BR-007: `loai_tuyen = 'Tuyến cố định'` → xuất hiện trong "Lịch xe nhỏ" hoặc "Lịch xe lớn" tùy loai_xe; `'Tuyến ngoài'` → xuất hiện trong "Lịch tuyến ngoài" (riêng biệt, bao gồm cả xe nhỏ lẫn xe lớn)

**Flow — Tạo chuyến (4-step wizard):**
```
Step 1: Chọn loai_tuyen (Tuyến cố định / Tuyến ngoài)
  → Step 2: Chọn xe_type (Xe nhà / Xe ngoài)
    → Step 3: Chọn loai_xe (Xe nhỏ / Xe lớn)
      → Step 4: Form (diem_nhan, diem_tra, gio_nhan, ma_chuyen, bien_so, tai_xe, ghi_chu)
        → POST /api/dispatch-schedules
        → Toast success → Modal đóng → Refresh bảng
```

**API Endpoints:**
```
GET    /api/dispatch-schedules?date=YYYY-MM-DD  → { xe_nho: [], xe_lon: [], tuyen_ngoai: [] }
POST   /api/dispatch-schedules                  → create schedule
PUT    /api/dispatch-schedules/:id              → update editable fields (bien_so, tai_xe, ma_chuyen, diem_nhan, diem_tra, gio_nhan, ghi_chu, vehicle_id, trip_code_id)
DELETE /api/dispatch-schedules/:id              → hard delete
```

**Files:**
```
backend/src/migrations/006_create_dispatch_schedules.sql
backend/src/migrations/007_add_loai_tuyen_to_dispatch_schedules.sql
backend/src/services/dispatchScheduleService.ts
backend/src/controllers/dispatchScheduleController.ts
backend/src/routes/dispatchSchedules.ts
frontend/src/api/dispatchApi.ts
frontend/src/hooks/useDispatchSchedules.ts
frontend/src/components/dispatch/ScheduleTable.tsx
frontend/src/components/dispatch/OutsideRouteTable.tsx
frontend/src/components/dispatch/CreateScheduleModal.tsx
frontend/src/components/dispatch/EditScheduleModal.tsx
frontend/src/pages/dispatch/SchedulePage.tsx
```

**Access:** Tất cả authenticated users. Route: `/dispatch/schedule`

## 8. Dark/Light Mode

**Mục đích:** Cho phép user chuyển đổi chế độ sáng/tối cho toàn bộ giao diện, persist qua sessions.

### 8.1 Flow

```
App khởi động
  → Anti-FOUC script trong index.html <head> (inline, sync)
    → Đọc localStorage 'theme' → fallback prefers-color-scheme
    → Set class 'dark' trên <html> nếu cần
  → ThemeProvider mount (App.tsx, bọc ngoài cùng)
    → getInitialTheme() → useState(theme)
    → useEffect: sync class 'dark' + localStorage

User click ThemeToggle
  → toggleTheme() → light ↔ dark
  → Tailwind dark: variants apply globally
```

### 8.2 Persistence

- **Storage:** `localStorage`, key = `'theme'`, value = `'dark'` | `'light'`
- **Priority:** localStorage > prefers-color-scheme

### 8.3 Files

```
frontend/src/contexts/themeContext.ts      ← ThemeContext + interface
frontend/src/contexts/ThemeContext.tsx     ← ThemeProvider
frontend/src/hooks/useTheme.ts             ← useTheme hook
frontend/src/components/ui/ThemeToggle.tsx ← Moon/Sun toggle button
```

---

## 9. Thiết lập người dùng (User Settings)

Parent menu group "Thiết lập người dùng" trong sidebar — collapsible accordion, auto-expands khi route match. Sub-menus được filter theo user permissions.

### 9.1 Quản lý người dùng (/users)

- Requires: `users.view`
- Xem danh sách users: filter search/role/is_active, pagination
- CRUD actions (requires `users.manage`): Xem chi tiết, Sửa, Đặt lại mật khẩu, Xóa
- Role dropdown load từ API (không hardcode enum)
- Create user: FE gửi `role_id`; BE sync cả `users.role_id` và legacy `users.role` (= `roles.code`)
- Hiển thị role trên list/detail: dùng `role_name` từ API (`getUserRoleLabel`), không `t(users.roles.*)`

### 9.2 Quản lý vai trò (/roles)

- Requires: `roles.view`
- Xem danh sách roles với user_count và permission_count
- ADMIN row: chỉ View, không edit/deactivate
- Create/Edit role (requires `roles.manage`): auto-generate code từ tên (Vietnamese → uppercase snake_case)
- Deactivate = soft-delete (`is_active=false`): dialog với user count warning; 0 users = auto-deactivate
- Activate: immediate, không cần confirm

### 9.3 Quản lý quyền (/permissions)

- Requires: `permissions.manage`
- Permission matrix table: rows = permissions grouped by module, cols = roles
- ADMIN column: always checked, disabled (is_system protection)
- Unsaved changes tracked locally (dirty state với Set objects)
- Lưu tất cả: loop non-ADMIN roles → PUT /api/permissions/role/:id

### 9.4 Files

```
backend/src/services/roleService.ts
backend/src/services/permissionService.ts
backend/src/controllers/rolesController.ts
backend/src/controllers/permissionsController.ts
backend/src/routes/roles.ts
backend/src/routes/permissions.ts
backend/src/migrations/004_roles_permissions.sql

frontend/src/api/rolesApi.ts
frontend/src/api/permissionsApi.ts
frontend/src/hooks/useRoles.ts
frontend/src/hooks/usePermissions.ts
frontend/src/pages/admin/RoleManagementPage.tsx
frontend/src/pages/admin/PermissionManagementPage.tsx
frontend/src/components/admin/CreateRoleModal.tsx
frontend/src/components/admin/EditRoleModal.tsx
frontend/src/components/admin/DeactivateRoleDialog.tsx
```

---

## 11. Giá theo tuyến (`route_pricing`)

Menu sidebar top-level **Giá theo tuyến** — không nằm trong accordion.

### 11.1 Giá theo tuyến (/route-pricing)

**Mục đích:** Quản lý kỳ điều chỉnh giá, nhóm tuyến theo **bảng giá**, bảng giá gốc / điều chỉnh theo kỳ, xem ma trận giá. Lookup Delivery Import **chưa** gắn (501 LOOKUP_DEFERRED).

**Data model — bảng chính:**
```sql
price_books (
  id, name VARCHAR unique active (lower trim), status, created_by, updated_by, ...
)
route_pricing_adjustment_periods (
  id, start_date DATE, end_date DATE nullable,  -- end_date do BE tự quản
  percent NUMERIC ≠ 0, note TEXT, created_by, updated_by, created_at, updated_at
)
route_groups (
  id, price_book_id, name, province_code, tinh, is_residual,
  note TEXT, status, created_by, updated_by, ...
)
delivery_routes (… ward_code XOR location_text, note …) + route_group_members
```
route_price_configs (id, route_group_id, status, …)
route_price_versions (
  id, price_config_id, pricing_mode ('by_weight'|'by_trips'),
  pallet_trip_price, base_version_id nullable,
  adjustment_period_id NOT NULL FK → periods,
  created_by, created_at
)
route_price_tiers (
  id, price_version_id, range_from, range_to, pricing_unit, price, min_billable_ton, sort_order
)
```

**Business Rules:**
- BR-001: Kỳ điều chỉnh là master **global**; UI không nhập `end_date` (BE đóng kỳ trước khi tạo kỳ mới).
- BR-002: Thêm kỳ = apply `%` mọi version đang mở toàn hệ thống; không sửa kỳ — muốn đổi thì xóa kỳ gần nhất rồi tạo lại.
- BR-003: Xóa kỳ gần nhất = rollback (xóa versions gắn kỳ + mở lại kỳ trước).
- BR-004: Nhóm tuyến scoped theo **bảng giá** (`price_books`); đích = Phường/Xã **XOR** Địa điểm text **XOR** Còn lại tỉnh; `note` optional (ảnh hưởng tên + unique). User tạo/đặt tên bảng giá tự do.
- BR-005: Mỗi nhóm chỉ nhập **bảng giá gốc** 1 lần; bắt buộc chọn `adjustment_period_id` (kỳ gốc); BE cascade tạo version cho mọi kỳ `start > kỳ gốc`.
- BR-006: Version gắn `adjustment_period_id`; ngày hiệu lực / `%` derive từ kỳ (không lưu trùng trên version). Không có cột `note` trên `route_price_versions` — ghi chú chỉ ở kỳ / nhóm / tuyến.
- BR-007: Sửa giá gốc → recompute cascade các kỳ sau.
- BR-008: Tab **Ma trận giá** = ma trận (`GET /prices/matrix?price_book_id=`): weight gom schema exact hoặc tập con (cột = union, ô thiếu trống) + Pallet cuối; trips = hàng tuyến×bậc (không Pallet), cột = kỳ.
- BR-009: Tab **Quản lý giá** = CRUD/lịch sử version (badge mode + gốc/điều chỉnh ±%).
- BR-010: `GET /route-pricing/lookup` **deferred** (501 LOOKUP_DEFERRED) — CR riêng.

**Flow — sử dụng chính:**
```
Tab Kỳ điều chỉnh (global, không cần chọn bảng giá)
  → Thêm kỳ (start_date, %, note?) → BE đóng kỳ trước + apply % mọi version mở
  → Chỉ xóa được kỳ gần nhất (= rollback)

Chọn Bảng giá
  → Tab Nhóm tuyến: tạo/sửa nhóm (phường XOR location XOR residual + note)
  → Tab Quản lý giá: Thêm bảng giá gốc (kỳ gốc + by_weight|by_trips + tiers + pallet)
        → BE cascade versions kỳ sau
      → Sửa giá gốc → recompute cascade
  → Tab Ma trận giá: xem ma trận weight_tables[] + trips.rows
```

**API Endpoints:**
```
GET/POST/PUT/DELETE /api/route-pricing/price-books
GET/POST/DELETE /api/route-pricing/adjustment-periods
GET             /api/route-pricing/geo/provinces
GET             /api/route-pricing/geo/wards?province_code=
GET/POST/PUT/DELETE /api/route-pricing/routes
GET/POST/PUT/DELETE /api/route-pricing/groups
GET/POST        /api/route-pricing/prices
GET             /api/route-pricing/prices/matrix?price_book_id=
PUT             /api/route-pricing/prices/groups/:routeGroupId/absolute
GET             /api/route-pricing/prices/:configId/versions
GET             /api/route-pricing/lookup   -- 501 LOOKUP_DEFERRED
```

**Files:**
```
backend/src/migrations/040_create_route_pricing.sql
backend/src/migrations/041_seed_route_pricing_permissions.sql
backend/src/migrations/042_route_pricing_adjustment_periods.sql
backend/src/migrations/044_route_pricing_price_books.sql
backend/src/services/routePricingService.ts
backend/src/controllers/routePricingController.ts
backend/src/routes/routePricing.ts
backend/src/types/routePricing.ts
backend/src/__tests__/routePricingService.test.ts
frontend/src/api/routePricingApi.ts
frontend/src/hooks/useRoutePricing.ts
frontend/src/pages/route-pricing/RoutePricingPage.tsx
frontend/src/pages/route-pricing/PriceMatrixTab.tsx
```

**Access:** `route_pricing.view` (xem) / `route_pricing.manage` (CRUD). Route: `/route-pricing`  
**BA / UI:** `docs/ba/20260911_route-pricing-price-books-cr.md`, `docs/ui/20260911_route-pricing-price-books-cr-ui-spec.md`, `docs/ba/20260711_route-pricing-analysis.md`, `docs/ba/20260731_route-pricing-price-matrix-view-analysis.md`

---

## 12. Dashboard (/)

**Mục đích:** Trang tổng quan hệ thống — tabs trong 1 trang, mỗi tab là một dashboard theo module. Tab hiển thị theo permission của user (pattern giống MainLayout filter sidebar).

### 12.1 Tabs & Permissions

| Tab | Permission | Nội dung chính |
|-----|-----------|----------------|
| Tổng quan (`overview`) | dashboard.view | KPI tháng/quý (tấn giao, số HĐ, số chuyến, chi phí dầu), chart tấn 6 tháng, cảnh báo hết hạn, dispatch hôm nay, job reconcile gần nhất |
| Bảo trì xe (`vehicles`) | vehicle_data.view | Đăng kiểm/bảo hiểm sắp hết hạn (bucket expired/30/60/90 ngày), xe quá hạn thay nhớt, chi phí sửa chữa 12 tháng theo xe |
| Kế toán - Đối chiếu (`accounting`) | accounting_data.view | Tổng matched/unmatched, chart theo tháng, batch import gần đây, lịch sử reconcile job |
| Vận tải (`operations`) | transport.view hoặc dispatch.view | KPI + chart chuyến theo ngày (mặc định 30 ngày, filter date_from/date_to), thống kê theo xe, hóa đơn tài xế |
| Nhiên liệu (`fuel`) | fuel.view | KPI + chart chi phí 6 tháng, tiêu thụ theo xe (L/100km), chênh lệch đồng hồ vs GPS |

### 12.2 Business Rules

- BR-001: Tab render kèm query `enabled` = permission check → không gọi API nếu không có quyền
- BR-002: KPI overview tính từ đầu tháng/quý hiện tại (`?period=month|quarter`)
- BR-003: Cảnh báo hạn dùng bucket: expired (< hôm nay) / d30 / d60 / d90 / ok — tính trên bản ghi active mới nhất mỗi xe (DISTINCT ON theo expiry_date DESC)
- BR-004: Hạn thay nhớt reuse logic `oilChangeService.getDueVehicles()` — dựa trên km hiện tại (fuel_records.odometer_new) trừ km lần thay nhớt cuối, so interval `vehicles.oil_change_interval_km` (overdue ≥ 100%, due_soon ≥ 80%)
- BR-005: Tấn giao = `SUM(delivery_data.hd_trong_luong)/1000` theo `ngay_hd`
- BR-006: Matched/unmatched hóa đơn theo `accountant_invoices.trang_thai` ('đã có' / 'không có')
- BR-007: Chênh lệch nhiên liệu chỉ tính bản ghi có `gps_distance`, threshold > 0, top 20 theo trị tuyệt đối

### 12.3 Files

```
backend/src/services/dashboardService.ts
backend/src/controllers/dashboardController.ts
backend/src/routes/dashboard.ts
backend/src/middleware/auth.ts               ← thêm requireAnyPermission()

frontend/src/types/dashboard.ts
frontend/src/api/dashboardApi.ts
frontend/src/hooks/useDashboard.ts
frontend/src/pages/dashboard/DashboardPage.tsx        ← tabs container
frontend/src/pages/dashboard/tabs/OverviewTab.tsx
frontend/src/pages/dashboard/tabs/VehicleMaintenanceTab.tsx
frontend/src/pages/dashboard/tabs/AccountingTab.tsx
frontend/src/pages/dashboard/tabs/OperationsTab.tsx
frontend/src/pages/dashboard/tabs/FuelTab.tsx
```

**Access:** Route `/` (DashboardPage). Sidebar giữ nguyên 1 mục "Dashboard".

---

- Password hash: bcrypt, 10 salt rounds, sync API
- JWT secret: phải đủ mạnh (recommend 256+ bits), không hardcode
- httpOnly cookie cho refreshToken: ngăn XSS đọc được
- Frontend KHÔNG lưu refreshToken vào localStorage (chỉ accessToken)
- Không log password hoặc token trong console
- Input validation ở cả frontend (UX) và backend (bắt buộc)
- CORS chỉ cho phép frontend dev URL (`http://localhost:5173`)
