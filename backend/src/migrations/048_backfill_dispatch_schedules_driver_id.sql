-- Migration 048: Backfill vehicle_id and driver_id in dispatch_schedules
-- Purpose: Match bien_so with vehicles and active drivers in driver_vehicles
--          so drivers with 'owner' scope can track their tickets

UPDATE dispatch_schedules ds
SET 
  vehicle_id = COALESCE(ds.vehicle_id, v.id),
  driver_id = COALESCE(ds.driver_id, d.user_id),
  tai_xe = CASE 
    WHEN ds.tai_xe IS NOT NULL AND ds.tai_xe != 'Chưa có tên' AND ds.tai_xe != '' THEN ds.tai_xe
    WHEN u.full_name IS NOT NULL THEN u.full_name
    WHEN v.driver_name IS NOT NULL AND v.driver_name != 'Chưa có tên' THEN v.driver_name
    ELSE ds.tai_xe
  END
FROM vehicles v
LEFT JOIN driver_vehicles dv ON dv.vehicle_id = v.id
LEFT JOIN drivers d ON d.id = dv.driver_id AND d.status = 'active'
LEFT JOIN users u ON u.id = d.user_id
WHERE v.plate_number = ds.bien_so
  AND v.status = 'active'
  AND (ds.driver_id IS NULL OR ds.vehicle_id IS NULL);
