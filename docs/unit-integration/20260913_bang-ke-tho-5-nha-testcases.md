# Test cases: Lên bảng kê thô 5 nhà
**Ngày:** 2026-09-13
**BA:** `docs/ba/20260913_bang-ke-tho-5-nha-analysis.md`

## Unit (đã implement)

| ID | Case | File |
|----|------|------|
| UT-01 | normalize filename key | `bangKeThoService.test.ts` |
| UT-02 | download names BR-008 | same |
| UT-03 | reject missing Processed | same |
| UT-04 | reject non-xlsx | same |
| UT-05 | 409 duplicate without overwrite | same |
| UT-06 | overwrite deletes then inserts | same |
| UT-07 | list pagination + q | same |
| UT-08 | delete 404 | same |
| UT-09 | output pending 409 | same |

## API (manual / later integration)

| ID | Case | Expected |
|----|------|----------|
| IT-01 | GET list without token | 401 |
| IT-02 | POST without manage | 403 |
| IT-03 | GET view can list + download | 200 |
| IT-04 | POST valid Processed | 200, 3 pending houses |
| IT-05 | POST same name no overwrite | 409 BANG_KE_DUPLICATE |

## UI Spec checklist (Phase 8)

- [x] Route `/accounting-data/bang-ke-tho` + sidebar kế toán
- [x] Dropzone chỉ manage
- [x] Loading skeleton, empty, empty search, error retry
- [x] Confirm overwrite + delete
- [x] House badges 3 states; download output not on UI
- [x] URL `page` + `q`
- [x] i18n vi + en
- [x] Icon buttons aria-label
- [x] Toast aria-live
