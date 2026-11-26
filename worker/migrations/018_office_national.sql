-- «Office» — це національний офіс, а не регіон
UPDATE roles SET level = 'nat', unit_id = '' WHERE role_key = 'OFFICE' AND level != 'nat';
-- одноразово: прибрати роль Національного Адміна у власника (на його прохання)
UPDATE roles SET status = 'знята', decided_by = 'власник', decided = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE role_key = 'NATIONAL_ADMIN' AND status IN ('активна', 'очікує') AND tg_id IN (SELECT tg_id FROM roles WHERE role_key = 'SUPER' AND status = 'активна') AND NOT EXISTS (SELECT 1 FROM meta WHERE k = 'm018');
-- порожній «регіон» Office більше не потрібен
DELETE FROM regions WHERE lower(name) = 'office' AND id NOT IN (SELECT region_id FROM areas) AND NOT EXISTS (SELECT 1 FROM meta WHERE k = 'm018');
INSERT OR IGNORE INTO meta (k, v) VALUES ('m018', 1);
UPDATE meta SET v = v + 1 WHERE k = 'ver';
