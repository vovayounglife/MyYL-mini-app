CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, title TEXT, url TEXT, file_id TEXT, file_name TEXT, fkey TEXT, note TEXT, aud TEXT, status TEXT, author_id TEXT, author TEXT, created TEXT, decided_by TEXT, decided TEXT);
CREATE INDEX IF NOT EXISTS resources_created ON resources (created);
INSERT OR IGNORE INTO resources (id, title, url, file_id, file_name, fkey, note, aud, status, author_id, author, created, decided_by, decided)
VALUES ('res0budni', 'Подкаст «Будні лідера»', 'https://youtube.com/playlist?list=PLGGHZ9uQYlQ22KKPNudLa9BWr7_jVwPjs&si=xofEqmFRe7jKhu_b', '', '', '', 'Плейлист на YouTube', 'all', 'активний', '', 'власник', '2026-11-19T16:10:00.000Z', 'власник', '2026-11-19T16:10:00.000Z');
