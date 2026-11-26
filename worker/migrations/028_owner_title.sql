-- назва службової ролі власника ніде не показується: замінюємо її в уже збережених даних на імʼя власника
UPDATE resources SET author = COALESCE((SELECT p.name FROM people p JOIN roles r ON r.tg_id = p.tg_id WHERE r.role_key = 'SUPER' AND r.status = 'активна' LIMIT 1), 'Young Life Україна') WHERE author IN ('Раб Божий', 'власник');
UPDATE resources SET decided_by = COALESCE((SELECT p.name FROM people p JOIN roles r ON r.tg_id = p.tg_id WHERE r.role_key = 'SUPER' AND r.status = 'активна' LIMIT 1), '') WHERE decided_by IN ('Раб Божий', 'власник');
UPDATE roles SET decided_by = '' WHERE decided_by IN ('Раб Божий', 'власник');
UPDATE broadcasts SET author = COALESCE((SELECT p.name FROM people p JOIN roles r ON r.tg_id = p.tg_id WHERE r.role_key = 'SUPER' AND r.status = 'активна' LIMIT 1), author) WHERE author = 'Раб Божий';
