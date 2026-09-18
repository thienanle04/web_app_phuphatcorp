# PhuPhatCorp Web v2 - Sheet Processing & DeliveryData Codebase Exploration

**Generated:** 2026-04-11

---

## 📊 Overview

The codebase contains comprehensive sheet processing logic for delivery data with:
- **Factory-based grouping**: CLF, VFM, MCC, CLV, NDFC factories
- **Weight adjustment system**: Master data for product weight adjustments
- **Delivery data processing**: Multi-sheet output (Processed + per-factory sheets)
- **Browser-side processing**: All logic runs client-side using XLSX library

---

## 📂 Directory Structure

### Frontend Structure

```
frontend/src/
├── pages/
│   └── admin/
│       ├── DeliveryDataPage.tsx              ← Main delivery data processing page
│       ├── accounting-data/
│       │   └── WeightAdjustmentPage.tsx      ← Weight adjustment master data management
│       ├── vehicle-data/
│       ├── RoleManagementPage.tsx
│       ├── PermissionManagementPage.tsx
│       └── UserManagementPage.tsx
│
├── components/
│   ├── delivery-data/
│   │   └── WeightAdjustmentConfirmDialog.tsx ← Confirm weight adjustments before processing
│   ├── accounting-data/
│   │   ├── WeightAdjustmentFormModal.tsx     ← Create/Edit weight adjustments
│   │   └── WeightAdjustmentUploadModal.tsx   ← Upload weight adjustments from Excel
│   ├── vehicle-data/
│   ├── admin/
│   ├── dispatch/
│   └── ui/
│
├── utils/
│   ├── processDeliveryData.ts                ← Core delivery data processing engine
│   ├── format.ts
│   └── cn.ts
│
├── api/
│   ├── weightAdjustmentApi.ts                ← Weight adjustment REST API client
│   ├── dispatchApi.ts
│   ├── driverApi.ts
│   ├── vehicleApi.ts
│   ├── tripCodeApi.ts
│   └── axiosClient.ts
│
└── hooks/
    ├── useWeightAdjustments.ts               ← React Query hooks for weight adjustments
    ├── useDispatchSchedules.ts
    ├── useVehicles.ts
    └── ...
```

### Backend Structure

```
backend/src/
├── migrations/
│   └── 009_create_weight_adjustments.sql     ← Database schema for weight adjustments
│
├── services/
│   └── weightAdjustmentService.ts            ← Business logic for weight adjustments
│
├── controllers/
│   └── weightAdjustmentController.ts         ← API endpoint handlers
│
└── routes/
    └── weightAdjustments.ts                  ← API route definitions
```

### Documentation

```
docs/
├── ba/
│   └── 20260331_delivery-data-processing-analysis.md
├── ui/
│   └── 20260409_delivery-data-weight-verify-ui-spec.md
└── tasks/
    └── 20260331_delivery-data-processing-tasks.md

.opencode/knowhow/
├── system-features.md                        ← Complete system documentation
├── know-how.md
├── decisions.md
├── coding-convention.md
└── lessons-learned.md
```

---

## 🔑 Key Files & Components

### 1. Core Processing Engine: `processDeliveryData.ts`

**Location:** `frontend/src/utils/processDeliveryData.ts` (581 lines)

**Exports:**
- `parseDeliveryFile(file)` - Parses XLSX file, skips 4 header rows, returns raw rows + source row numbers
- `processDeliveryDataFromRows(rows, sourceRowNums)` - Core processing logic
- `processDeliveryData(file)` - Complete wrapper
- `COL` - Column index mapping (34 columns)
- Types: `RawRow`, `ParsedFileData`, `ProcessResult`

**Column Mapping (COL object):**
```typescript
export const COL = {
  CHANNEL: 0, SUB_CHANNEL: 1, DIEN_GIAI_CT: 2, DIEN_GIAI: 3, SLOT: 4,
  WAYBILL_NO: 5, SLOT_NO: 6, USER_TAO_HD: 7, USER_TAO_PXK: 8, PO_NUMBER: 9,
  WAREHOUSE_NO: 10, WAREHOUSE_NAME: 11, MA_PXK: 12, SO_CHUNG_TU: 13, SO_SERI: 14,
  DIA_CHI: 15, TEN_HANG_HOA: 16, MA_DVT: 17, 
  SP_TRONG_LUONG: 18,      // ← Product weight net
  HD_TRONG_LUONG: 19,      // ← Invoice weight net (used for Round(MT))
  MA_NCC: 20, MA_KH: 21, TEN_KH: 22, MA_HANG: 23, TEN_HANG_EN: 24,
  LOAI_HANG: 25, MA_LH_GIAO: 26, SO_LUONG: 27,
  SO_TAU_XE: 28,           // ← Group key 1 (vehicle)
  TAI_XE: 29, SO_CONT: 30,
  NGAY_HD: 31,             // ← Group key 2 (date)
  SO_HD: 32,               // ← Sort key (invoice number)
  THONG_TIN_BS: 33,
}
```

**Factory Mapping:**
```typescript
const FACTORY_BY_NCC: Record<string, string> = {
  '2000000001': 'CLF',
  '2100000002': 'VFM',
  '2000000007': 'MCC',
  '2000000008': 'NDFC',
};
// Default: 'CLV'
```

**Processing Logic:**
1. Skip first 4 rows, row 5 = header, row 6+ = data
2. Group by `(SO_TAU_XE + NGAY_HD)` composite key
3. Sort within group: by `SO_HD` ASC (numeric-aware)
4. Sort groups: by `NGAY_HD` ASC, then `SO_TAU_XE` ASC
5. Calculate `Round(MT) = Sum(HD_TRONG_LUONG) / 1000` per group (3 decimal places)
6. Build output with:
   - Sheet "Processed": All rows + separator rows (gray) between groups
   - Sheet "CLF", "VFM", "MCC", "CLV", "NDFC": Per-factory filtered data
7. Output headers: 39 columns with factory breakdowns

**Output Columns (39 total):**
- Mã nhà cung cấp, Số hóa đơn, Ngày hóa đơn, Số tàu, Mã/Tên khách hàng, Địa chỉ
- Mã/Tên hàng hóa (Vie/En), Mã liên hệ, Mã DVT, Số lượng
- SP Trọng lượng net, HĐ Trọng lượng, **Round(MT)**
- Factory cols: **CLF, VFM, MCC, CLV, NDFC** (with sums for first invoice row in group)
- Tổng khối, Tổng tất cả, Tài xế, Thông tin bổ sung
- Slot, Diễn giải, Channel, SubChannel, SlotNo, User tạo HĐ/PXK, PO number
- Warehouse info, Phiếu XK, Chứng từ, Số seri, Loại hàng

**Returns: ProcessResult**
```typescript
{
  processedRows: number,           // Count of data rows processed
  groupCount: number,              // Count of groups (vehicle+date combinations)
  dateRange: { from, to },         // DD/MM/YYYY format
  warnings: string[],              // Validation warnings
  outputBlob: Blob,                // Excel file ready for download
  outputFilename: string,          // delivery_processed_YYYYMMDD.xlsx
}
```

---

### 2. DeliveryData Page: `DeliveryDataPage.tsx`

**Location:** `frontend/src/pages/admin/DeliveryDataPage.tsx` (393 lines)

**State Management:**
```typescript
type PageState = 'idle' | 'verifying' | 'awaiting_confirmation' | 'processing' | 'success' | 'error';
```

**Flow:**
1. **Idle**: Upload zone (drag-drop or click)
2. **Verifying**: Parse file + fetch weight adjustments master data
3. **Awaiting Confirmation**: If weight adjustments found, show confirmation dialog
4. **Processing**: Apply adjustments (if confirmed) and process data
5. **Success**: Display results and download button
6. **Error**: Show error message with retry option

**Weight Adjustment Logic:**
```
For each row in parsed file:
  If MA_HANG (col 23) exists in weight_adjustments master data:
    If TEN_HANG_HOA (col 16) matches master.ten_hang:
      Use master.gia_tri_cu (if not null) → replace SP_TRONG_LUONG
      Reason: "gia_tri_cu"
    Else:
      Use master.gia_tri_dieu_chinh → replace SP_TRONG_LUONG
      Reason: "gia_tri_dieu_chinh"
    Then recalculate: HD_TRONG_LUONG = SO_LUONG × new SP_TRONG_LUONG
```

**Helper Functions:**
- `buildAdjustments()` - Find rows matching weight adjustment criteria
- `applyAdjustments()` - Apply weight changes to raw rows
- `handleConfirmAdjustments()` - User confirms adjustments
- `handleSkipAdjustments()` - User skips adjustments, process original data

---

### 3. Weight Adjustment Components

#### A. `WeightAdjustmentConfirmDialog.tsx`
**Purpose**: Modal dialog showing detected weight adjustments requiring confirmation

**Props:**
```typescript
interface AdjustmentRow {
  rawRowIndex: number;
  sourceRowNum: number;
  maHang: string;
  tenHangFile: string;
  tenHangMaster: string;
  spTrongLuongGoc: number;
  giaTriApDung: number;
  lyDo: 'gia_tri_cu' | 'gia_tri_dieu_chinh';
}
```

**Display**: Table with 7 columns (Line, Code, File Name, Master Name, Original Weight, New Weight, Reason)

---

#### B. `WeightAdjustmentPage.tsx`
**Location:** `frontend/src/pages/admin/accounting-data/WeightAdjustmentPage.tsx` (278 lines)

**Features:**
- List active weight adjustments in table
- Search by mã_hang or ten_hang
- CRUD operations (Create, Edit, Delete via modals)
- Upload Excel for bulk import
- Permission-based access (accounting_data.manage)

**Table Columns:**
- Mã hàng hóa (32px)
- Tên hàng hóa
- Giá trị cũ (text-right)
- Giá trị điều chỉnh (text-right, bold)
- Actions (Pencil = Edit, Trash = Delete)

---

#### C. `WeightAdjustmentFormModal.tsx`
**Location:** `frontend/src/components/accounting-data/WeightAdjustmentFormModal.tsx` (235 lines)

**Form Fields:**
- Mã hàng hóa (required, max 100 chars)
- Tên hàng hóa (required, max 255 chars)
- Giá trị cũ (optional, numeric, ≥ 0)
- Giá trị điều chỉnh (required, numeric, ≥ 0)

**Validation:**
- Frontend: React Hook Form + custom validation
- Backend: Duplicate ma_hang check

---

#### D. `WeightAdjustmentUploadModal.tsx`
**Location:** `frontend/src/components/accounting-data/WeightAdjustmentUploadModal.tsx` (234 lines)

**Features:**
- Drag-drop or click to upload Excel
- Template download (generates template with 4 columns)
- Parse XLSX client-side using `xlsx` library
- Display validation errors (fail-fast on duplicates)
- Upload endpoint: `POST /api/weight-adjustments/upload`

**Template Format:**
```
Mã hàng hóa | Tên hàng hóa | Giá trị cũ | Giá trị điều chỉnh
```

**Error Handling:**
- In-file duplicates
- Database duplicates (existing active records)
- Returns detailed error list with row numbers

---

### 4. API Layer: `weightAdjustmentApi.ts`

**Location:** `frontend/src/api/weightAdjustmentApi.ts` (65 lines)

**Endpoints:**
```typescript
GET    /weight-adjustments          → WeightAdjustment[]
POST   /weight-adjustments          → WeightAdjustment (create)
PUT    /weight-adjustments/:id      → WeightAdjustment (soft-update)
DELETE /weight-adjustments/:id      → void (soft-delete)
POST   /weight-adjustments/upload   → { inserted: number }
```

**Data Types:**
```typescript
interface WeightAdjustment {
  id: number;
  ma_hang: string;
  ten_hang: string;
  gia_tri_cu: number | null;
  gia_tri_dieu_chinh: number;
  status: 'active' | 'deactive';
  version: number;                  // Soft-update tracking
  start_date: string;
  end_date: string | null;
  action_type: 'create' | 'update' | 'delete' | 'upload';
  action_by: number | null;
  action_by_name: string | null;
  created_at: string;
  updated_at: string;
}
```

---

### 5. React Query Hooks: `useWeightAdjustments.ts`

**Location:** `frontend/src/hooks/useWeightAdjustments.ts` (53 lines)

**Hooks:**
- `useGetWeightAdjustments()` - useQuery for listing
- `useCreateWeightAdjustment()` - useMutation for create
- `useUpdateWeightAdjustment()` - useMutation for update
- `useDeleteWeightAdjustment()` - useMutation for delete (soft-delete)
- `useUploadWeightAdjustments()` - useMutation for bulk upload

All mutations invalidate `['weight-adjustments']` query key on success.

---

### 6. Backend Database: `009_create_weight_adjustments.sql`

**Location:** `backend/src/migrations/009_create_weight_adjustments.sql` (85 lines)

**Table Schema:**
```sql
weight_adjustments (
  id SERIAL PK,
  ma_hang VARCHAR(100) NOT NULL,
  ten_hang VARCHAR(255) NOT NULL,
  gia_tri_cu NUMERIC(15,3),              -- Nullable (first entry may not have old value)
  gia_tri_dieu_chinh NUMERIC(15,3) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',   -- 'active' | 'deactive'
  version INTEGER DEFAULT 1,              -- Incremented on soft-update
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  action_type VARCHAR(20) DEFAULT 'create',  -- 'create' | 'update' | 'delete' | 'upload'
  action_by INTEGER FK→users.id,
  action_by_name VARCHAR(255),           -- Denormalized for audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

**Indexes:**
- `idx_weight_adjustments_ma_hang`
- `idx_weight_adjustments_status`
- `idx_weight_adjustments_action_by`

**Permissions:**
- `accounting_data.view` - ADMIN, ACCOUNTANT, VIEWER
- `accounting_data.manage` - ADMIN, ACCOUNTANT

---

### 7. Backend Service: `weightAdjustmentService.ts`

**Location:** `backend/src/services/weightAdjustmentService.ts` (206 lines)

**Methods:**
- `list()` - Fetch all active records, ordered by ma_hang ASC
- `findActiveByMaHang()` - Find active record by product code
- `findById()` - Find record by ID (active or deactive)
- `create()` - Create new record with version=1, action_type='create'
- `softUpdate()` - Deactivate old + insert new version (transaction)
- `softDelete()` - Mark as deactive (soft-delete)
- `uploadMany()` - Bulk insert with fail-fast validation

**Validation Logic:**
- Duplicate check: in-file + database
- Fail-fast: If any error, no inserts
- Returns detailed error list per row

---

## 📋 Business Rules

### Delivery Data Processing (BR)

| Code | Rule | Impact |
|------|------|--------|
| BR-001 | Grouping key = Số tàu/xe + Ngày hóa đơn | Same vehicle, same date = 1 group |
| BR-002 | Sort within group by Số HĐ ASC (numeric) | HD0001 < HD0002 < HD0010 |
| BR-003 | Sort groups by Ngày HĐ ASC, then Số tàu ASC | Chronological by date, then by vehicle |
| BR-004 | Round(MT) = HD_TRONG_LUONG / 1000, 3 decimals | Per-row calculation |
| BR-005 | Separator row between groups (gray background) | Visual grouping in output |
| BR-006 | No separator after last group | Clean end-of-file |
| BR-007 | Ngày HĐ: Excel serial → DD/MM/YYYY | Date format conversion |
| BR-008 | Factory columns show first invoice sum only | CLF/VFM/MCC/CLV/NDFC aggregation |

### Weight Adjustment (BR)

| Code | Rule | Impact |
|------|------|--------|
| WA-001 | `ma_hang` unique among active rows | Enforced at service layer |
| WA-002 | Soft-update: deactivate old + insert new | Full version history retained |
| WA-003 | Soft-delete: mark deactive, don't delete | Audit trail preserved |
| WA-004 | `gia_tri_cu` nullable (first entry) | Optional old value tracking |
| WA-005 | Upload fail-fast: any error → no inserts | Data consistency |
| WA-006 | Denormalize action_by_name for audit | Preserve action owner if user deleted |

---

## 🔄 Data Flows

### Delivery Data Processing Flow

```
┌─────────────────────────────────────────────┐
│ User uploads .xlsx (ERP export)             │
└────────────────┬────────────────────────────┘
                 │
                 ▼
         ┌──────────────────┐
         │ parseDeliveryFile│  ← Skip 4 rows, row 5=header
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────────┐
         │ Fetch weight_adjustments
         │ from API/DB          │
         └────────┬─────────────┘
                  │
                  ▼
         ┌──────────────────────┐
         │ buildAdjustments()   │  ← Match MA_HANG
         └────────┬─────────────┘
                  │
          ┌───────┴────────┐
          │                │
     No matches      Matches found
          │                │
          │                ▼
          │      ┌────────────────────────┐
          │      │ Show confirmation modal│
          │      │ WeightAdjustmentConfirm
          │      └──┬───────────────────┬─┘
          │         │                   │
          │    Confirm            Skip/Original
          │         │                   │
          │         ▼                   ▼
          │    applyAdjustments    (use original)
          │         │                   │
          └─────────┴───────┬───────────┘
                           │
                           ▼
                ┌──────────────────────────┐
                │processDeliveryDataFromRows
                │ 1. Group by vehicle+date │
                │ 2. Sort rows & groups    │
                │ 3. Calculate Round(MT)   │
                │ 4. Build output sheets   │
                └────────┬─────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │ Output XLSX with:      │
            │ - Processed (all)      │
            │ - CLF, VFM, MCC, CLV   │
            │ - NDFC (per-factory)   │
            └────────┬───────────────┘
                     │
                     ▼
            ┌────────────────────────┐
            │ User downloads file    │
            └────────────────────────┘
```

### Weight Adjustment Management Flow

```
┌──────────────────────────────────┐
│ WeightAdjustmentPage             │
├──────────────────────────────────┤
│ List all active adjustments      │
│ Search by ma_hang or ten_hang    │
└──────┬──────────────────┬────────┘
       │                  │
   ┌───▼───┐          ┌───▼──────┐
   │ Create│          │ Edit/Del │
   └───┬───┘          └───┬──────┘
       │                  │
       ▼                  ▼
   Form Modal         Form Modal (pre-filled)
       │                  │
       └──────┬───────────┘
              │
              ▼
     Validate + Submit
              │
              ▼
     POST/PUT to API
              │
     ┌────────┴─────────┐
     │                  │
  Success           Error
     │                  │
     ▼                  ▼
  Toast         Error message
  Refresh       Highlight errors
  List
```

### Weight Adjustment Upload Flow

```
┌────────────────────────────────────┐
│ WeightAdjustmentUploadModal        │
├────────────────────────────────────┤
│ Drag-drop or click to upload .xlsx │
└────────┬─────────────────────┬────┘
         │                     │
    Upload      Download Template
    File                │
         │              │
         ▼              ▼
    Parse XLSX    Generate template
    (client-side)  (4 columns:
         │          MA_HANG, TEN_HANG,
         │          GIA_TRI_CU,
         │          GIA_TRI_DIEU_CHINH)
         │
         ▼
   Validate Rows
   ├─ Check in-file duplicates
   └─ Check DB duplicates
         │
    ┌────┴──────┐
    │           │
 Errors     No Errors
    │           │
    ▼           ▼
Display      POST /upload
Error        API
Table           │
         ┌──────┴──────┐
         │             │
      Success        Error
         │             │
         ▼             ▼
    Toast       Display error
    Close       table (fail-fast)
    Refresh
```

---

## 📊 Sheet Structure in Output

### Main "Processed" Sheet
- **Header Row**: 39 columns (row 1)
- **Data Rows**: All data from file
- **Separator Rows**: Between groups (row index tracked, gray background)
- **Styling**: Header = yellow background; Separator = gray background

### Per-Factory Sheets (CLF, VFM, MCC, CLV, NDFC)
- **Header Row**: Same 39 columns
- **Data Rows**: Only rows where factory matches (factoryVals[factory] !== '')
- **Separator Rows**: Between groups within factory-filtered data
- **Logic**: If group has no data for factory, separator still added for sync

---

## 🔐 Permissions

**Delivery Data Page:**
- Route: `/admin/delivery-data`
- Access: All authenticated users (no specific permission check)
- Frontend validation: Uses delivery-data form

**Weight Adjustment Management:**
- View: `accounting_data.view` (ADMIN, ACCOUNTANT, VIEWER)
- Manage: `accounting_data.manage` (ADMIN, ACCOUNTANT)
- Backend enforces via `requirePermission()` middleware

---

## 🧪 Testing Considerations

### Unit Tests
- `processDeliveryData()` with various row counts
- Grouping logic (same vehicle+date)
- Round(MT) calculation (3 decimals)
- Date conversion (Excel serial → DD/MM/YYYY)
- Weight adjustment detection and application
- Factory mapping (MA_NCC → factory code)

### Integration Tests
- Upload file → parse → verify → confirm → process → download
- Weight adjustment upload with duplicates
- Permission checks on endpoints

### Edge Cases
- Empty rows in file
- Missing grouping columns (SO_TAU_XE, NGAY_HD)
- Excel serial dates vs. string dates
- Very large files (>10k rows)
- Invalid factory codes (→ default to CLV)

---

## 📝 Related Documentation

**In Repository:**
- `.opencode/knowhow/system-features.md` - Complete system documentation (section 5.0)
- `docs/ba/20260331_delivery-data-processing-analysis.md` - BA analysis with flowchart
- `docs/ui/20260409_delivery-data-weight-verify-ui-spec.md` - UI specifications
- `docs/tasks/20260331_delivery-data-processing-tasks.md` - Task breakdown

**Key Excerpts:**
- Section 5.1: Full delivery data processing flow
- Section 5.2: Column mapping (input → output)
- Section 5.3: Business rules (BR-001 to BR-006)
- Section 5.4: Weight adjustment verify logic
- Section 11.1: Weight adjustment master data structure

---

## 🛠️ Tech Stack

**Frontend:**
- React 18.2
- TypeScript
- TailwindCSS (styling)
- React Hook Form (form validation)
- React Query (@tanstack/react-query) - data fetching
- XLSX (xlsx ^0.18.5) - Excel parsing/generation
- ExcelJS (exceljs) - Excel workbook creation with styling
- Lucide-react - Icons
- Axios - HTTP client

**Backend:**
- Node.js + Express
- TypeScript
- PostgreSQL
- pg (database driver)
- bcrypt (password hashing)

**Utilities:**
- clsx + tailwind-merge (cn helper)
- Internationalization (vi.json, en.json)

---

## 📌 Key Insights

1. **Browser-Side Processing**: All delivery data processing happens client-side using XLSX, no backend endpoint needed
2. **Soft-Update Pattern**: Weight adjustments use soft-update (deactivate + insert) to maintain full audit trail
3. **Factory Filtering**: Single output file generates 6 sheets (Processed + 5 per-factory), all from same processed data
4. **Weight Verification**: Before processing, system checks master data and shows confirmation dialog if adjustments needed
5. **Composite Grouping**: Groups formed by combining vehicle (SO_TAU_XE) + date (NGAY_HD) as unique key
6. **Version Control**: Weight adjustments track version, action_type, action_by_name for complete audit trail
7. **Fail-Fast Upload**: Weight adjustment bulk upload validates entire file before inserting any rows

---

Generated on: 2026-04-11
