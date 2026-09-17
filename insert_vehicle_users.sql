-- ============================================================
-- SQL Script: Thêm tài khoản người dùng từ 5 số cuối biển số xe
-- Hệ thống: PhuPhatCorp
-- Role: TAI_XE
-- Username / Password / Email: 5 số cuối biển số xe
-- ============================================================

INSERT INTO users (email, username, password_hash, full_name, role, role_id, is_active)
VALUES
  ('88294', '88294', '$2a$10$7ghUzbCq7/UNepvmbrkCNeLUZgb1TOkSPRvm8HmNcG0UsYNY8d622', 'Xe 50H-88294', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('69501', '69501', '$2a$10$tBZHTL3vYYTftlzFZqzrPeUtnqyICSFKPhQ/ESfZuB8IvXS2V.sn.', 'Xe 50H-69501', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('55116', '55116', '$2a$10$wTjh1HBH8K4ykWru1dJreeKJuproilPmXSMGFE7TpaH7HtlYAWMXu', 'Xe 50H-55116', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('50999', '50999', '$2a$10$MbrtPCjKrR0sYaoxtnj53OnQdK3krEpuHb6OWkZMt5qRi8PMw.5T2', 'Xe 50H-50999', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('64316', '64316', '$2a$10$wJnWI/pIPP/NELq7OOrBtuPMbGSUKSjmgChQnGLr1MvN76rmIZhvq', 'Xe 50H-64316', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('54580', '54580', '$2a$10$80DuiqfrMUjQ1Pp6VO9Z1u3vQNlFVO6NZx9qmKVu.iRjS5okEJ.w6', 'Xe 50H-54580', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('66445', '66445', '$2a$10$Ro8nUVi5GN0QLiCok7/OUu73EsDaN0oJFU7g73B94eBRTTChD2Dk6', 'Xe 50H-66445', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('63174', '63174', '$2a$10$QtswEIbXUYZAPPhLiJdKveJs96wm7D./WrVVdVlAVM0a6O456OIxu', 'Xe 50H-63174', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('55443', '55443', '$2a$10$BvAojn9o2.tq59e/xYpJ1.BOcYp9cRRPLngh6THXjYbNyt9pVd.bq', 'Xe 50H-55443', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('70216', '70216', '$2a$10$lesqbXoGNyGE4YFGg5ggrePkUVeSm.lfuqB8/g52R7Q7hcRVbxowq', 'Xe 50H-70216', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('74619', '74619', '$2a$10$eFeD9UOi.2YVroIoPxJhi.ExGxdspGp7i7WYxTfmSAmOHgry2jXb6', 'Xe 50H-74619', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('87442', '87442', '$2a$10$9P25bQFM1pPjdh/bS/DYO.8/w7ecZQGOW2N.71ue/ogrcl2kYNsG.', 'Xe 50H-87442', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('55161', '55161', '$2a$10$OMataCsyLC10uYXo5ankh.pzse2HJgq2vf0G6CsS0cfUmckC7.8au', 'Xe 50H-55161', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('64470', '64470', '$2a$10$g0L9yIrNysRwtjQAo3mzxOG0xk5w3bz4CZl5GjCOhKOlB.jpQGX4W', 'Xe 50H-64470', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('16461', '16461', '$2a$10$H.KvscvskYn9oLCRP6LIY.Vsst29z1Cg87TpmGnCYjWj0qLr.p5Qe', 'Xe 50E-164.61', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('08817', '08817', '$2a$10$mwuafm25JarAKLPCn6trres78j6Bi6EBKFXdROIyCePYkmpuaIBne', 'Xe 50F 08817', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('38021', '38021', '$2a$10$BOUY/bHyhi6rxfVLSJgP9OZiOHTHZ/Lyv1OdzZ3YCfhuIJbEzJDhu', 'Xe 51D 38021', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('93403', '93403', '$2a$10$18zjIj4CKl5pP/bVxQQDGe.t.iSPKFDS6Ba8igQpufk9TE.RjdurG', 'Xe 50E 93403', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('92136', '92136', '$2a$10$y48hui/jNPjBU2m3KbVpOusds/qGgWslekrMHIGh.9//dJszqLkOa', 'Xe 50H-92136', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('55829', '55829', '$2a$10$tBH0EgBqThrC/2SA0LqqbOUpcnuYj/VkcpPhFxgP7CS3tjNsoTuFS', 'Xe 51D-55829', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('81056', '81056', '$2a$10$TmBNfhPgbsUoG4jao0ZK0uuEXBEJ.4iA4aTI2eaQ6Pk.C62GOe0Oi', 'Xe 51C-81056', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('01887', '01887', '$2a$10$yG3kGSXG/lEWQnm2NDixKOW9AwBfvaGUhGgmG8QmiT1zaAl72uDKS', 'Xe 62H 01887', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('60635', '60635', '$2a$10$xsrHrS.7LEfw4mNSswMkQOTj5WUpLihum4WcJP649CyCXRyq4PVBe', 'Xe 50H-60635', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('86564', '86564', '$2a$10$ZihSK4V4rb0rBXTDXtTK/uXzPN6e/NNhZPufaskmpItcHoPZF5I76', 'Xe 50H 86564', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('44328', '44328', '$2a$10$Po/vAX.sBkD2hHjimXRRzOY76UhywAjVuA7nqjcly2gef62Qs9SO.', 'Xe 50H-44328', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('56521', '56521', '$2a$10$OtACjD6GHVe0KgU.4LOt7eq4WGstxzJkLbJrhyWnitv00hcwbEFAG', 'Xe 50E-565,21', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('44024', '44024', '$2a$10$sZTY.GZe1d/MAZOZVWmDq.YPRd53w.KQ9xWiICl3vdSdYWGLFXPjO', 'Xe 50H-44024', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('64873', '64873', '$2a$10$IjklOuqa4V7epSzhcKMZROp20EdTQfgMgt09X1FXUIaxtU57Mn3sO', 'Xe 50E-648.73', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('65434', '65434', '$2a$10$ojitFs0CK4dWmIVxKlD4yuYy/QOHaou5SoxzsvM/lZewJjm3nzLn6', 'Xe 50E-654.34', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('32401', '32401', '$2a$10$lCtFnWByy9g3UHrVDXw7IeNyvzxRSnRubPBi7L/6e8Pj87fabncsO', 'Xe 50E-324,01', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('87055', '87055', '$2a$10$7vq2448Aa7PaiA3K9BuSNO1JSr0J2gyYzwZ1mDPZ2RG77.1ItpkNS', 'Xe 50H-87055', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('75774', '75774', '$2a$10$zIsm99EInDjQNW7XpJv/oOj4cD9sstetAdE.VzjA/QV6/A8pdlJaa', 'Xe 50E-757,74', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('75206', '75206', '$2a$10$gVdUiIuSFMwrt0uSKSldD.SryStJmj0XCj8aWA51vshT6n3ghcZQq', 'Xe 50H-75206', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('66347', '66347', '$2a$10$muLw8kctiXz8aDyUiGSn7eYle96fMhZ6MShgWzgMgRUG1YSppwUwu', 'Xe 50H-66347', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('55294', '55294', '$2a$10$n9XEebloHH3Y/zg8jOa6BOs9UyBKPpN27z9iOhUE0yaxPRCyQhzPO', 'Xe 50H-55294', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('55129', '55129', '$2a$10$C6WJTFyO7CDNurnTZsZNhO541cTQuyAbkh8D7rSCGvBJA/jyVauPC', 'Xe 50H-55129', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('69717', '69717', '$2a$10$60RpiZYAvB3tvCWCzYg5Le9gwDcCwxqFG9mY3h3ixz28CSIs.mc4C', 'Xe 50H-69717', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE),
  ('75873', '75873', '$2a$10$Uck5pG32YYkLxfOpuZ2dyOMRnyQApx5adj6ZbC.7qHj2o2vgMcp66', 'Xe 50E-758,73', 'TAI_XE', (SELECT id FROM roles WHERE code = 'TAI_XE' LIMIT 1), TRUE)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  role_id = EXCLUDED.role_id,
  is_active = TRUE,
  updated_at = NOW();
