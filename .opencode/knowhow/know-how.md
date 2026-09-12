---
description: File mô tả project structure, database schema, API endpoint của dự án PhuPhatCorp Accounting Web App
---

# PhuPhatCorp — Technical Documentation

## 1. Project Overview

- **Mục đích:** Hệ thống web hỗ trợ công ty PhuPhatCorp xử lý số liệu kế toán
- **Cấu trúc:** Monorepo — `backend/` (NodeJS) + `frontend/` (ReactJS)
- **Database:** PostgreSQL tại `72.61.124.36:5443/test_PhuPhatCorp`
- **Auth:** JWT (access token 15m + refresh token 7d trong httpOnly cookie)

## 2. Tech Stack

### Backend
| Package | Version | Mục đích |
|---------|---------|----------|
| express | ^4.19.2 | Web framework |
| typescript | ^5.4.5 | Type safety |
| jsonwebtoken | ^9.0.2 | JWT generation/verification |
| bcryptjs | ^2.4.3 | Password hashing |
| pg | ^8.12.0 | PostgreSQL driver |
| express-validator | ^7.1.0 | Input validation |
| helmet | ^7.1.0 | Security headers |
| cors | ^2.8.5 | CORS |
| cookie-parser | ^1.4.6 | Cookie parsing |
| morgan | ^1.10.0 | HTTP logging |
| tsx | ^4.15.6 | Dev runner (tsx watch) |

### Frontend
| Package | Version | Mục đích |
|---------|---------|----------|
| react | ^18 | UI library |
| vite | ^8 | Build tool |
| typescript | ^5 | Type safety |
| react-router-dom | ^6 | Routing |
| axios | — | HTTP client |
| @tanstack/react-query | — | Server state |
| zustand | — | Client state (auth store) |
| react-hook-form + yup | — | Form + validation |
| tailwindcss | ^3 | Styling |
| lucide-react | — | Icons |
| recharts | — | Charts |

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

web_v2/
├── CLAUDE.md                 # Project summary for Claude agents
├── backend/
└── frontend/
```

## 4. Environment Configuration

### Backend (backend/.env)
```
PORT=3021
DB_HOST=72.61.124.36
DB_PORT=5443
DB_NAME=test_PhuPhatCorp
DB_USER=postgres
DB_PASSWORD=<secret>
DB_SSL=false
JWT_SECRET=<secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### Frontend (frontend/.env)
```
VITE_API_URL=http://localhost:3021/api
```

## 5. Database Configuration

- **Driver:** `pg` (node-postgres) Pool
- **Pool config:** max=20 connections, idleTimeout=30s, connectionTimeout=2s
- **SSL:** disabled (`DB_SSL=false`)
- **Env mapping:** via `src/config/env.ts` → `src/config/database.ts`

## 6. Database Schema

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| username | VARCHAR(100) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| full_name | VARCHAR(255) | NOT NULL |
| role | VARCHAR(50) | NOT NULL, DEFAULT 'VIEWER' |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE |
| last_login_at | TIMESTAMP | NULL |
| created_by | INTEGER | FK → users(id), NULL |
| updated_by | INTEGER | FK → users(id), NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `idx_users_role`, `idx_users_is_active`, `idx_users_username`

### user_activities
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| actor_id | INTEGER | NOT NULL, FK → users(id) |
| target_user_id | INTEGER | FK → users(id), NULL |
| action | VARCHAR(50) | NOT NULL |
| details | JSONB | NULL |
| ip_address | VARCHAR(45) | NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `idx_user_activities_actor`, `idx_user_activities_target`
**Actions:** `CREATE_USER`, `UPDATE_USER`, `DELETE_USER`, `RESET_PASSWORD`, `TOGGLE_STATUS`

### customers
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| diem_tra_hang | VARCHAR(255) | NOT NULL |
| ten_khach_hang | VARCHAR(255) | NOT NULL |
| tuyen_phuong | VARCHAR(255) | NULL |
| tuyen_cu | VARCHAR(255) | NULL |
| dia_chi_giao_hang | TEXT | NULL |
| diem_giao_hang_tinh_phi | VARCHAR(255) | NULL |
| boc_xep | BOOLEAN | NOT NULL, DEFAULT TRUE |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active' |
| created_by | INTEGER | FK → users(id), NULL |
| updated_by | INTEGER | FK → users(id), NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `idx_customers_diem_tra_hang`, `idx_customers_status`
**Soft delete:** `status = 'deactive'` (không xóa cứng)
**Migration:** `012_create_customers.sql`, `043_add_diem_giao_hang_tinh_phi_to_customers.sql`

### customer_suppliers (junction N-N: customers ↔ suppliers)
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| customer_id | INTEGER | NOT NULL, FK → customers(id) ON DELETE CASCADE |
| supplier_id | INTEGER | NOT NULL, FK → suppliers(id) ON DELETE CASCADE |
| created_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |

**Constraints:** UNIQUE(customer_id, supplier_id)
**Indexes:** `idx_customer_suppliers_customer`, `idx_customer_suppliers_supplier`
**Populate:** Auto-populated khi import `delivery_data` (match `ten_kh` → `customers.ten_khach_hang`, `ma_ncc` → `suppliers.supplier_code`)
**Migration:** `019_create_customer_suppliers.sql`

**Roles:** `ADMIN`, `ACCOUNTANT`, `VIEWER`

**Admin account:**
- Email: `admin@phuphatcorp.com`
- Password: `Admin@123456`

## 7. API Endpoints

Base URL: `/api`

### Authentication — /auth

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | /auth/register | No | `{ username, email, password, full_name, role? }` | `{ success, message, data: { user, accessToken } }` |
| POST | /auth/login | No | `{ username, password }` | `{ success, message, data: { user, accessToken } }` + httpOnly cookie `refreshToken` |
| POST | /auth/refresh | Cookie | — | `{ success, message, data: { accessToken } }` |
| POST | /auth/logout | No | — | `{ success, message }` + clear cookie |
| GET | /auth/me | JWT | — | `{ success, message, data: user }` |

### Users — /users (ADMIN only)

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | /users | JWT + ADMIN | query: search, role, is_active, page, limit | `{ success, message, data: { users[], meta } }` |
| GET | /users/:id | JWT + ADMIN | — | `{ success, message, data: UserPublic }` |
| POST | /users | JWT + ADMIN | `{ email, password, full_name, role? }` | `{ success, message, data: UserPublic }` |
| PUT | /users/:id | JWT + ADMIN | `{ full_name?, role?, is_active? }` | `{ success, message, data: UserPublic }` |
| DELETE | /users/:id | JWT + ADMIN | — | `{ success, message }` |
| PATCH | /users/:id/password | JWT + ADMIN | `{ new_password }` | `{ success, message }` |

### Route Pricing — /route-pricing

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET/POST/DELETE | /route-pricing/adjustment-periods | view/manage | Kỳ điều chỉnh global; tạo kỳ = apply % mọi version mở; chỉ xóa kỳ gần nhất (= rollback) |
| GET | /route-pricing/geo/provinces | route_pricing.view | Master tỉnh |
| GET | /route-pricing/geo/wards | route_pricing.view | `?province_code=` |
| GET/POST/PUT/DELETE | /route-pricing/price-books | view/manage | Master bảng giá (tên tự do, unique active) |
| GET/POST/PUT/DELETE | /route-pricing/routes | view/manage | Scoped `price_book_id`; `ward_code` XOR `location_text`; `note` |
| GET/POST/PUT/DELETE | /route-pricing/groups | view/manage | Scoped `price_book_id`; `ward_codes[]` XOR `location_text` XOR residual |
| GET/POST | /route-pricing/prices | view/manage | Absolute: `adjustment_period_id` + cascade kỳ sau; `pricing_mode` `by_weight`\|`by_trips`\|`by_truck`; truck tiers dùng `label` |
| GET | /route-pricing/prices/matrix | view | Ma trận theo `price_book_id`: weight_tables[] + truck_tables[] + trips.rows |
| PUT | /route-pricing/prices/groups/:routeGroupId/absolute | manage | Sửa giá gốc + recompute cascade |
| GET | /route-pricing/lookup | view | **Deferred** (501 LOOKUP_DEFERRED) — CR riêng sau |

**FE:** Tab Kỳ điều chỉnh / Nhóm tuyến / Bảng giá. Bỏ nút Điều chỉnh % riêng. Không sửa kỳ — muốn đổi thì xóa rồi tạo lại.

BA: `docs/ba/20260711_route-pricing-analysis.md`  
UI: `docs/ui/20260731_route-pricing-adjustment-periods-cr-ui-spec.md`

### Dashboard — /dashboard

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | /dashboard/overview | JWT + dashboard.view | KPI tháng/quý (`?period=month\|quarter`), tấn theo 6 tháng, cảnh báo hết hạn, dispatch hôm nay, job reconcile gần nhất |
| GET | /dashboard/vehicle-maintenance | JWT + vehicle_data.view | Đăng kiểm/bảo hiểm theo bucket hạn, xe đến hạn thay nhớt, chi phí sửa chữa 12 tháng |
| GET | /dashboard/accounting | JWT + accounting_data.view | Tổng matched/unmatched, theo tháng, batch gần đây, lịch sử reconcile job |
| GET | /dashboard/operations | JWT + transport.view hoặc dispatch.view | Chuyến/tấn theo ngày & theo xe (`?date_from&date_to`, mặc định 30 ngày), hóa đơn tài xế |
| GET | /dashboard/fuel | JWT + fuel.view | Chi phí/lít 6 tháng, tiêu thụ theo xe, chênh lệch đồng hồ vs GPS |

**FE:** Trang `/` (DashboardPage) — tabs trong 1 trang, filter theo permission. Files: `frontend/src/pages/dashboard/tabs/*.tsx`, `frontend/src/api/dashboardApi.ts`, `frontend/src/hooks/useDashboard.ts`.

### System

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | /health | No | `{ status: 'ok', timestamp }` |

Frontend route: `/route-pricing` (sidebar top-level **Giá theo tuyến**)

### Dispatch Schedules — /dispatch-schedules

| Method | Path | Auth | Body/Query | Response |
|--------|------|------|------------|----------|
| GET | /dispatch-schedules | JWT | query: `date=YYYY-MM-DD` (required) | `{ success, data: { xe_nho: DispatchSchedule[], xe_lon: DispatchSchedule[], tuyen_ngoai: DispatchSchedule[] } }` |
| POST | /dispatch-schedules | JWT | `{ ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe?, ma_chuyen?, diem_nhan, diem_tra, gio_nhan, ghi_chu?, vehicle_id?, trip_code_id? }` | `{ success, data: DispatchSchedule }` |
| PUT | /dispatch-schedules/:id | JWT + dispatch.manage | `{ bien_so, tai_xe?, ma_chuyen?, diem_nhan, diem_tra, gio_nhan, ghi_chu?, vehicle_id?, trip_code_id? }` | `{ success, data: DispatchSchedule }` |
| DELETE | /dispatch-schedules/:id | JWT + dispatch.manage | — | `{ success, message }` |

### Customers — /customers

| Method | Path | Auth | Body/Query | Response |
|--------|------|------|------------|----------|
| GET | /customers | JWT + accounting_data.view | — | `{ success, data: Customer[] }` (only active records) |
| POST | /customers | JWT + accounting_data.manage | `{ diem_tra_hang, ten_khach_hang, tuyen_phuong?, tuyen_cu?, dia_chi_giao_hang?, diem_giao_hang_tinh_phi?, boc_xep? }` | `{ success, data: Customer }` |
| PUT | /customers/:id | JWT + accounting_data.manage | same as POST | `{ success, data: Customer }` |
| DELETE | /customers/:id | JWT + accounting_data.manage | — | `{ success, message }` (soft delete: status→'deactive') |
| POST | /customers/upload | JWT + accounting_data.manage | `{ rows: UploadCustomerRow[] }` | `{ success, data: { inserted: number } }` or `{ success: false, errors: [] }` (HTTP 422) |

**Error codes:**
- 409: `diem_tra_hang` đã tồn tại (duplicate check trên active records)
- 404: Không tìm thấy customer (hoặc đã bị deactivate)
- 422: Upload validation errors (all-or-nothing: nếu có lỗi thì không save bất kỳ dòng nào)

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
| `authenticateToken` | auth.ts | Verify JWT from `Authorization: Bearer <token>` header. 401 if missing, 403 if invalid/expired. |
| `authorizeRoles(...roles)` | auth.ts | Check `req.user.role` against allowed roles. 403 if insufficient. |
| `validate(validations[])` | validate.ts | Run express-validator chains, return 400 with error list if invalid. |
| `errorHandler` | errorHandler.ts | Global catch-all, log + return 500. |

**Auth flow:** `authenticateToken` → `authorizeRoles(...roles)` → controller

## 9. Frontend Routes (React Router v6)

| Path | Layout | Auth | Description |
|------|--------|------|-------------|
| /login | AuthLayout | Public | LoginPage |
| /register | AuthLayout | Public | RegisterPage |
| / | MainLayout | Protected | DashboardPage |
| /accounting | MainLayout | Protected | Placeholder |
| /reports | MainLayout | Protected | Placeholder |
| /settings | MainLayout | Protected | Placeholder |
| /delivery-data | MainLayout | Protected | DeliveryDataPage |
| /vehicle-data/trip-codes | MainLayout | Protected | TripCodePage |
| /vehicle-data/vehicles | MainLayout | Protected | VehiclePage |
| /vehicle-data/drivers | MainLayout | Protected | DriverPage |
| /dispatch/schedule | MainLayout | Protected | SchedulePage (Bảng điều phối xe) |
| /accounting-data/weight-adjustments | MainLayout | Protected | WeightAdjustmentPage (Điều chỉnh trọng lượng) |
| /accounting-data/customers | MainLayout | Protected | CustomersPage (Danh sách khách nhận hàng) |
| * | — | — | Navigate to / |

**Router pattern:** Dùng `BrowserRouter` + JSX `<Routes>` (KHÔNG dùng `createBrowserRouter` vì gây lỗi React context với AuthProvider).

**AuthProvider placement:** Phải nằm bên trong `<BrowserRouter>` trong `App.tsx`. Navigation xử lý tại page level thông qua `useNavigate()`, KHÔNG trong AuthProvider.

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
npm run dev              # tsx watch src/server.ts → http://localhost:3021

# Frontend
cd frontend
npm install
npm run dev              # vite → http://localhost:5173

# Tạo admin user
cd backend && npx tsx src/scripts/create-admin.ts

# Chạy migration
psql -h 72.61.124.36 -p 5443 -U postgres -d test_PhuPhatCorp -f src/migrations/001_create_users.sql
psql -h 72.61.124.36 -p 5443 -U postgres -d test_PhuPhatCorp -f src/migrations/012_create_customers.sql
```

## 13. Key Conventions

- **Files:** camelCase (functions, vars), PascalCase (components, classes), snake_case (DB)
- **API response:** Luôn wrap trong `{ success, message, data }` — frontend authApi unwrap: `response.data.data`
- **Password:** bcrypt hashSync (salt rounds = 10), KHÔNG bao giờ trả `password_hash` về client
- **JWT:** Cùng secret cho cả access + refresh token
- **CORS:** Whitelist hardcoded trong `app.ts` gồm: `localhost:5173`, `localhost:5174`, `phuphatcorp.scrapetool.cloud`. Dùng function validator `origin: (origin, callback)` để support multiple origins. Requests không có origin header (curl, mobile) được phép. Không dùng `CORS_ORIGIN` env var nữa — whitelist cứng dễ maintain hơn.
- **.env:** KHÔNG commit git