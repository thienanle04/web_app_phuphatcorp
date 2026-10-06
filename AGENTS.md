# PhuPhatCorp Accounting Web App

## Local agent rules

If `AGENTS.local.md` exists in the repo root, read it before any other work in this repo and follow it. When it conflicts with this file, follow `AGENTS.local.md` on this machine. A missing file is expected on other machines.

## Project Overview

Hệ thống web hỗ trợ công ty **PhuPhatCorp** quản lý và xử lý số liệu kế toán, vận tải, dữ liệu giao hàng và báo cáo doanh thu.
- **Tech Stack:** React 19 + Node.js (Express + TypeScript) + PostgreSQL + JWT + Tailwind CSS v3 + Vite.

---

## Monorepo & Directory Structure

```text
web_app_phuphatcorp/
├── backend/          # API Express + TypeScript
│   └── src/
│       ├── config/       # Biến môi trường và pool PostgreSQL
│       ├── controllers/  # HTTP handler và schema validate
│       ├── middleware/   # Auth, validate, lỗi
│       ├── routes/       # Mount router
│       ├── services/     # Business logic và query
│       ├── types/
│       ├── utils/
│       ├── migrations/   # SQL idempotent
│       └── scripts/      # Seed và import dữ liệu
├── frontend/         # Web React + Vite
│   └── src/
│       ├── api/
│       ├── components/
│       ├── contexts/
│       ├── hooks/
│       ├── i18n/
│       ├── layouts/
│       ├── pages/
│       ├── stores/
│       ├── types/
│       └── utils/
├── mobile/           # Client Flutter
└── docs/             # Spec và task
```

---

## Development & Run Commands

### 1. Backend (`cd backend`)
- **Start dev server (HMR via tsx):** `npm run dev`
- **Build TypeScript:** `npm run build`
- **Run production server:** `npm run start`
- **Run migrations:** `npm run migrate`
- **Import VN provinces:** `npm run import:vn-provinces`
- **Seed initial admin:** `npx tsx src/scripts/create-admin.ts`
- **Run tests:** `npm run test`

### 2. Frontend (`cd frontend`)
- **Start dev server (Vite):** `npm run dev`
- **Build production bundle:** `npm run build`
- **Typecheck:** `npm run typecheck`
- **Lint code:** `npm run lint`
- **Preview build:** `npm run preview`

---

## Database Configuration

- **Database Engine:** PostgreSQL (driver: `pg`)
- **Schema:** Danh sách bảng đang sống nằm ở `.opencode/knowhow/know-how.md`.
- **Migration Policy:** All migrations must be idempotent (using `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

---

## API & Communication Conventions

### Standard Response Envelope
All backend endpoints must return a standardized envelope:
```json
{
  "success": true,
  "message": "Thành công",
  "data": { ... }
}
```
Error responses:
```json
{
  "success": false,
  "message": "Mô tả lỗi rõ ràng",
  "error": { ... }
}
```

### Authentication & Authorization
- **Access Token:** Short-lived JWT (15 minutes), sent in `Authorization: Bearer <token>` header.
- **Refresh Token:** Long-lived JWT (7 days), stored securely in an `httpOnly` cookie named `refreshToken`.
- **Roles:** `ADMIN`, `ACCOUNTANT`, `VIEWER`.
- **Security:**
  - Never log passwords or sensitive user tokens.
  - Never return `password_hash` in API responses.
  - Keep `.env` out of version control.

---

## Coding Standards & Conventions

### Naming Conventions
- **Files & Directories:** `camelCase` (e.g. `authService.ts`, `axiosClient.ts`)
- **React Components:** `PascalCase` (e.g. `LoginPage.tsx`, `MainLayout.tsx`)
- **TypeScript Types & Interfaces:** `PascalCase` (e.g. `UserPublic`, `LoginResponse`)
- **Functions & Variables:** `camelCase` (e.g. `createUser`, `accessToken`)
- **Constants / Envs:** `UPPER_SNAKE_CASE` (e.g. `JWT_SECRET`, `MAX_PAGE_SIZE`)
- **Database Tables & Columns:** `snake_case` (e.g. `users`, `created_at`, `full_name`)

### Frontend Architecture Rules
1. **Routing:** Use `BrowserRouter` + JSX routes (`react-router-dom`). Do **NOT** use `createBrowserRouter` (which causes context conflicts with `AuthProvider`).
2. **Context Provider Order:** `AuthProvider` must be wrapped within `BrowserRouter`. Navigation redirects should happen at page/route level.
3. **Forms:** Use `react-hook-form` with `yup` schema validation.
4. **State Management:** Zustand for global state (`authStore.ts`), React Context for auth/theme sessions, TanStack Query for server state.
5. **UI & Styling:** Tailwind CSS v3 with `clsx`/`tailwind-merge` (`cn` utility), Lucide React icons.

### Backend Architecture Rules
1. **Layered Pattern:** Controllers handle request parsing and response delivery. Services encapsulate business rules. Database queries reside in services/models.
2. **Async/Await:** Avoid `.then()/.catch()` chaining; use standard `try/catch` and early returns.
3. **Validation:** Validate incoming request payloads with `express-validator` middleware before processing.

---

## Project Knowledge Base (`.opencode/knowhow/`)

Before implementing features, APIs, migrations, or UI changes, always read the relevant knowhow docs under `.opencode/knowhow/`:
- **`know-how.md`**: DB schema, active API endpoints, project structure.
- **`system-features.md`**: Business logic, roles/permissions, feature flows.
- **`coding-convention.md`**: Detailed coding conventions for Frontend and Backend.
- **`decisions.md`**: Architectural decisions (do not violate without explicit discussion).
- **`lessons-learned.md`**: Past bug fixes, pitfalls, and preventative patterns.
- **`codebase-exploration.md`**: Delivery data flows and component relationships.
