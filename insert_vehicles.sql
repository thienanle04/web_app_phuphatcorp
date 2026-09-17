-- ============================================================
-- SQL Script: Thêm danh mục xe (Vehicles) vào hệ thống
-- Hệ thống: PhuPhatCorp
-- Bảng đích: vehicles
-- Lưu ý: plate_number được chuẩn hóa viết hoa không dấu cách/gạch nối
-- ============================================================

INSERT INTO vehicles (plate_number, driver_name, vehicle_type, status, oil_change_interval_km)
VALUES
  ('50H88294', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('50H69501', 'r bảo',       'Xe nhà', 'active', 5000),
  ('50H55116', 's phi',       'Xe nhà', 'active', 5000),
  ('50H50999', 'd phú',       'Xe nhà', 'active', 5000),
  ('50H64316', 'q hải',       'Xe nhà', 'active', 5000),
  ('50H54580', 'f sơn',       'Xe nhà', 'active', 5000),
  ('50H66445', 'y thanh',     'Xe nhà', 'active', 5000),
  ('50H63174', 'ư lừa',       'Xe nhà', 'active', 5000),
  ('50H55443', 'long2.5',     'Xe nhà', 'active', 5000),
  ('50H70216', 'b tâm',       'Xe nhà', 'active', 5000),
  ('50H74619', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('50H87442', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('50H55161', 't luân',      'Xe nhà', 'active', 5000),
  ('50H64470', 'aloi',        'Xe nhà', 'active', 5000),
  ('50E16461', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('50F08817', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('51D38021', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('50E93403', 'Xe ngoài',    'Xe ngoài', 'active', 5000),
  ('50H92136', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('51D55829', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('51C81056', 'x1',          'Xe nhà', 'active', 5000),
  ('62H01887', 'Xe ngoài',    'Xe ngoài', 'active', 5000),
  ('50H60635', 'e2',          'Xe nhà', 'active', 5000),
  ('50H86564', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('50H44328', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('50E56521', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('50H44024', 'Chưa có tên', 'Xe nhà', 'active', 5000),
  ('50E64873', 'NHÀ (5)',     'Xe nhà', 'active', 5000),
  ('50E65434', 'NHÀ (6)',     'Xe nhà', 'active', 5000),
  ('50E32401', 'NHÀ (4)',     'Xe nhà', 'active', 5000),
  ('50H87055', 'NHÀ (2)',     'Xe nhà', 'active', 5000),
  ('50E75774', 'NHÀ (7)',     'Xe nhà', 'active', 5000),
  ('50H75206', 'NHÀ (3)',     'Xe nhà', 'active', 5000),
  ('50H66347', 'NHÀ (1)',     'Xe nhà', 'active', 5000),
  ('50H55294', 'NHÀ',         'Xe nhà', 'active', 5000),
  ('50H55129', 'Xe ngoài',    'Xe ngoài', 'active', 5000),
  ('50H69717', 'Xe ngoài',    'Xe ngoài', 'active', 5000),
  ('50E75873', 'Xe ngoài',    'Xe ngoài', 'active', 5000)
ON CONFLICT (plate_number) WHERE status = 'active' DO UPDATE SET
  driver_name = EXCLUDED.driver_name,
  vehicle_type = EXCLUDED.vehicle_type,
  oil_change_interval_km = EXCLUDED.oil_change_interval_km,
  updated_at = NOW();
