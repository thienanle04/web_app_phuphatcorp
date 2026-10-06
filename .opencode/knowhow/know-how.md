---
description: Project structure, database schema, and API endpoints for the PhuPhatCorp Accounting Web App
---

# PhuPhatCorp — Technical Documentation

## 1. Project Overview

- **Mục đích:** Hệ thống web hỗ trợ công ty PhuPhatCorp xử lý số liệu kế toán, vận tải, giao hàng và báo cáo doanh thu
- **Cấu trúc:** Monorepo — `backend/` (Express + TypeScript), `frontend/` (React + Vite), `mobile/` (Flutter)
- **Database:** PostgreSQL. Host, port, database name và credential lấy từ biến môi trường, không ghi trong file này
- **Auth:** JWT. Access token hết hạn theo `JWT_EXPIRES_IN` (mặc định 15 phút). Refresh token theo `JWT_REFRESH_EXPIRES_IN` (mặc định 7 ngày), gửi trong JSON và trong httpOnly cookie `refreshToken`

## 2. Tech Stack

Phiên bản lấy từ `backend/package.json` và `frontend/package.json`.

### Backend
| Package | Version | Mục đích |
|---------|---------|----------|
| express | ^4.19.2 | Web framework |
| typescript | ^5.4.5 | Type safety |
| jsonwebtoken | ^9.0.2 | JWT |
| bcryptjs | ^2.4.3 | Password hashing |
| pg | ^8.12.0 | PostgreSQL driver |
| express-validator | ^7.1.0 | Input validation |
| helmet | ^7.1.0 | Security headers |
| cors | ^2.8.5 | CORS |
| cookie-parser | ^1.4.6 | Cookie parsing |
| morgan | ^1.10.0 | HTTP logging |
| exceljs | ^4.4.0 | Workbook có format |
| minio | ^8.0.0 | Object storage |
| multer | ^2.1.1 | Upload file |
| tsx | ^4.15.6 | Dev runner |

### Frontend
| Package | Version | Mục đích |
|---------|---------|----------|
| react | ^19.2.4 | UI library |
| vite | ^8.0.1 | Build tool |
| typescript | ~5.9.3 | Type safety |
| react-router-dom | ^7.13.2 | Routing |
| axios | ^1.14.0 | HTTP client |
| @tanstack/react-query | ^5.95.2 | Server state |
| zustand | ^5.0.12 | Client state |
| react-hook-form | ^7.72.0 | Form |
| yup | ^1.7.1 | Form validation |
| tailwindcss | ^3.4.19 | Styling |
| lucide-react | ^1.7.0 | Icons |
| recharts | ^3.8.1 | Charts |
| exceljs | ^4.4.0 | Ghi Excel có format |

## 3. Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts      # pg Pool, max=20, timeout config
│   │   └── env.ts           # Load .env, parse DB/JWT configs
│   ├── controllers/
│   │   ├── authController.ts # Login, register, refresh, logout, me
│   │   └── userController.ts # getAllUsers, getUserById
│   ├── middleware/
│   │   ├── auth.ts          # authenticateToken, authorizeRoles
│   │   ├── errorHandler.ts  # Global error handler
│   │   └── validate.ts      # express-validator wrapper
│   ├── routes/
│   │   ├── index.ts          # Mount: /auth, /users
│   │   ├── auth.ts           # 5 auth endpoints
│   │   └── users.ts          # 2 user endpoints
│   ├── services/
│   │   └── authService.ts    # hashPassword, comparePassword, createUser, findUser*
│   ├── types/
│   │   ├── user.ts           # UserRole enum, User interface, UserPublic interface
│   │   └── api.ts            # ApiResponse, PaginationMeta
│   ├── utils/
│   │   ├── jwt.ts            # generateAccessToken, generateRefreshToken, verifyToken
│   │   ├── password.ts       # hashPassword (bcrypt sync), comparePassword
│   │   └── response.ts       # sendSuccess, sendError helpers
│   ├── migrations/
│   │   └── 001_create_users.sql
│   ├── scripts/
│   │   └── create-admin.ts   # Seed admin user script
│   ├── app.ts               # Express setup (cors, helmet, json, cookie, routes, errorHandler)
│   └── server.ts            # Entry point, DB connect, listen on PORT
├── .env                     # Contains real credentials (NOT committed)
├── package.json
└── tsconfig.json

frontend/
├── src/
│   ├── api/
│   │   ├── axiosClient.ts    # Axios instance, request/response interceptors
│   │   └── authApi.ts        # login, register, logout, getMe
│   ├── components/
│   │   ├── ProtectedRoute.tsx # Redirect to /login if not authenticated
│   │   └── ui/
│   │       ├── Button.tsx    # forwardRef, variants: primary/secondary/danger/outline/ghost
│   │       ├── Input.tsx     # forwardRef, label + error support
│   │       ├── Card.tsx       # Card/CardHeader/CardContent/CardFooter
│   │       ├── Table.tsx      # Table/TableHeader/TableBody/TableRow/TableHead/TableCell
│   │       ├── Modal.tsx      # Portal modal, sizes: sm/md/lg/xl
│   │       ├── Select.tsx     # forwardRef, options array, label + error
│   │       └── Badge.tsx     # variants: default/success/warning/danger/info
│   ├── contexts/
│   │   └── AuthContext.tsx    # AuthProvider: login, logout, refreshUser, isLoading
│   ├── hooks/
│   │   ├── useAuth.ts         # useContext(AuthContext)
│   │   └── useApi.ts          # (placeholder)
│   ├── layouts/
│   │   ├── MainLayout.tsx    # Sidebar (nav: Dashboard, Sổ KT, Báo cáo, Cài đặt) + header
│   │   └── AuthLayout.tsx    # Logo + centered Outlet
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx  # React Hook Form + Yup, useAuth().login()
│   │   │   └── RegisterPage.tsx
│   │   └── dashboard/
│   │       └── DashboardPage.tsx
│   ├── stores/
│   │   └── authStore.ts      # Zustand: user, isAuthenticated, setUser, logout
│   ├── types/
│   │   ├── user.ts           # UserPublic (id: number), AuthTokens, LoginRequest, RegisterRequest
│   │   └── api.ts
│   ├── utils/
│   │   ├── cn.ts             # clsx + twMerge helper
│   │   └── format.ts         # (placeholder)
│   ├── App.tsx               # QueryClientProvider > AuthProvider > Router
│   ├── Router.tsx            # BrowserRouter, public + protected routes
│   ├── main.tsx
│   └── index.css             # Tailwind directives
├── .env                      # VITE_API_URL=http://localhost:3021/api
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.app.json

mobile/            # Client Flutter
docs/              # Spec và task
```

## 4. Environment Configuration

Giá trị nằm trong `backend/.env` và `frontend/.env`. File knowhow chỉ liệt kê tên biến.

### Backend
`PORT`, `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_BANG_KE_BUCKET`, `MINIO_BUCKET_TICKET_ATTACHEMENTS`, `MINIO_BUCKET_TICKET_ATTACHMENTS`, `MINIO_PUBLIC_URL`

`DATABASE_URL` nếu có thì pool dùng connection string. Không có thì dùng các biến `DB_*`.

### Frontend
`VITE_API_URL` — base URL của API, gồm hậu tố `/api`.

## 5. Database Configuration

- **Driver:** `pg` Pool
- **Pool:** max 20, min 2, idleTimeout 30s, connectionTimeout 10s, keepAlive
- **Timezone session:** `Asia/Ho_Chi_Minh`
- **SSL:** bật khi `DB_SSL=true` (`rejectUnauthorized: false`)
- **Mapping:** `src/config/env.ts` → `src/config/database.ts`

## 6. Database Schema

### accountant_invoices
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| batch_id | VARCHAR(50) | NOT NULL |
| ngay | DATE | NOT NULL |
| so_xe | VARCHAR(100) | NOT NULL |
| so_hoa_don | TEXT | NOT NULL |
| trang_thai | VARCHAR(20) | NOT NULL DEFAULT 'không có' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| ghi_chu | TEXT | — |

**Indexes:** `idx_accountant_invoices_batch_id` (batch_id); `idx_accountant_invoices_ngay` (ngay); `idx_accountant_invoices_so_hoa_don` (so_hoa_don); `idx_accountant_invoices_trang_thai` (trang_thai); `idx_accountant_invoices_so_xe` (so_xe)

### customers
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| diem_tra_hang | VARCHAR(255) | NOT NULL |
| ten_khach_hang | VARCHAR(500) | NOT NULL |
| tuyen_phuong | VARCHAR(255) | — |
| tuyen_cu | VARCHAR(255) | — |
| dia_chi_giao_hang | TEXT | — |
| boc_xep | BOOLEAN | NOT NULL DEFAULT TRUE |
| status | VARCHAR(20) | NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactive')) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP |
| supplier_code | VARCHAR(20) | — |
| diem_giao_hang_tinh_phi | VARCHAR(255) | — |

**Indexes:** `idx_customers_diem_tra_hang` (diem_tra_hang); `idx_customers_status` (status); `idx_customers_tuyen_phuong` (tuyen_phuong); `idx_customers_supplier_code` (supplier_code)
### driver_invoices
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| ma | VARCHAR(50) | NOT NULL |
| ten_tx | VARCHAR(255) | NOT NULL |
| ngay | DATE | NOT NULL |
| so_xe | VARCHAR(50) | NOT NULL |
| noi_giao | VARCHAR(255) | NOT NULL |
| ghi_chu | TEXT | — |
| so_hoa_don | JSONB | DEFAULT '[]'::jsonb |
| original_filename | VARCHAR(255) | — |
| uploaded_by | INTEGER | REFERENCES users(id) |
| uploaded_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

**Indexes:** UNIQUE `idx_driver_invoices_unique` (ma, ngay, so_xe, ghi_chu); `idx_driver_invoices_ngay` (ngay); `idx_driver_invoices_so_xe` (so_xe); `idx_driver_invoices_ma` (ma); `idx_driver_invoices_uploaded_by` (uploaded_by); `idx_driver_invoices_ghi_chu` (ghi_chu)

### drivers
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | NOT NULL REFERENCES users(id) ON DELETE RESTRICT |
| status | VARCHAR(20) | NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactive')) |
| notes | TEXT | — |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP |

**Indexes:** UNIQUE `idx_drivers_user_id_active` (user_id); `idx_drivers_status` (status)

### feature_scopes
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| feature_code | VARCHAR(100) | UNIQUE NOT NULL |
| feature_name | VARCHAR(200) | NOT NULL |
| module | VARCHAR(50) | NOT NULL |
| allowed_scope_types | VARCHAR(50)[] | NOT NULL |
| entity_types | VARCHAR(50)[] | DEFAULT '{}' |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:** `idx_fuel_record_images_record` (fuel_record_id)

### role_permissions
| Column | Type | Constraints |
|--------|------|-------------|
| role_id | INTEGER | NOT NULL REFERENCES roles(id) ON DELETE CASCADE |
| permission_id | INTEGER | NOT NULL REFERENCES permissions(id) ON DELETE CASCADE |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() |

**Table constraints:** PRIMARY KEY (role_id, permission_id)

**Indexes:** `idx_role_permissions_role_id` (role_id); `idx_role_permissions_permission_id` (permission_id)

### role_scope_configs
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| feature_code | VARCHAR(100) | NOT NULL REFERENCES feature_scopes(feature_code) ON DELETE CASCADE |
| role_id | INTEGER | NOT NULL REFERENCES roles(id) ON DELETE CASCADE |
| scope_type | VARCHAR(20) | NOT NULL CHECK (scope_type IN ('all', 'owner', 'entity', 'none')) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**Table constraints:** CONSTRAINT uq_role_scope_configs UNIQUE(feature_code, role_id)

**Indexes:** `idx_role_scope_configs_lookup` (feature_code, role_id)

### roles
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| name | VARCHAR(100) | NOT NULL |
| code | VARCHAR(50) | UNIQUE NOT NULL |
| description | TEXT | — |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE |
| is_system | BOOLEAN | NOT NULL DEFAULT FALSE |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() |

**Indexes:** `idx_roles_code` (code); `idx_roles_is_active` (is_active)

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| email | VARCHAR(255) | UNIQUE NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| full_name | VARCHAR(255) | NOT NULL |
| role | VARCHAR(50) | NOT NULL DEFAULT 'VIEWER' |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE |
| last_login_at | TIMESTAMP | — |
| created_by | INTEGER | REFERENCES users(id) |
| updated_by | INTEGER | REFERENCES users(id) |
| role_id | INTEGER | REFERENCES roles(id) |
| username | VARCHAR(100) | NOT NULL |

**Table constraints:** users_username_unique UNIQUE (username)

**Indexes:** `idx_users_role` (role); `idx_users_is_active` (is_active); `idx_users_role_id` (role_id); `idx_users_username` (username)

### vehicles
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| plate_number | VARCHAR(20) | NOT NULL |
| driver_name | VARCHAR(255) | NOT NULL |
| status | VARCHAR(20) | NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactive')) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP |
| oil_change_interval_km | INTEGER | NOT NULL DEFAULT 5000 |
| vehicle_type | VARCHAR(10) | NOT NULL DEFAULT 'Xe nhà' CHECK (vehicle_type IN ('Xe nhà', 'Xe ngoài')) |

**Indexes:** UNIQUE `idx_vehicles_plate_number_active` (plate_number); `idx_vehicles_status` (status); `idx_vehicles_driver_name` (driver_name); `idx_vehicles_type` (vehicle_type)

## 7. API Endpoints

Base URL: `/api`. `GET /health` nằm ngoài prefix đó.

### Public Endpoints — /public

| Method | Path | Auth | Body/Query | Response |
|--------|------|------|------------|----------|
| GET | /public/invoice-tracking/:token | No (Public) | — | `{ success, data: PublicInvoiceTicket }` — Xem thông tin & chứng từ ticket qua liên kết chia sẻ |

### Authentication — /auth

| Method | Path | Auth | Body | Query | Params | Response |
|--------|------|------|------|-------|--------|----------|
| POST | `/api/auth/register` | No | { username, email, password, full_name, role? } | — | — | { success, message, data: { user, accessToken, refreshToken } } + httpOnly cookie `refreshToken` |
| POST | `/api/auth/login` | No | { username, password } | — | — | { success, message, data: { user: userPublic, accessToken, refreshToken } } + httpOnly cookie `refreshToken` |
| POST | `/api/auth/refresh` | No | — | — | — | { success, message, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } } + httpOnly cookie `refreshToken` |
| POST | `/api/auth/logout` | No | — | — | — | { success, message, data: — } |
| GET | `/api/auth/me` | JWT | — | — | — | { success, message, data: user } |

### Users — /users (ADMIN only)

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | /users | JWT + ADMIN | query: search, role, is_active, page, limit | `{ success, message, data: { users[], meta } }` |
| GET | /users/:id | JWT + ADMIN | — | `{ success, message, data: UserPublic }` |
| POST | /users | JWT + ADMIN | `{ email, password, full_name, role? }` | `{ success, message, data: UserPublic }` |
| PUT | /users/:id | JWT + ADMIN | `{ full_name?, role?, is_active? }` | `{ success, message, data: UserPublic }` |
| DELETE | /users/:id | JWT + ADMIN | — | `{ success, message }` |
| PATCH | /users/:id/password | JWT + ADMIN | `{ new_password }` | `{ success, message }` |

### /customers

| Method | Path | Auth | Body | Query | Params | Response |
|--------|------|------|------|-------|--------|----------|
| GET | `/api/customers` | JWT + accounting_data.view | — | — | — | { success, message, data: data } |
| POST | `/api/customers/upload` | JWT + accounting_data.manage | { rows, rows.*.diem_tra_hang, rows.*.ten_khach_hang, rows.*.boc_xep?, rows.*.supplier_code?, rows.*.diem_giao_hang_tinh_phi? } | — | — | { success, message, data: result } |
| POST | `/api/customers` | JWT + accounting_data.manage | { diem_tra_hang, ten_khach_hang, tuyen_phuong?, tuyen_cu?, dia_chi_giao_hang?, diem_giao_hang_tinh_phi?, boc_xep?, supplier_code? } | — | — | { success, message, data: row } |
| PUT | `/api/customers/:id` | JWT + accounting_data.manage | { diem_tra_hang, ten_khach_hang, tuyen_phuong?, tuyen_cu?, dia_chi_giao_hang?, diem_giao_hang_tinh_phi?, boc_xep?, supplier_code? } | — | { id } | { success, message, data: row } |
| DELETE | `/api/customers/:id` | JWT + accounting_data.manage | — | — | { id } | { success, message, data: — } |

### Dashboard — /dashboard

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | /dashboard/overview | JWT + dashboard.view | KPI tháng/quý (`?period=month\|quarter`), tấn theo 6 tháng, cảnh báo hết hạn, dispatch hôm nay, job reconcile gần nhất |
| GET | /dashboard/vehicle-maintenance | JWT + vehicle_data.view | Đăng kiểm/bảo hiểm theo bucket hạn, xe đến hạn thay nhớt, chi phí sửa chữa 12 tháng |
| GET | /dashboard/accounting | JWT + accounting_data.view | Tổng matched/unmatched, theo tháng, batch gần đây, lịch sử reconcile job |
| GET | /dashboard/operations | JWT + dispatch.view | Chuyến/tấn theo ngày & theo xe (`?date_from&date_to`, mặc định 30 ngày), hóa đơn tài xế |
| GET | /dashboard/fuel | JWT + fuel.view | Chi phí/lít 6 tháng, tiêu thụ theo xe, chênh lệch đồng hồ vs GPS |

**FE:** Trang `/` (DashboardPage) — tabs trong 1 trang, filter theo permission. Files: `frontend/src/pages/dashboard/tabs/*.tsx`, `frontend/src/api/dashboardApi.ts`, `frontend/src/hooks/useDashboard.ts`.

### Data Scopes — /data-scopes
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | /data-scopes/me | JWT | Lấy tóm tắt phân quyền dữ liệu của user hiện tại |
| GET | /data-scopes/features | data_scopes.view | Danh sách tính năng và ma trận scope vai trò |
| PUT | /data-scopes/features/:code/roles/:roleId | data_scopes.manage | Cập nhật scope_type của vai trò cho tính năng |
| GET | /data-scopes/user-entities | data_scopes.view | Danh sách gán entity cho user |
| POST | /data-scopes/user-entities | data_scopes.manage | Gán entity cho user |
| DELETE | /data-scopes/user-entities/:id | data_scopes.manage | Hủy gán entity cho user |

### /delivery-data

| Method | Path | Auth | Body | Query | Params | Response |
|--------|------|------|------|-------|--------|----------|
| POST | `/api/delivery-data/import` | JWT + delivery_data.manage | multipart `file` | — | — | { success, message, data: result } |
| GET | `/api/delivery-data/batches` | JWT + delivery_data.view | — | { page?, limit? } | — | { success, message, data: result } |
| GET | `/api/delivery-data/batches/:batchId` | JWT + delivery_data.view | — | — | { batchId } | { success, message, data: result } |
| DELETE | `/api/delivery-data/batches/:batchId` | JWT + delivery_data.manage | — | — | { batchId } | { success, message, data: result } |
| POST | `/api/delivery-data/batches/rows` | JWT + delivery_data.view | { batch_ids, batch_ids.* } | — | — | { success, message, data: result } |

### /accountant-invoices

| Method | Path | Auth | Body | Query | Params | Response |
|--------|------|------|------|-------|--------|----------|
| GET | `/api/accountant-invoices` | JWT + accounting_data.view | — | { page?, limit?, batch_id?, ngay_from?, ngay_to?, so_xe?, so_hoa_don?, trang_thai? } | — | { success, message, data: result } |
| GET | `/api/accountant-invoices/missing-summary` | JWT + accounting_data.view | — | { batch_id?, in_catalog? } | — | { success, message, data: result } |
| PUT | `/api/accountant-invoices/:id` | JWT + accounting_data.manage | { trang_thai, ghi_chu?, so_xe? } | — | { id } | { success, message, data: row } |

### /drivers

| Method | Path | Auth | Body | Query | Params | Response |
|--------|------|------|------|-------|--------|----------|
| GET | `/api/drivers` | JWT + catalog.view | — | — | — | { success, message, data: data } |
| GET | `/api/drivers/available-users` | JWT + catalog.manage | — | — | — | { success, message, data: users } |
| GET | `/api/drivers/available-vehicles` | JWT + catalog.manage | — | — | — | { success, message, data: vehicles } |
| GET | `/api/drivers/by-vehicle/:vehicleId` | JWT | — | — | { vehicleId } | { success, message, data: drivers } |
| POST | `/api/drivers` | JWT + catalog.manage | { user_id, vehicle_ids, vehicle_ids.*, notes? } | — | — | { success, message, data: driver } |
| PUT | `/api/drivers/:id` | JWT + catalog.manage | { vehicle_ids, vehicle_ids.*, notes? } | — | { id } | { success, message, data: driver } |
| PATCH | `/api/drivers/:id/toggle` | JWT + catalog.manage | — | — | { id } | { success, message, data: driver } |
| DELETE | `/api/drivers/:id` | JWT + catalog.manage | — | — | { id } | { success, message, data: — } |

### Invoice Tracking — /invoice-tracking

| Method | Path | Auth | Body/Query | Response |
|--------|------|------|------------|----------|
| GET | /invoice-tracking | JWT + invoice_tracking.view | query: `status`, `date_from`, `date_to`, `search`, `ghi_chu`, `page`, `limit` | `{ success, data: { items: InvoiceTrackingTicket[], pagination } }` |
| GET | /invoice-tracking/statistics | JWT + invoice_tracking.view | query: `date_from`, `date_to`, `bien_so`, `driver_id`, `tai_xe`, `ghi_chu` | `{ success, data: InvoiceTrackingStatisticsResult }` — Thống kê theo tài xế |
| GET | /invoice-tracking/:id | JWT + invoice_tracking.view | — | `{ success, data: InvoiceTrackingTicket }` |
| GET | /invoice-tracking/:id/history | JWT + invoice_tracking.view | — | `{ success, data: InvoiceTrackingHistoryItem[] }` — Lịch sử thao tác |
| GET | /invoice-tracking/:id/copyable-tickets | JWT + invoice_tracking.view | — | `{ success, data: CopyableTicket[] }` — Danh sách chuyến cùng ngày để sao chép |
| GET | /invoice-tracking/files/:filename | No (Public) | — | Serve tệp từ MinIO bucket (redirect 302 sang presigned URL 24h) |
| POST | /invoice-tracking/:id/share | JWT + invoice_tracking.view | — | `{ success, data: { share_token } }` — Tạo / lấy mã chia sẻ công khai |
| POST | /invoice-tracking/:id/copy-documents | JWT + invoice_tracking.view | `{ source_ticket_id, driver_note? }` | `{ success, data: InvoiceTrackingTicket }` — Sao chép chứng từ không nhân bản tệp |
| POST | /invoice-tracking/:id/documents | JWT + invoice_tracking.view | `multipart/form-data` (files, driver_note) | `{ success, data: InvoiceTrackingTicket }` — Tải tệp lên MinIO |
| POST | /invoice-tracking/batch-finish | JWT + invoice_tracking.manage | `{ ticket_ids: number[] }` | `{ success, data: BatchFinishResult }` — Phê duyệt hoàn thành hàng loạt |
| PUT | /invoice-tracking/:id/review | JWT + invoice_tracking.manage | `{ action: 'finish' \| 'request_supplement', supplement_note? }` | `{ success, data: InvoiceTrackingTicket }` |

### System

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | /health | No | `{ status: 'ok', timestamp }` |

Frontend: accordion **Quản lý giá cước vận tải** → `/route-pricing/periods|sets|routes|matrix`

### Dispatch Schedules — /dispatch-schedules

| Method | Path | Auth | Body/Query | Response |
|--------|------|------|------------|----------|
| GET | /dispatch-schedules | JWT | query: `date=YYYY-MM-DD` (required) | `{ success, data: { xe_nho: DispatchSchedule[], xe_lon: DispatchSchedule[], tuyen_ngoai: DispatchSchedule[] } }` |
| POST | /dispatch-schedules | JWT | `{ ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe?, ma_chuyen?, diem_nhan, diem_tra, gio_nhan, ghi_chu?, vehicle_id?, trip_code_id? }` | `{ success, data: DispatchSchedule }` |
| POST | /dispatch-schedules/batch | JWT | `{ items: CreateDispatchScheduleBatchItem[] }` — mỗi item có thêm `driver_id?` | `{ success, data: DispatchSchedule[] }` |
| PUT | /dispatch-schedules/:id | JWT + dispatch.manage | `{ bien_so, tai_xe?, ma_chuyen?, diem_nhan, diem_tra, gio_nhan, ghi_chu?, vehicle_id?, trip_code_id? }` | `{ success, data: DispatchSchedule }` |
| DELETE | /dispatch-schedules/:id | JWT + dispatch.manage | — | `{ success, message }` |

### Response Format Convention

```typescript
// Success
{ success: true, message: string, data: T }

// Error
{ success: false, message: string, error: string }

// Validation error
{ success: false, message: 'Validation failed', error: string }
```

## 8. Middleware

| Middleware | File | Description |
|-----------|------|-------------|
| `authenticateToken` | auth.ts | Verify JWT from `Authorization: Bearer <token>`. 401 if missing or invalid. |
| `requirePermission(code)` | auth.ts | Check `req.user.permissions` contains `code`. 403 if missing. |
| `authorizeRoles(...roles)` | auth.ts | Check `req.user.role` against allowed roles. 403 if insufficient. |
| `validate(validations[])` | validate.ts | Run express-validator chains, return 400 with error list if invalid. |
| `errorHandler` | errorHandler.ts | Global catch-all, log + return 500. |

**Auth flow trên route:** `authenticateToken` rồi `requirePermission(code)` rồi controller. `authorizeRoles` vẫn có trong middleware cho chỗ gọi trực tiếp.

## 9. Frontend Routes

| Path | Layout | Auth | Màn hình |
|------|--------|------|----------|
| /support | — | Public | SupportPage |
| /privacy | — | Public | PrivacyPolicyPage |
| /privacy-policy | — | Public | Redirect sang /privacy |
| /shared/invoice-tracking/:token | — | Public | PublicTicketViewPage |
| /login | AuthLayout | Public | LoginPage |
| /register | AuthLayout | Public | RegisterPage |
| / | MainLayout | Protected | DashboardPage |
| /accounting | MainLayout | Protected | PlaceholderPage |
| /reports | MainLayout | Protected | PlaceholderPage |
| /settings | MainLayout | Protected | PlaceholderPage |
| /users | MainLayout | Protected | UserManagementPage |
| /roles | MainLayout | Protected | RoleManagementPage |
| /permissions | MainLayout | Protected | PermissionManagementPage |
| /settings/data-scopes | MainLayout | Protected | DataScopeManagementPage |
| /settings/workflows | MainLayout | Protected | WorkflowManagementPage |
| /logs | MainLayout | Protected | AuditLogPage |
| /delivery-data/5-houses | MainLayout | Protected | DeliveryDataPage |
| /delivery-data/rice | MainLayout | Protected | RiceDeliveryDataPage |
| /vehicle-data/driver-invoices | MainLayout | Protected | DriverInvoicesPage |
| /vehicle-data/inspections | MainLayout | Protected | InspectionPage |
| /vehicle-data/oil-changes | MainLayout | Protected | OilChangePage |
| /vehicle-data/insurances | MainLayout | Protected | InsurancePage |
| /vehicle-data/repairs | MainLayout | Protected | RepairPage |
| /dispatch/schedule | MainLayout | Protected | SchedulePage |
| /invoice-tracking | MainLayout | Protected | InvoiceTrackingPage |
| /accounting-data/weight-adjustments | MainLayout | Protected | WeightAdjustmentPage |
| /accounting-data/customers | MainLayout | Protected | CustomersPage |
| /accounting-data/delivery-import | MainLayout | Protected | DeliveryImportPage |
| /accounting-data/invoice-matching | MainLayout | Protected | InvoiceMatchingPage |
| /accounting-data/bang-ke-tho | MainLayout | Protected | BangKeThoPage |
| /accounting-data/reconcile-jobs | MainLayout | Protected | Redirect sang /jobs/reconcile |
| /jobs/reconcile | MainLayout | Protected | ReconcileJobPage |
| /fuel-data | MainLayout | Protected | FuelDataPage |
| /fuel-data/statistics | MainLayout | Protected | FuelStatisticsPage |
| /catalog/vehicles | MainLayout | Protected | VehicleCatalogPage |
| /catalog/vehicles/:id | MainLayout | Protected | VehicleDetailPage |
| /catalog/inner-city-customers | MainLayout | Protected | InnerCityCustomerPage |
| /catalog/suppliers | MainLayout | Protected | SupplierCatalogPage |
| /catalog/promo-items | MainLayout | Protected | PromoItemCatalogPage |
| /catalog/delivery-points | MainLayout | Protected | DeliveryPointCatalogPage |
| /catalog/drivers | MainLayout | Protected | DriverCatalogPage |
| /route-pricing | MainLayout | Protected | RoutePricingRedirect |
| /route-pricing/periods | MainLayout | Protected | RoutePricingPage |
| /route-pricing/sets | MainLayout | Protected | RoutePricingPage |
| /route-pricing/routes | MainLayout | Protected | RoutePricingPage |
| /route-pricing/matrix | MainLayout | Protected | RoutePricingPage |
| /route-pricing/surcharges | MainLayout | Protected | CustomerSurchargesPage |
| * | — | — | Redirect sang / |

**Router:** `BrowserRouter` và JSX `<Routes>`. `AuthProvider` nằm trong `<BrowserRouter>`. Điều hướng nằm ở page, qua `useNavigate()`.

## 10. Authentication Flow

### Login
1. User gửi `{ username, password }` → `POST /api/auth/login`
2. Backend: tìm user, so sánh bcrypt hash → sinh accessToken (15m) + refreshToken (7d)
3. Backend trả: `{ user, accessToken }` trong body + `refreshToken` trong httpOnly cookie
4. Frontend lưu `accessToken` vào localStorage, set user vào Zustand store
5. Redirect về `/`

### Authenticated requests
- Axios interceptor đọc `access_token` từ localStorage → gắn `Authorization: Bearer <token>` vào mọi request

### 401 handling
- Axios response interceptor bắt 401 → xóa tokens, redirect `/login`

### Token refresh
- `POST /api/auth/refresh` đọc `refreshToken` từ httpOnly cookie → trả accessToken mới

## 11. UI Components

Tất cả components dùng Tailwind CSS, hỗ trợ `className` prop, forwardRef.

| Component | Props chính | Variants/Options |
|-----------|-------------|------------------|
| Button | variant, size, isLoading | primary, secondary, danger, outline, ghost |
| Input | label, error | — |
| Card | children | CardHeader, CardContent, CardFooter |
| Table | children | TableHeader, TableBody, TableRow, TableHead, TableCell |
| Modal | isOpen, onClose, title, size | sm, md, lg, xl |
| Select | label, error, options | — |
| Badge | variant | default, success, warning, danger, info |

## 12. Development Commands

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## 13. Key Conventions

- **Files:** camelCase (functions, vars), PascalCase (components, classes), snake_case (DB)
- **API response:** Wrap trong `{ success, message, data }`. Frontend unwrap qua `response.data.data`
- **Password:** bcrypt hashSync (salt rounds = 10). Không trả `password_hash` về client
- **JWT:** Cùng secret cho access token và refresh token
- **CORS:** `backend/src/app.ts` dùng hàm `origin`. Origin nằm trong mảng `allowedOrigins` được phép. Mọi `http://localhost` và `http://127.0.0.1` kèm port bất kỳ được phép. Request không có header Origin được phép. Không dùng `CORS_ORIGIN`
- **.env:** Không commit git
