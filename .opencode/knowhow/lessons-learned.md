---
description: Ghi lại các bài học kinh nghiệm, bug đã fix, và pitfalls trong quá trình phát triển PhuPhatCorp.
---

# Lessons Learned — PhuPhatCorp

---
## Bug: User Management hiện `users.roles.IEU_PHOI_XE` thay vì tên vai trò
- **Ngày:** 2026-08-06
- **Severity:** Medium
- **Feature liên quan:** Quản lý người dùng — list + detail badge role
- **Triệu chứng:** Role tùy chỉnh (Điều phối xe, Kế toán viên, …) hiện raw i18n key `users.roles.<CODE>` trên UI.
- **Root cause:** FE dùng `t(\`users.roles.${user.role}\`)` trong khi `vi.json`/`en.json` chỉ có ADMIN/ACCOUNTANT/VIEWER. Key thiếu → `t()` trả về chính key. API đã trả `role_name` (`roles.name`) nhưng FE không dùng.
- **Fix:** Helper `getUserRoleLabel` — ưu tiên `role_name`, fallback i18n nếu có, else `role` code. Dùng ở `UserManagementPage` + `UserDetailModal`.
- **File sửa:** `frontend/src/utils/userRoleLabel.ts`, `UserManagementPage.tsx`, `UserDetailModal.tsx`
- **Regression test:** `frontend/src/utils/userRoleLabel.test.ts` (tsx assert)
- **Cần chú ý:** Không hardcode mọi role code vào i18n — role động lấy từ DB. Mọi chỗ hiển thị role user nên dùng `role_name` / `getUserRoleLabel`, không `t(users.roles.*)`.

---

## Bug: Create user luôn nhận role VIEWER dù chọn role khác
- **Ngày:** 2026-08-06
- **Severity:** High
- **Feature liên quan:** User Management — Create User (admin panel)
- **Triệu chứng:** Tạo user mới chọn bất kỳ role nào → UI luôn hiện VIEWER; phải Edit/Update lại mới đúng.
- **Root cause:** FE `CreateUserModal` chỉ gửi `role_id`. `userService.createUser` set `users.role = data.role || VIEWER` mà không sync `roles.code` từ `role_id`. Cột legacy `role` (dùng cho badge UI + `authorizeRoles`) luôn VIEWER; `role_id` thì đúng. `updateUser` đã sync `role` từ `roles.code` nên sửa sau khi tạo thì hết lỗi.
- **Fix:** Khi validate `role_id`, SELECT thêm `code`; gán `role = roleFromId || data.role || VIEWER` trước INSERT — mirror pattern `updateUser`.
- **File sửa:** `backend/src/services/userService.ts` (createUser)
- **Regression test:** `backend/src/__tests__/userService.test.ts` — create với chỉ `role_id=ACCOUNTANT` → INSERT `role='ACCOUNTANT'`; không có role_id → VIEWER.
- **Cần chú ý:** Hệ thống còn dual-write `users.role` (VARCHAR) + `users.role_id` (FK). Mọi path create/update phải sync cả hai; FE hiện tại chỉ gửi `role_id`.

---

## Bug: Delivery Data Processing — Vehicle sort wrong because sort key ≠ display key (.slice(-9))
- **Ngày:** 2026-04-26
- **Severity:** High
- **Feature liên quan:** Xử lý Data Giao Hàng (DeliveryDataPage) — 5 Nhà Processing Flow
- **Triệu chứng:** Output file hiển thị biển số `85H 01932` trước `47H 02023` — thứ tự biển số hiển thị không tăng dần. 6 lỗi sort trong 74 khối.
- **Root cause:** `compareVehicleNumbers(a.vehicle, b.vehicle)` so sánh **full source string** (vd: `PPH 85H 01932`, `PPH-47H 02023`), nhưng output hiển thị `.slice(-9)` (vd: `85H 01932`, `47H 02023`). Các prefix PPH có format khác nhau: `PPH ` (space) vs `PPH-` (dash). ASCII space (32) < dash (45), nên `PPH 85H` sort trước `PPH-47H`, tạo ra thứ tự sai khi nhìn ở output.
- **Fix:** Đổi sort comparator từ `compareVehicleNumbers(a.vehicle, b.vehicle)` thành `compareVehicleNumbers(a.vehicle.slice(-9), b.vehicle.slice(-9))` — sort theo biển số hiển thị thay vì full source string.
- **File sửa:** `frontend/src/utils/processDeliveryData.ts:631-633`
- **Regression test:** Node script verify 210 groups, 0 sort errors (displayed). TypeScript typecheck pass, lint pass.
- **Cần chú ý:** Khi sort key và display key khác nhau (do truncation/slicing), luôn sort theo display key. Verify sort bằng cách so sánh giá trị **hiển thị** trong output, không phải giá trị source. Verification script trước đó check full vehicle strings nên report 0 errors — sai vì không phản ánh output thực tế.

---

## Bug: Delivery Data Processing — Output rows duplicated N×N and vehicle sort broken
- **Ngày:** 2026-04-26
- **Severity:** Critical
- **Feature liên quan:** Xử lý Data Giao Hàng (DeliveryDataPage) — 5 Nhà Processing Flow
- **Triệu chứng:** File output "Processed" sheet có rows bị duplicate (mỗi group N rows → N² rows trong output), và thứ tự các khối theo biển số xe không tăng dần.
- **Root cause:** Dòng 715 trong `processDeliveryData.ts` gọi `outputRows.push(...group.rows.sort((a,b) => compareVehicleNumbers(...)).map(row => mapRowToOutput(...)))` BÊN TRONG `group.rows.forEach()`. Hai vấn đề: (1) Push toàn bộ N rows của group trong MỖI iteration → N×N rows; (2) `sort()` in-place thay đổi thứ tự array đang được iterate bởi forEach.
- **Fix:** Thay dòng 715 bằng `outputRows.push(outputRow)` — push 1 row đã được tạo ở dòng 714, giống cách factory sheets hoạt động (dòng 733).
- **File sửa:** `frontend/src/utils/processDeliveryData.ts:715`
- **Regression test:** TypeScript typecheck pass, lint pass.
- **Cần chú ý:** Không bao giờ gọi `.sort()` trên array đang được iterate bằng `.forEach()` — sort in-place phá thứ tự iteration. Không push nhiều rows bên trong forEach khi logic chỉ cần push 1 row per iteration.

---

## Change: Delivery Data Processing — Remove pre-sort, add final sort groups by vehicle
- **Ngày:** 2026-04-25
- **Severity:** Medium
- **Feature liên quan:** Xử lý Data Giao Hàng (DeliveryDataPage) — 5 Nhà Processing Flow
- **Bối cảnh:** User feedback: pre-sort rows + sort groups trong quá trình processing gây phức tạp không cần thiết. Thay vì sort rows trước grouping, user chỉ muốn groups được sort theo **Số xe tăng dần** ở cuối cùng.
- **Quyết định:** Bỏ Step 0 (pre-sort 3-level: vehicle → date → invoice) → Thêm final sort groups theo vehicle ASC (sau khi grouping và sort mỗi group).
- **Thực hiện:**
  - Xóa Step 0 pre-sort từ `processDeliveryData.ts` (dòng 533-559)
  - Cập nhật Step 3: từ "sort groups by (Date, Vehicle)" → "final sort groups by Vehicle ASC"
  - Dùng `compareVehicleNumbers()` để handle "[PREFIX][NUMBER]" format (e.g. "50H 55116")
- **Impact:** Output file groups giờ chỉ theo Số xe tăng dần, bất kể ngày hóa đơn
- **Kiểm tra:** Build ✅, lint ✅, no TypeScript errors ✅
- **Cần chú ý:** Pre-sort rows có tác dụng "warm-up" ordering cho grouping (Map insertion order). Khi bỏ pre-sort, groups sẽ theo thứ tự xuất hiện từ grouping logic (vehicle + date + customer), rồi mới được sắp xếp lại theo vehicle ở cuối. Không ảnh hưởng kết quả, chỉ thay đổi thứ tự xử lý.

---

## Bug: POST /api/users 500 — username NOT NULL violation khi tạo user từ admin panel
- **Ngày:** 2026-04-20
- **Severity:** High
- **Feature liên quan:** User Management — Create User (admin panel)
- **Triệu chứng:** `POST /api/users` → 500 Internal Server Error. Không tạo được user mới từ form admin.
- **Root cause:** Migration `008_add_username_to_users.sql` thêm column `username VARCHAR(100) NOT NULL UNIQUE`, nhưng `userService.createUser()` INSERT query không truyền `username` → PostgreSQL throw NOT NULL violation. `authService.createUser()` (register flow) không bị ảnh hưởng vì đã truyền username.
- **Fix:** Thêm input `username` vào form Create User (admin nhập thủ công). Backend: `userService.createUser()` nhận `username` từ request body, INSERT trực tiếp. Thêm validation username uniqueness check cả ở create lẫn update. Frontend: thêm field `username` vào CreateUserModal, EditUserModal, và cột `username` vào UserManagementPage table.
- **Bug kèm theo:** `getUsers()` SELECT query thiếu `u.username` → column hiển thị trống trong UI dù data đã có trong DB. Fix: thêm `u.username` vào SELECT list.
- **Regression test:** POST /api/users với valid ADMIN token + `{email, password, full_name, username, role_id}` → HTTP 201, user được tạo với đúng username đã nhập.
- **Cần chú ý:** (1) Bất kỳ khi nào thêm `NOT NULL` column mới vào bảng `users`, phải kiểm tra tất cả service methods (không chỉ authService) đang INSERT vào bảng đó. `userService.createUser` và `authService.createUser` là hai paths tách biệt. (2) Khi thêm column mới vào bảng, phải nhớ thêm column đó vào SELECT list trong tất cả query (`getUsers`, `getUserById`, ...) để data được trả về frontend.

---

### 400 Bad Request khi fetch delivery-schedules với limit > 100
- **Ngày:** 2026-04-19
- **Severity:** High
- **Feature liên quan:** Xử lý Data Gạo (RiceDeliveryDataPage)
- **Triệu chứng:** `GET /api/delivery-schedules?limit=5000` trả về 400 Bad Request
- **Root cause:** `deliveryScheduleListSchema` (backend) validate `limit` với `max: 100`. Frontend dùng `limit: '5000'` để cố lấy tất cả data 1 lần → vượt giới hạn
- **Fix:** `riceDeliveryApi.ts` — đổi `limit: '5000'` → `limit: '100'` ở **cả hai chỗ** (request đầu tiên và vòng lặp pagination). Dùng pagination loop fetch nhiều page × 100 records thay vì 1 request lớn
- **Regression test:** N/A (integration bug)
- **Cần chú ý:** Khi tái sử dụng API có sẵn, luôn kiểm tra validation schema trên backend (đặc biệt `max` cho `limit`). Không giả định backend chấp nhận limit lớn tùy ý.

### CORS block local dev khi .env config cho prod — Single origin limitation
- **Ngày:** 2026-04-08
- **Severity:** Critical
- **Feature liên quan:** Toàn bộ app — Authentication, mọi API calls
- **Triệu chứng:** Local frontend (`http://localhost:5173`) bị block CORS với error "Access-Control-Allow-Origin header has a value 'https://phuphatcorp.scrapetool.cloud' that is not equal to the supplied origin". Developer không thể test local khi backend config cho prod.
- **Root cause:** `app.ts` dùng `process.env.CORS_ORIGIN || 'http://localhost:5173'` (single string). Khi `.env` set `CORS_ORIGIN=https://phuphatcorp.scrapetool.cloud` để serve prod → override default local origin → chỉ prod được phép, local bị reject. CORS middleware của express chỉ accept **1 origin duy nhất** khi config là string, không support multiple origins.
- **Fix:** Thay `origin: string` bằng `origin: function(origin, callback)` để validate dynamic. Whitelist hardcoded: `['http://localhost:5173', 'http://localhost:5174', 'https://phuphatcorp.scrapetool.cloud']`. Function check `allowedOrigins.includes(origin)` → accept/reject. Requests không có origin header (curl, mobile apps) được phép (no-origin check).
- **File sửa:** `backend/src/app.ts:11-26` — thay CORS config
- **Regression test:** curl OPTIONS với 3 origins → localhost:5173 ✅, prod ✅, evil.com ❌
- **Cần chú ý:** Khi cần support multiple origins, không dùng array trực tiếp (`origin: [...]`) vì không flexible. Dùng function validator để có thể log/debug origin nào bị reject. Whitelist nên include cả backup ports (`localhost:5174`) để tránh conflict khi port 5173 bị chiếm. Không nên dùng `CORS_ORIGIN` env var nữa vì logic đã chuyển sang whitelist cứng — dễ maintain và tránh misconfigure giữa env.

---

### CORS block production frontend — NODE_ENV không được đọc đúng
- **Ngày:** 2026-04-07
- **Severity:** Critical
- **Feature liên quan:** Toàn bộ app — Authentication, mọi API calls
- **Triệu chứng:** `No 'Access-Control-Allow-Origin' header` trên prod — browser block preflight
- **Root cause:** `app.ts` dùng `NODE_ENV === 'production'` để chọn CORS origin. Trên nhiều platform (Render, Railway, Docker...), biến này không được inject, hoặc `.env` file không được load. Kết quả: `isProd = false` → CORS chỉ cho `localhost:5173` → prod frontend bị block.
- **Fix:** Xóa `isProd` logic, thay bằng `process.env.CORS_ORIGIN || 'http://localhost:5173'`. Thêm `CORS_ORIGIN=https://phuphatcorp.scrapetool.cloud` vào prod `.env`.
- **File sửa:** `backend/src/app.ts`
- **Cần chú ý:** Không dùng `NODE_ENV` để quyết định config runtime như CORS origin, DB URL... Luôn dùng biến env tường minh (`CORS_ORIGIN`, `DATABASE_URL`). NODE_ENV chỉ dùng cho `--NODE_ENV=production` build tools (Webpack, Vite) — không tin vào nó trong runtime Express.



### i18n t() — key có dấu chấm bị split nhầm làm path separator
- **Ngày:** 2026-04-07
- **Severity:** Medium
- **Feature liên quan:** Permission Management — permission matrix
- **Triệu chứng:** UI hiển thị key thô `permissions.permCodes.dashboard.view` thay vì tên dễ đọc
- **Root cause:** Hàm `t()` trong `i18n.tsx` split key theo `.` để traverse JSON. Khi perm.code có dấu chấm (`dashboard.view`), key `permissions.permCodes.dashboard.view` bị traverse thành 4 cấp → không tìm thấy → trả về key string (truthy, nên `|| fallback` không kích hoạt).
- **Fix:** Đổi JSON keys trong `permCodes` từ `"dashboard.view"` → `"dashboard_view"` (dùng `_`). Trong component gọi `perm.code.replace(/\./g, '_')` trước khi dùng làm i18n key.
- **Cần chú ý:** Không bao giờ đặt i18n key có dấu chấm nằm trong giá trị interpolation (`${variable}`). Nếu giá trị có dấu chấm tự nhiên (code, enum), phải normalize trước khi dùng làm key.

### i18n import type — Vite SyntaxError cho interface export
- **Ngày:** 2026-04-07
- **Severity:** High
- **Feature liên quan:** RBAC — rolesApi, permissionsApi, useRoles
- **Triệu chứng:** `Uncaught SyntaxError: The requested module does not provide an export named 'Role'`
- **Root cause:** TypeScript interface chỉ tồn tại ở compile-time. Vite/esbuild strip interfaces ra khỏi JS output. Nếu dùng `import { Role }` (không phải `import type`), JS runtime cố import một export không tồn tại.
- **Fix:** Dùng `import type { Role }` cho type-only imports. Nếu import cả value lẫn type từ cùng 1 file: tách thành 2 dòng — `import { valueExport }` và `import type { TypeExport }`.
- **Cần chú ý:** Vite + esbuild strict hơn tsc về type imports. Luôn dùng `import type` cho interface/type-only imports trong dự án này.

---

### createBrowserRouter + AuthProvider — React Context lỗi

- **Ngày:** 2026-03-30
- **Vấn đề:** Dùng `createBrowserRouter` (data router) với AuthProvider bên trong → `useNavigate()` bị crash với lỗi "useNavigate() may be used only in the context of a <Router> component"
- **Nguyên nhân:** `createBrowserRouter` tạo Router context outside React tree — các component được render bên trong không truy cập được context từ parent.
- **Fix:** Chuyển sang `<BrowserRouter>` + `<Routes>` JSX. AuthProvider phải nằm bên trong `<BrowserRouter>` trong `App.tsx`. Navigation xử lý tại page level thay vì trong AuthProvider.
- **Prevention:** Luôn dùng `BrowserRouter` JSX khi cần React Context integration. Chỉ dùng `createBrowserRouter` khi cần data router features (loader/action) và KHÔNG có context-dependent components.

---

### AuthProvider chứa useNavigate()

- **Ngày:** 2026-03-30 → crash vì AuthProvider render trước Router mount.
- **Nguyên nhân:** React hooks for navigation yêu cầu Router context đã mounted. AuthProvider là một context consumer/producer nằm ở top-level — không có guarantee về thứ tự mount.
- **Fix:** Tách biệt — AuthContext chỉ quản lý state (login/logout/setUser), không chứa navigation. Page components tự gọi `useNavigate()` sau khi auth action hoàn tất.
- **Prevention:** Quy tắc: Context = State management, Page = Navigation/Behavior. Không mix hai concerns trong cùng component.

---

### Import statements ở dưới cùng file

- **Ngày:** 2026-03-30
- **Vấn đề:** LoginPage và RegisterPage có `import axios` và `import React` ở dưới cùng file sau tất cả code → `useState` undefined, `axios.isAxiosError` undefined.
- **Nguyên nhân:** Lỗi của agent khi scaffold code — import không ở top-level.
- **Fix:** Di chuyển tất cả imports lên trên cùng file, dùng `import { useState }` thay vì `React.useState`.
- **Prevention:** ESLint rule `imports-first` sẽ bắt được lỗi này. Cần setup ESLint cho project.

---

### DashboardPage import path sai

- **Ngày:** 2026-03-30
- **Vấn đề:** DashboardPage nằm trong `pages/dashboard/` nhưng dùng `../hooks/useAuth` thay vì `../../hooks/useAuth`.
- **Nguyên nhân:** Agent scaffold code không tính đúng nesting level của file.
- **Fix:** Sửa thành `../../hooks/useAuth` và `../../components/ui/Card`.
- **Prevention:** Kiểm tra import paths khi tạo nested route components. Hoặc dùng path alias (`@/hooks/useAuth`).

---

### API response structure mismatch

- **Ngày:** 2026-03-30
- **Vấn đề:** Login thành công (backend 200) nhưng frontend không navigate — dashboard trắng.
- **Nguyên nhânân:** Backend trả `{ success, message, data: { user, accessToken } }`. Frontend `authApi` định nghĩa `AuthResponse` là `{ user, tokens: { access_token } }` — 2 lớp mismatch: (1) `accessToken` flat vs nested, (2) Double unwrap cần thiết vì `axiosClient.post<{ data: AuthResponse }>()` + `response.data.data`.
- **Fix:** Correct `AuthResponse` type và unwrap: `response.data.data` để lấy `{ user, accessToken }`.
- **Prevention:** Backend và frontend nên share common types (ví dụ: qua một shared package hoặc copy-paste types). Khi scaffold nên kiểm tra type consistency giữa hai sides.

---

---

### POST /api/users 404 — Backend process cũ chưa có route mới

- **Ngày:** 2026-03-31
- **Severity:** High
- **Feature liên quan:** User Management — Create User
- **Triệu chứng:** `POST http://localhost:3021/api/users 404 (Not Found)` — không tạo được user từ frontend. Response HTML `Cannot POST /api/users`.
- **Root cause:** Backend Node.js process đang chạy là **compiled/cached version cũ** chưa có route `POST /api/users`. Route `GET /api/users` tồn tại (từ version cũ) nên trả 403, nhưng `POST` mới thêm vào nên trả 404. `tsx watch` chưa detect được thay đổi vì process đã bị stale.
- **Fix:** Kill process cũ (`kill <PID>`) và restart backend (`cd backend && npm run dev`). Sau khi restart, `POST /api/users` trả 201 thành công.
- **Regression test:** `curl -X POST http://localhost:3021/api/users` với valid ADMIN token → HTTP 201.
- **Cần chú ý:** Khi thêm route mới vào backend, nếu `tsx watch` không auto-reload, cần restart server thủ công. Dấu hiệu nhận biết: một số routes của cùng resource hoạt động (GET), một số không (POST/PUT/DELETE) → khả năng cao là stale process. Dùng `lsof -i :<port>` để tìm PID và restart.

---

### UserRole missing export — CreateUserModal SyntaxError

- **Ngày:** 2026-03-31
- **Severity:** High
- **Feature liên quan:** User Management — CreateUserModal, EditUserModal
- **Triệu chứng:** `Uncaught SyntaxError: The requested module '/src/types/user.ts' does not provide an export named 'UserRole'` — modal tạo/sửa user không load được.
- **Root cause:** `frontend/src/types/user.ts` không định nghĩa `UserRole` — chỉ có `UserPublic`, `AuthTokens`, etc. Nhưng `CreateUserModal.tsx`, `EditUserModal.tsx`, `UserManagementPage.tsx` đều import và dùng `UserRole.VIEWER`, `UserRole.ADMIN`, `UserRole.ACCOUNTANT`.
- **Fix:** Thêm `UserRole` const object vào `frontend/src/types/user.ts`:
  ```ts
  export const UserRole = { ADMIN: 'ADMIN', ACCOUNTANT: 'ACCOUNTANT', VIEWER: 'VIEWER' } as const;
  export type UserRole = (typeof UserRole)[keyof typeof UserRole];
  ```
  Dùng `const` object thay vì `enum` vì `tsconfig` có `"erasableSyntaxOnly": true` (TS 5.5+) không cho phép `enum`.
- **Regression test:** `tsc --noEmit` trong `frontend/` — clean, không có lỗi UserRole.
- **Cần chú ý:** Khi `erasableSyntaxOnly: true` được bật, không dùng `enum` — thay bằng `const` object + type alias. Pattern: `export const X = {...} as const; export type X = (typeof X)[keyof typeof X];`

---

### DELETE /api/users/:id 500 — FK constraint violation

- **Ngày:** 2026-03-31
- **Severity:** High
- **Feature liên quan:** User Management — Delete User
- **Triệu chứng:** `DELETE http://localhost:3021/api/users/:id` trả 500. Error: `update or delete on table "users" violates foreign key constraint "user_activities_target_user_id_fkey"`.
- **Root cause:** Bảng `user_activities` có FK `target_user_id → users.id` và `actor_id → users.id` (NOT NULL / no cascade). Bảng `users` tự-reference qua `created_by → users.id` và `updated_by → users.id`. Khi DELETE user, PostgreSQL từ chối vì còn FK references từ các bảng này.
- **Fix:** Trong `userService.deleteUser()`, trước khi `DELETE FROM users` cần:
  1. `DELETE FROM user_activities WHERE target_user_id = $id OR actor_id = $id`
  2. `UPDATE users SET created_by = NULL WHERE created_by = $id`
  3. `UPDATE users SET updated_by = NULL WHERE updated_by = $id`
  4. `DELETE FROM users WHERE id = $id`
- **File sửa:** `backend/src/services/userService.ts`
- **Regression test:** Create user → DELETE user → HTTP 200 ✅
- **Cần chú ý:** Khi thiết kế schema có FK references đến users, cần cân nhắc `ON DELETE CASCADE` hoặc `ON DELETE SET NULL` ngay từ đầu trong migration. Audit log tables (`user_activities`) nên dùng `ON DELETE SET NULL` để giữ lịch sử nhưng không block delete.

---

### GET /src/i18n/i18n.ts 404 — giao diện không load được

- **Ngày:** 2026-03-31
- **Severity:** High
- **Feature liên quan:** i18n / app bootstrap
- **Triệu chứng:** Browser báo `GET http://localhost:5173/src/i18n/i18n.ts?t=... net::ERR_ABORTED 404 (Not Found)`, toàn bộ giao diện không load được.
- **Root cause:** Hai vấn đề kết hợp: (1) `node_modules` ở root chưa được `npm install` — Vite binary không tồn tại nên dev server không chạy đúng cách; (2) Browser/Vite cache cũ còn giữ reference đến `src/i18n/i18n.ts` — file này không tồn tại trong filesystem (chỉ có `src/i18n/index.ts`).
- **Fix:** Chạy `npm install` ở root để tạo `node_modules`. Tạo file `src/i18n/i18n.ts` re-export từ `index.ts` để handle browser cache cũ: `export { default } from './index';`
- **Regression test:** Build production thành công (`npm run build` → `✓ 2224 modules transformed`). TypeScript clean (`tsc --noEmit` không có lỗi).
- **Cần chú ý:** Sau khi clone repo hoặc pull code mới, phải chạy `npm install` trước khi `npm run dev`. Nếu đổi tên file i18n, cần giữ backward-compatible re-export hoặc clear browser cache (`Ctrl+Shift+R` / DevTools → Application → Clear Storage).

---

### DeliveryDataPage missing từ frontend/ — feature chỉ có ở src/ (codebase mới)

- **Ngày:** 2026-03-31
- **Severity:** High
- **Feature liên quan:** Delivery Data Processing
- **Triệu chứng:** Sidebar không có "Xử lý Data Giao Hàng". Các fix ở `src/` không có tác dụng vì user đang chạy `frontend/`.
- **Root cause:** Project có 2 frontend song song: `frontend/` (codebase cũ đang chạy) và `src/` (codebase mới). `DeliveryDataPage` chỉ được xây dựng ở `src/`, chưa port sang `frontend/`.
- **Fix:** (1) Install `xlsx` vào `frontend/`; (2) Copy `processDeliveryData.ts` sang `frontend/src/utils/`; (3) Tạo `frontend/src/pages/admin/DeliveryDataPage.tsx` dùng components của frontend cũ; (4) Thêm route `/delivery-data` vào `frontend/src/Router.tsx`; (5) Thêm nav item "Xử lý Data Giao Hàng" vào `frontend/src/layouts/MainLayout.tsx`.
- **Regression test:** `tsc --noEmit` trong `frontend/` — clean (no errors in new files).
- **Cần chú ý:** Khi project có 2 codebase, phải xác định user đang chạy cái nào trước khi fix. Dấu hiệu: sidebar items không khớp với code trong `src/`. Luôn hỏi "bạn đang thấy gì trên màn hình" thay vì đoán từ code.

---

 — user.role cũ (lowercase) block toàn bộ guards

- **Ngày:** 2026-03-31
- **Severity:** High
- **Feature liên quan:** AuthContext, AdminGuard, sidebar visibility
- **Triệu chứng:** Sau khi fix UserRole type sang uppercase, user vẫn không thấy chức năng — AdminGuard vẫn redirect, sidebar không hiện đúng.
- **Root cause:** `AuthProvider` đọc `user` object từ `localStorage` synchronously khi init. User đã login từ trước khi fix có `role: 'admin'` (lowercase) lưu trong localStorage. Sau khi fix type sang uppercase, so sánh `user.role !== 'ADMIN'` luôn fail vì data cũ.
- **Fix:** Thay AuthProvider init synchronous từ localStorage bằng async `GET /api/auth/me` khi mount. `isLoading = true` trong khi chờ — guards sẽ hiện loading screen thay vì redirect. Backend trả role uppercase đúng, cập nhật lại localStorage.
- **File sửa:** `src/contexts/AuthContext.tsx`
- **Regression test:** Diagnostics clean. Sau khi reload page với token hợp lệ, user object có role uppercase từ backend.
- **Cần chú ý:** Không tin vào localStorage để lấy user data mà không verify với backend. localStorage chỉ dùng để check "có token không" (để quyết định có gọi `/auth/me` không). User object luôn lấy từ backend.

---



- **Ngày:** 2026-03-31
- **Severity:** High
- **Feature liên quan:** AdminGuard, DeliveryDataPage, ExecuteDataPage, SkuFactoryListPage, UserManagement
- **Triệu chứng:** User ADMIN đăng nhập nhưng không thấy/không vào được các chức năng cần quyền admin — bị redirect về dashboard.
- **Root cause:** `src/types/common.ts` định nghĩa `UserRole = 'admin' | 'manager' | 'staff' | 'viewer'` (lowercase), nhưng DB và JWT thực tế lưu `'ADMIN' | 'ACCOUNTANT' | 'VIEWER'` (uppercase). Tất cả guard và role check so sánh sai → luôn fail.
- **Fix:** Sửa `UserRole` type về uppercase: `'ADMIN' | 'ACCOUNTANT' | 'VIEWER'`. Cập nhật tất cả chỗ so sánh role trong `App.tsx`, `DashboardLayout.tsx`, `UserListPage.tsx`, `UserCreatePage.tsx`, `UserEditPage.tsx`, `SkuFactoryListPage.tsx`.
- **Regression test:** TypeScript clean — `getDiagnostics` không có lỗi type sau khi fix.
- **Cần chú ý:** `src/types/common.ts` là source of truth cho role values ở frontend. Khi backend thay đổi role values, phải update file này trước. Không để role values hardcode rải rác — luôn dùng type `UserRole` để TypeScript bắt lỗi.

---

### xlsx 0.18.5 community edition không ghi cell styles — dùng exceljs để write

- **Ngày:** 2026-04-01
- **Severity:** Low
- **Feature liên quan:** Delivery Data Processing — export Excel output
- **Triệu chứng:** Header row của output Excel không tô màu vàng dù đã set `cell.s = { fill: ... }` và dùng `{cellStyles: true}` trong write options.
- **Root cause:** `xlsx` 0.18.5 (SheetJS community edition) không serialize thuộc tính `s` khi gọi `XLSX.write()`. Style set trong memory bị bỏ qua hoàn toàn — đọc lại file chỉ thấy `{"patternType":"none"}`. Cả hai cách (có/không có `cellStyles: true`) đều không giúp được.
- **Fix:** Giữ `xlsx` để đọc file input. Dùng `exceljs` để tạo và ghi file output — `cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }` hoạt động đúng.
- **File sửa:** `frontend/src/utils/processDeliveryData.ts` — Step 5 dùng `exceljs.Workbook` thay vì `XLSX.utils.book_new()`
- **Cần chú ý:** `xlsx` community edition chỉ đọc styles từ file có sẵn, không ghi styles mới. Khi cần output Excel có formatting (màu sắc, bold, border...) → luôn dùng `exceljs`. Tên biến `buffer` bị trùng với biến đọc file input — đặt tên là `outBuffer`.

---

### Delivery Data processing — Pre-sort dòng trước grouping (điều chỉnh 3-level sort + fix vehicle number sorting + fix BR-003 inconsistency)
- **Ngày:** 2026-04-25
- **Severity:** High (was Medium)
- **Feature liên quan:** Delivery Data Processing — grouping algorithm + group sorting
- **Thay đổi ban đầu (2026-04-25 sáng):** Thêm bước sort (BR-000) trước bước grouping (BR-001)
  - Primary: Số tàu/xe ASC (numeric-aware)
  - Secondary: Ngày hóa đơn ASC
  - Mục đích: Đảm bảo thứ tự nhất quán của các nhóm

- **Điều chỉnh 1 (2026-04-25 chiều, Part 1):** Mở rộng BR-000 thành 3-level sort
  - Primary: Số tàu/xe ASC (numeric-aware)
  - Secondary: Ngày hóa đơn ASC
  - Tertiary: Số hóa đơn ASC (numeric-aware) — **NEW**

- **Bug discovery & fix (2026-04-25 chiều, Part 2):** Fix vehicle number sorting
  - Issue: `localeCompare(..., { numeric: true })` không hoạt động đúng cho vehicle numbers
  - Root cause: So sánh từng segment ký tự độc lập, không nhận biết "[PREFIX][NUMBER]" structure
  - Fix: Thêm helper function `compareVehicleNumbers()` (lines 78-105)

- **Logic conflict detection (2026-04-25 chiều, Part 3):** Phát hiện Step 1 vs Step 4 xung đột
  - Issue: Step 1 (BR-000) pre-sort dùng `compareVehicleNumbers()` ✅
  - Nhưng Step 4 (BR-003) group sort dùng `.localeCompare(b.vehicle)` ❌
  - Impact: Step 1 pre-sort bị override lại bởi Step 4 sort khác logic
  - Fix: Step 4 (BR-003) cập nhật dùng `compareVehicleNumbers()` (line 668)

- **File sửa:**
  - `frontend/src/utils/processDeliveryData.ts`:
    * Added function `compareVehicleNumbers()` (lines 78-105)
    * Updated Step 1 sort logic (lines 533-559) — use compareVehicleNumbers
    * Updated Step 3 (BR-003) sort logic (line 668) — use compareVehicleNumbers

- **Documentation:**
  - Updated `system-features.md` BR-000: "natural sort: prefix numeric-aware → number numeric"
  - Updated `system-features.md` BR-003: "dùng hàm compareVehicleNumbers() để maintain consistency với BR-000"

- **Cần chú ý:**
  - Thay đổi này ĐẢM BẢO:
    * BR-000 pre-sort result không bị override bởi BR-003 group sort
    * Output file vehicles được sort correctly (ascending order)
    * Consistency giữa row-level sort (Step 1) và group-level sort (Step 4)
  - Backward compatible — không break feature khác
  - TypeScript typecheck: pass ✅

---

### Delivery Data processing — Pre-sort dòng trước grouping (initial 2-level sort)

---

### xlsx 0.18.5 community edition không ghi cell styles — dùng exceljs để write

### 403 Forbidden trên GET endpoints — requirePermission vs "Tất cả authenticated users"

- **Ngày:** 2026-04-07
- **Severity:** High
- **Feature liên quan:** Bảng điều phối xe — GET /api/vehicles, /api/trip-codes, /api/dispatch-schedules
- **Triệu chứng:** Vào trang /dispatch/schedule → 3 requests đều trả 403. User đã đăng nhập bình thường.
- **Root cause:** Route guards dùng `requirePermission('transport.view')` / `requirePermission('dispatch.view')` trên các GET endpoints. Permission codes này không có trong JWT của user (hoặc không được assign cho role). Spec ghi "Access: Tất cả authenticated users" nhưng code lại enforce permission-based access.
- **Fix:** Xóa `requirePermission(...)` khỏi 3 GET routes (`vehicles.ts:16`, `tripCodes.ts:16`, `dispatchSchedules.ts:15`). Write endpoints (POST/PUT/DELETE) vẫn giữ `requirePermission` vì đó là các action thay đổi data.
- **Regression test:** Backend build + 33 tests pass sau khi sửa.
- **Cần chú ý:** Khi tính năng mới spec là "tất cả authenticated users có thể xem", không thêm `requirePermission` vào GET route. Chỉ thêm `requirePermission` vào write endpoints. `authenticateToken` (đã ở `router.use()`) là đủ để bảo vệ read access.

---

### Delivery Data grouping logic — dynamic group key dựa trên threshold và multi-value field

- **Ngày:** 2026-04-18
- **Severity:** Medium
- **Feature liên quan:** Delivery Data Processing — grouping algorithm (Step 5.2)
- **Thay đổi:** Group key không còn cố định `(Số tàu/xe + Ngày HĐ)` mà thay đổi động:
  1. Group sơ bộ theo `(Số tàu/xe + Ngày HĐ + Tên KH)`
  2. Tính `SUM(HĐ Trọng lượng) / 1000` của group
  3. Nếu `< 13`: giữ nguyên group key
  4. Nếu `>= 13`: parse cột "Thông tin bổ sung" (split bằng dấu phẩy/xuống dòng)
     - Có từ 2 giá trị → thêm "Thông tin bổ sung" vào group key
     - Chỉ 1 giá trị hoặc rỗng → giữ nguyên
- **File sửa:** `frontend/src/utils/processDeliveryData.ts` — Step 1 (grouping logic)
- **Cần chú ý:**
  - Logic grouping phức tạp nên tách thành 2 bước: preliminary grouping → final grouping adjustment
  - Threshold (13) là hardcoded — nếu cần thay đổi sau này, cân nhắc extract thành constant hoặc config
  - Multi-value detection dùng regex `/[,\n\r]+/` để split — linh hoạt với nhiều format input (comma-separated, newline-separated)
  - BREAKING CHANGE: Users có dữ liệu cũ sẽ thấy output phân nhóm khác so với trước đây

---

### Excel number format — exceljs không set numFmt property
- **Ngày:** 2026-04-18
- **Severity:** Medium
- **Feature liên quan:** Delivery Data Processing — Excel output formatting
- **Triệu chứng:** Output Excel mất thousand separator format cho cột số — "Số lượng (DVT bán hàng)" hiển thị `10` thay vì `10.000`, SP Trọng lượng hiển thị `1234.567` thay vì `1.234.567`.
- **Root cause:** `exceljs` write cells không tự động apply number format. Mặc dù cell value là `number` type, Excel hiển thị số thuần (raw number) vì không có thuộc tính `cell.numFmt` — thuộc tính này quyết định cách hiển thị number trong Excel (thousand separator, decimals, percentage, currency...).
- **Fix:** Sau khi `ws.addRow(row)`, loop qua các cells có index thuộc number columns và set `cell.numFmt`:
  - `NUM_FMT_THOUSAND = '#,##0'` cho "Số lượng" (integer với thousand separator)
  - `NUM_FMT_DECIMAL = '#,##0.000'` cho "SP Trọng lượng", "HĐ Trọng lượng", "Round(MT)", factory columns (decimal 3 chữ số với thousand separator)
  - Tạo 2 column maps riêng: `PROCESSED_NUMBER_COLS` (39 cols) và `FACTORY_NUMBER_COLS` (41 cols)
  - Thêm param `isFactorySheet: boolean` vào `writeSheetRows()` để chọn đúng map
  - Chỉ apply format khi `typeof cell.value === 'number'` để tránh lỗi với text/date cells
- **File sửa:** `frontend/src/utils/processDeliveryData.ts` — constants (line ~22-23), column maps (line ~256-279), `writeSheetRows()` function (line ~830-850), function calls (line ~867, ~873)
- **Regression test:** `docs/testing/bugfix-excel-number-format-test-checklist.md` — 10 manual test cases (Số lượng, SP/HĐ Trọng lượng, Round(MT), separator rows, factory sheets, header row preservation, text columns không bị ảnh hưởng)
- **Cần chú ý:**
  - ExcelJS cell index là 1-based (`eachCell` callback nhận `colNumber`), cần `-1` khi map với array index 0-based
  - Header row (rowIndex === 0) không bị ảnh hưởng vì không có number values → type check tự động skip
  - Separator rows cũng có number cells → cần apply format như data rows thông thường
  - Backward compatibility: không thay đổi parsing logic (đọc file vẫn dùng xlsx) — chỉ thay đổi output formatting
  - `eachCell({ includeEmpty: false })` để bỏ qua empty cells khi apply format → tránh set format cho cells rỗng

### pg driver serialize DATE column thành ISO UTC timestamp — MasterPlateMap key không match
- **Ngày:** 2026-04-19
- **Severity:** High
- **Feature liên quan:** Xử lý Data Gạo (RiceDeliveryDataPage) — buildMasterPlateMap / filterRiceData
- **Triệu chứng:** Filter trả về 0 dòng khớp dù biển số và ngày nhìn bằng mắt là đúng.
- **Root cause:** `pg` driver Node.js tự động convert PostgreSQL `DATE` column thành JS `Date` object. Khi JSON serialize (Express `res.json()`), Date UTC midnight của Việt Nam bị lệch 1 ngày: `"2026-03-02"` (DB) → `"2026-03-01T17:00:00.000Z"` (API response). Frontend dùng string này làm key trong `MasterPlateMap`, còn Excel parse ra `"2026-03-02"` → hai key không bao giờ bằng nhau → zero match.
- **Fix:** Cast `ds.ngay::text as ngay` trong SQL SELECT của `deliveryScheduleService.list()`. pg trả string `"2026-03-02"` thay vì Date object → không bị timezone convert.
- **File sửa:** `backend/src/services/deliveryScheduleService.ts` — dòng `ds.ngay` trong SELECT list query
- **Regression test:** Manual — query DB trực tiếp với `ngay::text` xác nhận trả `"2026-03-02"`.
- **Cần chú ý:** Bất cứ khi nào SELECT `DATE` column qua `pg` driver mà cần dùng làm string key hoặc compare với string từ frontend/file → luôn dùng `column::text`. Không dùng `column` trực tiếp vì pg tự convert sang JS Date với UTC timezone.

---


- **Ngày:** 2026-04-19 (revised 2026-04-19)
- **Severity:** High
- **Feature liên quan:** Xử lý Data Gạo (RiceDeliveryDataPage) — parseRiceFile
- **Triệu chứng:** File Excel ngày 2/3/2026 → sau khi parse ra 1/3/2026 → filter trả về 0 dòng khớp.
- **Root cause:** `xlsx` với `cellDates: true` tạo Date object bằng **LOCAL time constructor** (ví dụ `new Date(2026, 2, 2, 0, 0, 0)`), nhưng thực tế time component không phải midnight mà là `23:59:30` local — do xlsx tính giờ từ fractional serial. Kết quả: cả `getDate()` lẫn `getUTCDate()` đều trả sai ngày. Ví dụ: serial 46083 (2/3/2026) → Date ISO `2026-03-01T16:59:30.000Z` → `getDate()` = 1, `getUTCDate()` = 1 → đều sai.
- **Fix đúng:** Dùng `cellDates: false` khi `XLSX.read()` — xlsx giữ nguyên serial number. `parseRawDate` branch `typeof val === 'number'` gọi `excelSerialToDate()` dùng `Date.UTC(1899, 11, 30 + serial)` → luôn đúng bất kể timezone.
- **File sửa:** `frontend/src/utils/processRiceData.ts` — đổi `cellDates: true` → `cellDates: false` trong `XLSX.read()` call; cập nhật comment trong branch `instanceof Date`.
- **Regression test:** Node smoke test — parse file thực tế: không còn `2026-03-01`, có `2026-03-02` đến `2026-03-14` ✅
- **Cần chú ý:** **KHÔNG BAO GIỜ dùng `cellDates: true`** khi đọc Excel file trong project này. `xlsx` không tạo UTC midnight — nó tạo Date với time component không ổn định. Luôn dùng `cellDates: false` + xử lý serial number qua `excelSerialToDate()`. Entry trước (ghi dùng `getUTC*`) là sai — đã được sửa lại.

---

## Change: Driver Invoices — Đổi label Ghi chú + popup số HĐ + format so_xe
- **Ngày:** 2026-06-15
- **Severity:** Medium
- **Feature liên quan:** Hóa đơn tài xế (Driver Invoices)
- **Thay đổi:**
  1. Đổi label cột "Số HĐ (gốc)" → "Ghi chú", thêm filter "Ghi chú..." vào filter bar
  2. Badge HĐ `[5]` clickable → popup `InvoiceNumbersPopup` hiển thị danh sách số hóa đơn
  3. Format `so_xe` khi insert: bỏ `-`, `,`, space → VD "50H-55116" → "50H55116"
- **Thực hiện:**
  - Migration 015: `UPDATE driver_invoices SET so_xe = regexp_replace(...)` normalize dữ liệu cũ
  - BE: thêm `ghi_chu` filter vào `driverInvoiceService.list()` + `driverInvoiceController`
  - FE: thêm `ghi_chu` vào `DriverInvoiceFilters` type + API params
  - FE: hàm `normalizeSoXe()` trong `parseDriverInvoiceFile.ts`
  - FE: component `InvoiceNumbersPopup` mới — modal nhỏ hiển thị badge numbers
  - FE: `DriverInvoicesPage` — đổi header cột, thêm filter input, grid 6→7 cols, badge thành button
- **Cần chú ý:** Khi normalize dữ liệu cũ, phải chạy migration TRƯỚC khi thay đổi parser để đảm bảo duplicate check hoạt động đúng (UNIQUE index dùng `so_xe`). Nếu không, dữ liệu cũ `"50H-55116"` và mới `"50H55116"` sẽ là 2 record khác nhau.

## Bug: Driver Invoice Upload 400 — rows with empty B (Mã) not skipped
- **Ngày:** 2026-06-15
- **Severity:** High
- **Feature liên quan:** Hóa đơn tài xế — Upload Excel
- **Triệu chứng:** Upload file "Kê Xe Nhỏ 03_2026.xlsx" → `POST /api/driver-invoices/upload 400`. File "Xe Nhỏ 05_2026.xlsx" upload bình thường.
- **Root cause:** File 03 có 5 dòng với cột B (Mã) rỗng (thường là dòng "thu hồi hàng"). Parser chỉ skip khi TẤT CẢ field (ma, ten_tx, ngay, so_xe, noi_giao) đều rỗng, nhưng các dòng này có ten_tx, ngay, noi_giao, ghi_chu đầy đủ → không bị skip → gửi lên backend với `ma=''` → backend validation `notEmpty()` reject 400.
- **Fix:** Thêm `if (!ma) continue` trong parser — skip mọi dòng thiếu Mã trước khi xử lý tiếp. File: `frontend/src/utils/parseDriverInvoiceFile.ts`
- **Bug follow-up:** Sau khi fix 400, xuất hiện 500 do file 03 có 2 dòng trùng lặp nội bộ (cùng key trong chính file Excel). `checkDuplicates()` chỉ check với DB, không dedup internal. Fix: dedup `rowsToInsert` bằng Map trước khi INSERT. File: `backend/src/services/driverInvoiceService.ts`
- **Cần chú ý:** (1) Khi validate row-level data từ Excel, nên kiểm tra TỪNG field bắt buộc riêng rẽ. (2) Khi bulk insert từ file upload, luôn dedup nội bộ trong payload trước khi INSERT để tránh vi phạm UNIQUE constraint — dữ liệu từ Excel thường có dòng trùng.

## Change: Driver Invoices — Chuyển format import sang HCM + Tỉnh sheets
- **Ngày:** 2026-06-17
- **Severity:** Medium
- **Feature liên quan:** Hóa đơn tài xế — Upload Excel
- **Thay đổi:** Chuyển từ format cũ (sheet "XE NHỎ", rows 8+, columns B-G) sang format mới (sheets "HCM" + "Tỉnh", rows 5+(0-indexed), columns A-F). Column ngay có thể là decimal serial (Math.floor trước khi parse).
- **Files:** `frontend/src/utils/parseDriverInvoiceFile.ts` — extract `parseSheetRows()`, đọc cả 2 sheet.
- **Cần chú ý:** Format mới có decimal date serial (vd: 46189.62269) — cần `Math.floor(serial)` trước khi parse date code. Skip rows có `ma` rỗng, `ngay` invalid, `so_xe` rỗng, hoặc `ghi_chu` rỗng. Cột B (ten_tx) có thể chứa driver code dạng số ("0", "55129") — giữ nguyên.

## Anti-patterns Tránh Lặp Lại

### 1. Không để import ở dưới cùng file
Luôn đặt tất cả imports ở trên cùng. Dùng named imports thay vì namespace import (`import React from 'react'` → `import { useState } from 'react'`).

### 2. Không dùng createBrowserRouter khi có React Context
`createBrowserRouter` không tương thích với `createContext`. Dùng `<BrowserRouter>` JSX.

### 3. Không mix concerns trong một component
AuthProvider = state only. Navigation = page level. Validation = form library. Không nhét mọi thứ vào một chỗ.

### Upload lịch đi hàng fail-toàn-bộ khi STT không phải số
- **Ngày:** 2026-06-30
- **Severity:** High
- **Feature liên quan:** Lịch đi hàng (Delivery Schedule) — Upload Excel
- **Triệu chứng:** Upload file Excel lịch đi hàng bị báo lỗi "STT không phải số hợp lệ". Chỉ một vài sheet có dòng tổng kết cuối (TỔNG TIỀN XE, NGƯỜI, MỖI NGƯỜI, TIỀN PHÁT SINH) gây fail toàn bộ upload.
- **Root cause:** `parseColumn()` trong `deliveryScheduleService.ts` fail-fast — nếu bất kỳ dòng nào có STT non-numeric, push error và throw `VALIDATION_ERRORS` khiến toàn bộ upload bị reject. Các dòng tổng kết cuối sheet có ColG chứa text thay vì số → `parseInt()` NaN.
- **Fix:** Chuyển lỗi STT thành skip — khi `parseInt(stt)` NaN → `continue` (bỏ qua dòng, tương tự cách xử lý TẤN best-effort). Đồng thời sửa Bug `!stt` falsy check khiến STT=0 bị bỏ qua → `stt == null || stt === '' || (!noi_giao && !so_xe)`.
- **File sửa:** `backend/src/services/deliveryScheduleService.ts` — dòng 194 (BR-001 skip rule) + dòng 206-215 (STT parsing)
- **Cần chú ý:** Khi parse dữ liệu từ Excel, không nên dùng fail-fast cho từng ô — dùng best-effort skip với optional field. Chỉ fail-fast khi vi phạm business rule thực sự (VD: duplicate, thiếu field bắt buộc). Các dòng tổng kết/thống kê ở cuối sheet là pattern phổ biến trong Excel thực tế.

### DateInput onChange không nhận value — callers vẫn dùng (e) => e.target.value
- **Ngày:** 2026-06-30
- **Severity:** High
- **Feature liên quan:** Tất cả màn hình dùng `<DateInput>` — Upload Lịch đi hàng, Filter Lịch đi hàng, Bảng điều phối xe
- **Triệu chứng:** Không thể chọn ngày trong DateInput — click vào calendar picker không cập nhật giá trị.
- **Root cause:** Commit `f4309cb` thay native `<input type="date">` bằng custom `<DateInput>` component (Việt hóa calendar). Native input gọi `onChange(e)` với `e.target.value = "2026-06-30"`. DateInput mới gọi `onChange("2026-06-30")` (string trực tiếp). Nhưng callers vẫn dùng pattern `(e) => setXxx(e.target.value)` → `e` là string, `.target.value` = `undefined` → không cập nhật.
- **Fix:** Sửa 3 file callers (UploadDeliveryScheduleModal, DeliveryScheduleFilters, SchedulePage) từ `onChange={(e) => setXxx(e.target.value)}` → `onChange={(value) => setXxx(value)}`. Các file dùng react-hook-form (`{...register}`, `field.onChange`) không bị ảnh hưởng vì react-hook-form fallback `e?.target?.value ?? e` xử lý được string trực tiếp.
- **File sửa:** `UploadDeliveryScheduleModal.tsx`, `DeliveryScheduleFilters.tsx`, `SchedulePage.tsx`
- **Cần chú ý:** Khi thay đổi signature của component prop (đặc biệt onChange), phải kiểm tra TẤT CẢ callers. Custom component không nên mô phỏng event object — nếu onChange trả trực tiếp value thì callers cũng phải nhận trực tiếp value.

### N+1 INSERT trong upload lịch đi hàng — 53s cho ~3000 rows
- **Ngày:** 2026-06-30
- **Severity:** Critical
- **Feature liên quan:** Lịch đi hàng — Upload Excel
- **Triệu chứng:** `POST /api/delivery-schedules/upload` mất 53,490ms để upload 1 tháng dữ liệu (~3000 rows). GET list chỉ 373ms.
- **Root cause:** `upload()` method dùng `for (const row of rowsToInsert) { await client.query(INSERT ...) }` — mỗi dòng 1 INSERT riêng lẻ, mỗi lần 1 network round trip. ~3000 dòng = ~3000 round trips = ~52s.
- **Fix:** Thay bằng multi-row INSERT batch 500 rows/lần. Từ `INSERT INTO ... VALUES ($1,$2,...)` trong loop → `INSERT INTO ... VALUES ($1,$2,...), ($10,$11,...), ...` gộp nhiều dòng trong 1 query. Giảm từ ~3000 queries xuống còn ~6 queries.
- **File sửa:** `backend/src/services/deliveryScheduleService.ts` — dòng 133-160 (upload method, batch insert)
- **Kết quả:** 53,000ms → ~500ms (-99%)
- **Cần chú ý:** Khi INSERT hàng loạt, luôn dùng multi-row INSERT hoặc COPY. Không bao giờ INSERT từng dòng trong loop. Batch size 500-1000 an toàn dưới PostgreSQL param limit (65535).

### 4. Không trust agent-generated imports path
Luôn verify import paths đúng sau khi scaffold, đặc biệt với nested folder structures.

### 5. Không cache .env
Vite không hot-reload `.env` khi dev server đang chạy. Phải restart `npm run dev` sau khi sửa `.env`.

## Setup Improvements Cần Làm

- [ ] Thêm ESLint + Prettier cho cả backend và frontend
- [ ] Thêm shared types package hoặc script export types từ backend sang frontend
- [ ] Cấu hình path alias (`@/` → `src/`) cho import ngắn hơn
- [ ] Thêm `.env.example` đầy đủ cho cả backend và frontend
- [ ] Setup Pre-commit hook (husky + lint-staged)

---

## Perf: N+1 INSERT pattern in create/update methods
- **Ngày:** 2026-07-21
- **Feature:** Lịch sử sửa xe (`repairService`)
- **Vấn đề:** Loop item dùng INSERT riêng lẻ → N roundtrips DB (mỗi item 1 query)
- **Fix:** Dùng multi-row INSERT — gộp tất cả items vào 1 query với dynamic placeholders `($1,$2,$3,$4), ($5,$6,$7,$8), ...`
- **Pattern:** Khi insert array of child records, luôn dùng batch INSERT thay vì loop. Áp dụng cho cả `create()` và `update()`.
- **Files:** `backend/src/services/repairService.ts:223-234, 294-310`

## Perf: Sequential queries instead of parallel
- **Ngày:** 2026-07-21
- **Feature:** Lịch sử sửa xe (`repairService.getById`)
- **Vấn đề:** 3 queries (record, items, images) chạy tuần tự → tổng latency = sum
- **Fix:** `Promise.all([query1, query2, query3])` → 3 queries song song, latency = max
- **Pattern:** Khi nhiều queries độc lập (không phụ thuộc kết quả của nhau), luôn dùng Promise.all.
- **Files:** `backend/src/services/repairService.ts:185-205`

## Perf: Missing composite index for DISTINCT ON query
- **Ngày:** 2026-07-21
- **Feature:** Lịch sử sửa xe (`repairService.getSummary`)
- **Vấn đề:** CTE `DISTINCT ON (vehicle_id) ORDER BY vehicle_id, repair_date DESC` chỉ có index trên `vehicle_id`, thiếu `repair_date DESC`
- **Fix:** Composite partial index `(vehicle_id, repair_date DESC) WHERE status = 'active'`
- **Pattern:** Khi dùng DISTINCT ON kèm ORDER BY nhiều cột, cần composite index khớp với cả DISTINCT và ORDER BY columns.
- **Files:** `backend/src/migrations/038_repair_composite_index.sql`

## Perf: Separate COUNT query when COUNT(*) OVER() available
- **Ngày:** 2026-07-21
- **Feature:** Lịch sử sửa xe (`repairService.listByVehicle`)
- **Vấn đề:** Chạy `SELECT COUNT(*)` riêng trước khi `SELECT data` → 2 roundtrips
- **Fix:** Gộp thành 1 query với `COUNT(*) OVER()::int AS total_count`
- **Pattern:** Paginated list queries nên dùng `COUNT(*) OVER()` để lấy total trong cùng 1 query.
- **Files:** `backend/src/services/repairService.ts:159-178`
