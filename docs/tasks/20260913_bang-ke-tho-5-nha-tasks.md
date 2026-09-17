# Task List: Lên bảng kê thô 5 nhà
**Ngày:** 2026-09-13
**BA Doc:** `docs/ba/20260913_bang-ke-tho-5-nha-analysis.md`
**UI Spec:** `docs/ui/20260913_bang-ke-tho-5-nha-ui-spec.md`

Sprint này = hub file (upload/list/download/overwrite/xóa). **Không** implement transform ND-MCC / CLV / Calofic.

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| BE-01 | Env + MinIO bucket riêng | `env.ts`: `minio.bangKeBucket` = `process.env.MINIO_BANG_KE_BUCKET \|\| 'phuphatcorp-bang-ke-tho'`. `.env.docker.example` + comment backend `.env.example` nếu có. `docker-compose.yml` `minio-init`: `mc mb --ignore-existing local/phuphatcorp-bang-ke-tho`. `server.ts` startup: `ensureBucket` **cả hai** bucket. | S |
| BE-02 | Mở rộng `storageService` | Thêm overload/param `bucket?: string` (default `env.minio.bucket` để không phá inspections). Methods: `ensureBucket(bucket?)`, `putObject({ bucket, objectKey, buffer, mimetype })` — **không** randomize filename (key do caller quyết định BR-016), `getStream(bucket, objectKey)`, `deleteObject(bucket, objectKey)` (ignore NoSuchKey). **Cấm** dùng `getPublicUrl` cho bang-ke. Giữ API cũ `upload`/`delete`/`getStream(filename)` cho inspections. | M |
| BE-03 | Migration `046_create_bang_ke_tho.sql` | Idempotent. Tables `bang_ke_tho_batches`, `bang_ke_tho_outputs` đúng BA §5. UNIQUE `filename_key`, UNIQUE `(batch_id, house_code)`, CHECK `house_code IN ('nd_mcc','clv','calofic')`, CHECK `status IN ('pending','ready','failed')`, index `uploaded_at DESC`. FK `uploaded_by → users(id)`, `ON DELETE CASCADE` outputs. **Không** seed permission mới. | M |
| BE-04 | Constants + helpers | `backend/src/constants/bangKeTho.ts`: `HOUSE_CODES`, `HOUSE_PREFIX` (`nd_mcc→'ND-MCC'`, `clv→'clv'`, `calofic→'calofic'`), `MAX_FILE_BYTES=10*1024*1024`, `PROCESSED_SHEET='Processed'`. `normalizeFilenameKey(name)`, `inputStem(originalFilename)`, `downloadFilename(houseCode, originalFilename)`, `inputObjectKey(batchId)`, `outputObjectKey(batchId, houseCode)`. | S |
| BE-05 | `bangKeThoService.ts` | Xem chi tiết dưới. Methods: `createBatch`, `listBatches`, `getBatch`, `deleteBatch`, `getInputStream`, `getOutputStream`. Parse xlsx chỉ để **verify sheet `Processed`** (ExcelJS hoặc `xlsx` đã có) — **không** import rows. | L |
| BE-06 | Controller + Zod + multer | `bangKeThoController.ts` + `bangKeThoSchema.ts`. Multer `memoryStorage`, filter `.xlsx`, `limits.fileSize=10MB`. Query `overwrite` boolean. List: `page`, `limit` (max 100), `q`. Download: `res` pipe stream + `Content-Disposition` (RFC 5987 `filename*`). Map lỗi service → 400/403/404/409 với `data.code`. | M |
| BE-07 | Routes | `backend/src/routes/bangKeTho.ts`, mount `router.use('/bang-ke-tho', …)` trong `index.ts`. GET list + GET files: `accounting_data.view`. POST + DELETE: `accounting_data.manage`. | S |

### BE-05 — `bangKeThoService` (bắt buộc)

**`normalizeFilenameKey`:** `path.basename` → trim → lower case.

**`createBatch({ buffer, originalFilename, mimetype, userId, overwrite })`:**
1. Reject nếu size > 10MB hoặc extension không `.xlsx`.
2. Load workbook; nếu không parse được → 400 `"Không đọc được file Excel"`.
3. `sheetNames` phải chứa đúng `'Processed'` (case-sensitive) → không thì 400.
4. `filename_key = normalizeFilenameKey(originalFilename)` cắt 255.
5. `SELECT id FROM bang_ke_tho_batches WHERE filename_key=$1`.
   - Tồn tại && `!overwrite` → throw `{ statusCode: 409, code: 'BANG_KE_DUPLICATE', batch_id, original_filename }`.
   - Tồn tại && overwrite → transaction: load old object keys; `DELETE FROM bang_ke_tho_batches WHERE id=$1` (cascade outputs); **sau commit** xóa MinIO old keys (best-effort). Dùng **UUID mới** cho đợt mới (BA: một kỳ một bộ; id mới OK).
6. `id = randomUUID()`. PutObject `batches/{id}/input.xlsx` vào **bangKeBucket**.
7. Transaction: INSERT batch; INSERT 3 outputs `pending` với `download_filename` BR-008. Fail DB → `deleteObject` input vừa put.
8. Return shape API 6.1 (join `users.full_name` as `uploaded_by_name`).

**`listBatches({ page, limit, q })`:** JOIN users, LEFT JOIN outputs, aggregate 3 houses per batch (ổn định thứ tự `nd_mcc`, `clv`, `calofic`). `q` ILIKE `original_filename`. Sort `uploaded_at DESC`. Pagination `{ data, pagination }`.

**`deleteBatch(id)`:** SELECT keys; DELETE DB; then MinIO delete input + output keys (ignore missing). 404 nếu không có row.

**`getInputStream(id)` / `getOutputStream(id, houseCode)`:** 404 batch; house sai → 400; `pending` → 409 `BANG_KE_OUTPUT_PENDING`; `failed` → 409 `BANG_KE_OUTPUT_FAILED` + message; `ready` → stream. Sprint này output luôn pending — vẫn viết nhánh `ready`/`failed`.

**Race UNIQUE `filename_key`:** catch `23505` → xử lý như 409 duplicate.

---

## 🎨 FRONTEND TASKS

Đọc UI Spec **trước** khi code. Không tự bịa layout/kỳ ngày/nút chạy module.

| ID | Task | Chi tiết kỹ thuật | UI Spec | Effort |
|----|------|-------------------|---------|--------|
| FE-01 | `bangKeThoApi.ts` | Types `BangKeHouse`, `BangKeBatch`, list pagination. `listBatches({ page, limit, q })`. `uploadBatch(file, overwrite: boolean)` FormData. `deleteBatch(id)`. `downloadInput(id)` → blob + parse filename từ header. **Không** gọi download output trên UI sprint này. | § API BA | M |
| FE-02 | `useBangKeTho.ts` | `useBangKeThoBatches({ page, q })` queryKey `['bang-ke-tho', page, q]`. `useUploadBangKeTho()` mutation. `useDeleteBangKeTho()` mutation. Invalidate list on success. Pattern `useDeliveryData.ts` / weight adjustments. | — | M |
| FE-03 | Components | `BangKeThoDropzone` (file input labelled, drag, Enter/Space, 10MB/.xlsx client). `BangKeThoHouseBadge` 3 status. `BangKeThoTable` truncate + `title`, icon buttons `aria-label`. `BangKeThoOverwriteDialog`, `BangKeThoDeleteDialog` (danger confirm, Esc, lock submit). Tái dụng `Modal`, `Table`, `Button`, `Badge`, `Pagination`, `Input`. | Screen 1–3 | L |
| FE-04 | `BangKeThoPage.tsx` | Route page. `canManage` = `accounting_data.manage` \|\| ADMIN. URL `useSearchParams` `page`+`q` (debounce search 300ms). States: skeleton, empty, empty search, error+retry, populated, uploading. Toast. 409 → mở overwrite, giữ file. Download: object URL + revoke. Sau xóa hết trang → `page-1`. | Screen 1 | L |
| FE-05 | Router + sidebar + i18n | `Router.tsx`: `/accounting-data/bang-ke-tho`. `MainLayout` `accountingDataSubItems` sau Import 5 nhà, icon `FileSpreadsheet`, label `t('bangKeTho.nav')`. Keys đủ UI Spec §5 trong `vi.json` **và** `en.json`. | §5 | M |

---

## 🧪 QA TASKS

| ID | Task | Chi tiết | Effort |
|----|------|----------|--------|
| QA-01 | Unit `bangKeTho` helpers + service | Mock `pool` + MinIO. Cases: normalize key; thiếu `Processed`; duplicate 409; overwrite xóa keys cũ; list pagination/`q`; delete 404; output pending 409. Fixture workbook nhỏ (xlsx in-memory) có/không sheet `Processed`. | M |
| QA-02 | FE đối chiếu UI Spec | Checklist Screen 1–3: view vs manage, empty vs search empty, modal ghi đè Hủy/Confirm, aria-label, URL `page`/`q`. | S |

---

## 📊 Thứ tự thực hiện

```
Phase 3 BE:  BE-01 → BE-02 → BE-03 → BE-04 → BE-05 → BE-06 → BE-07
             (lint + backend build sau mỗi task)
Phase 4:     npm run db:push / migrate 046
Phase 5–6:   QA-01; npm test (fail 3 lần → dừng)
Phase 7 FE:  FE-01 → FE-02 → FE-03 → FE-04 → FE-05
Phase 8:     QA-02 regression UI Spec
Phase 9–10:  cập nhật know-how.md (schema + endpoints) + system-features.md
```

---

## Coding Standards

Đọc `.cursor/knowhow/coding-convention.md` trước khi viết code.

- Envelope `{ success, message, data }`
- Files camelCase; tables snake_case
- Migration `IF NOT EXISTS`
- Không log/trả file binary trong JSON list
- Download không gắn `Access-Control-Expose` MinIO host

---

## ⚠️ Lưu ý kỹ thuật

1. **Tách bucket** — mọi put/get/delete bang-ke dùng `env.minio.bangKeBucket`, không `env.minio.bucket` (inspections).
2. **Không public URL** — không copy `inspectionController.getPublicUrl`. Pipe stream.
3. **Không đụng** `delivery_data` / Import 5 nhà / `processDeliveryData.ts`. Input là file *đã processed*; chỉ check sheet name.
4. **Ghi đè** = xóa đợt cũ + tạo UUID mới (unique `filename_key` luôn 1 row). FE list không giữ id cũ.
5. **Multer 10MB** — error `LIMIT_FILE_SIZE` → 400 tiếng Việt, không 500.
6. **Sheet name** đúng `Processed` — không fuzzy.
7. **FE không tự quyết** cột kỳ/ngày, không enable download nhà.
8. **Content-Disposition** tên Unicode (`1-8.7.xlsx` ASCII ổn; vẫn set `filename*`).
9. **Orphan MinIO:** put trước insert; rollback object nếu INSERT fail. Xóa DB trước, MinIO sau (ưu tiên unique key).
10. **Prod:** set `MINIO_BANG_KE_BUCKET` trên server; bucket không tự có nếu quên `ensureBucket` startup.
