-- Sửa vị trí dấu thanh tiếng Việt trên provinces.name/full_name và wards.name/full_name.
--
-- Quy tắc (chính tả hiện hành):
--   oa/oe/uy KHÔNG phụ âm cuối, KHÔNG vần ba: dấu trên o/u  (Hòa, khỏe, Thụy)
--   oa/oe/uy CÓ i/o/y hoặc phụ âm cuối: dấu trên nguyên âm sau (Hoài, Hoàn, Hoàng, Hoành)
--   qu + y/a: u là bán nguyên âm — giữ dấu trên y/a (Quý, Quả)
--
-- An toàn khi chạy lại. Gồm cả revert nếu từng replace nhầm Hoà→Hòa làm vỡ Hoàn/Hoàng/Hoài.
--
-- psql ... -f scripts/sql/fix_vn_geo_tone_marks.sql

BEGIN;

CREATE OR REPLACE FUNCTION tmp_vn_fix_oa_oe_uy_tone(src text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
  n int;
  i int;
  c text;
  nxt text;
  after2 text;
  prev_c text;
  out_t text := '';
  a_tone constant text := 'àáảãạÀÁẢÃẠ';
  o_tone constant text := 'òóỏõọÒÓỎÕỌ';
  e_tone constant text := 'èéẻẽẹÈÉẺẼẸ';
  y_tone constant text := 'ỳýỷỹỵỲÝỶỸỴ';
  u_tone constant text := 'ùúủũụÙÚỦŨỤ';
  a_plain constant text := 'aaaaaAAAAA';
  e_plain constant text := 'eeeeeEEEEE';
  y_plain constant text := 'yyyyyYYYYY';
  o_plain constant text := 'oooooOOOOO';
  u_plain constant text := 'uuuuuUUUUU';
  pos int;
  cons constant text := 'bcdđghklmnpqrstvxBCDĐGHKLMNPQRSTVX';
  tri_vowel constant text := 'ioyIOY';
BEGIN
  IF src IS NULL OR src = '' THEN
    RETURN src;
  END IF;

  -- KHòai / KHóai: H không phải viết hoa trong tên riêng
  t := replace(src, 'KHòai', 'Khoài');
  t := replace(t, 'KHóai', 'Khoái');
  t := replace(t, 'KHÒAI', 'KHOÀI');
  t := replace(t, 'KHÓAI', 'KHOÁI');

  n := char_length(t);
  i := 1;
  WHILE i <= n LOOP
    c := substr(t, i, 1);
    nxt := CASE WHEN i < n THEN substr(t, i + 1, 1) ELSE '' END;
    after2 := CASE WHEN i + 1 < n THEN substr(t, i + 2, 1) ELSE '' END;
    prev_c := CASE WHEN i > 1 THEN substr(t, i - 1, 1) ELSE '' END;

    -- o + a/e có dấu, không vần ba / không phụ âm cuối → chuyển dấu lên o
    IF c IN ('o', 'O') AND nxt <> '' THEN
      pos := strpos(a_tone, nxt);
      IF pos > 0 THEN
        IF after2 = '' OR (strpos(tri_vowel, after2) = 0 AND strpos(cons, after2) = 0) THEN
          out_t := out_t || substr(o_tone, pos, 1) || substr(a_plain, pos, 1);
          i := i + 2;
          CONTINUE;
        END IF;
      END IF;
      pos := strpos(e_tone, nxt);
      IF pos > 0 THEN
        IF after2 = '' OR (after2 NOT IN ('o', 'O') AND strpos(cons, after2) = 0) THEN
          out_t := out_t || substr(o_tone, pos, 1) || substr(e_plain, pos, 1);
          i := i + 2;
          CONTINUE;
        END IF;
      END IF;
    END IF;

    -- ò/ó/ỏ... + a/e trơn + (i/o/y hoặc phụ âm) → chuyển dấu xuống a/e (revert)
    pos := strpos(o_tone, c);
    IF pos > 0 AND nxt <> '' THEN
      IF nxt IN ('a', 'A') THEN
        IF after2 <> '' AND (strpos(tri_vowel, after2) > 0 OR strpos(cons, after2) > 0) THEN
          out_t := out_t || substr(o_plain, pos, 1) || substr(a_tone, pos, 1);
          i := i + 2;
          CONTINUE;
        END IF;
      ELSIF nxt IN ('e', 'E') THEN
        IF after2 <> '' AND (after2 IN ('o', 'O') OR strpos(cons, after2) > 0) THEN
          out_t := out_t || substr(o_plain, pos, 1) || substr(e_tone, pos, 1);
          i := i + 2;
          CONTINUE;
        END IF;
      END IF;
    END IF;

    -- u + y có dấu, không sau q, không âm cuối → chuyển dấu lên u
    IF c IN ('u', 'U') AND nxt <> '' AND prev_c NOT IN ('q', 'Q') THEN
      pos := strpos(y_tone, nxt);
      IF pos > 0 THEN
        IF after2 = '' OR (after2 NOT IN ('a', 'A', 'u', 'U') AND strpos(cons, after2) = 0) THEN
          out_t := out_t || substr(u_tone, pos, 1) || substr(y_plain, pos, 1);
          i := i + 2;
          CONTINUE;
        END IF;
      END IF;
    END IF;

    -- ù/ú/ủ... + y trơn + (a/u hoặc phụ âm) → chuyển dấu xuống y (không áp cho qu)
    pos := strpos(u_tone, c);
    IF pos > 0 AND nxt <> '' AND prev_c NOT IN ('q', 'Q') THEN
      IF nxt IN ('y', 'Y') THEN
        IF after2 <> '' AND (after2 IN ('a', 'A', 'u', 'U') OR strpos(cons, after2) > 0) THEN
          out_t := out_t || substr(u_plain, pos, 1) || substr(y_tone, pos, 1);
          i := i + 2;
          CONTINUE;
        END IF;
      END IF;
    END IF;

    out_t := out_t || c;
    i := i + 1;
  END LOOP;

  RETURN out_t;
END;
$$;

UPDATE provinces
SET
  name = tmp_vn_fix_oa_oe_uy_tone(name),
  full_name = tmp_vn_fix_oa_oe_uy_tone(full_name)
WHERE name IS DISTINCT FROM tmp_vn_fix_oa_oe_uy_tone(name)
   OR full_name IS DISTINCT FROM tmp_vn_fix_oa_oe_uy_tone(full_name);

UPDATE wards
SET
  name = tmp_vn_fix_oa_oe_uy_tone(name),
  full_name = tmp_vn_fix_oa_oe_uy_tone(full_name)
WHERE name IS DISTINCT FROM tmp_vn_fix_oa_oe_uy_tone(name)
   OR full_name IS DISTINCT FROM tmp_vn_fix_oa_oe_uy_tone(full_name);

DROP FUNCTION tmp_vn_fix_oa_oe_uy_tone(text);

COMMIT;
