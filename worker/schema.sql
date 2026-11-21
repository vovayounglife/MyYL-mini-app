-- Young Life Україна · Mini App · схема бази D1 (можна запускати повторно)
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO meta (k, v) VALUES ('ver', 1);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
INSERT OR IGNORE INTO settings (key, value) VALUES ('REMINDER_DAY', 'SUNDAY'), ('REMINDER_HOUR', '18'), ('EVENT_REMIND_DAYS', '3,1');

CREATE TABLE IF NOT EXISTS regions (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS areas (id TEXT PRIMARY KEY, region_id TEXT NOT NULL, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, area_id TEXT NOT NULL, name TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'active', known INTEGER NOT NULL DEFAULT 0, dir TEXT);

CREATE TABLE IF NOT EXISTS people (
  tg_id TEXT PRIMARY KEY, username TEXT, name TEXT, phone TEXT, email TEXT, bday TEXT, repent TEXT, baptism TEXT,
  lpyl TEXT, resp TEXT, title TEXT, registered TEXT, notif TEXT, main TEXT, ig TEXT, family TEXT
);
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY, tg_id TEXT NOT NULL, name TEXT, role_key TEXT NOT NULL, level TEXT NOT NULL, unit_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL, decided_by TEXT, requested TEXT, decided TEXT, title TEXT
);
CREATE INDEX IF NOT EXISTS roles_tg ON roles (tg_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, level TEXT NOT NULL, unit_id TEXT NOT NULL DEFAULT '', title TEXT, date TEXT NOT NULL, end_date TEXT, time TEXT, place TEXT,
  descr TEXT, author_id TEXT, author TEXT, created TEXT, roles TEXT, aud TEXT, rep TEXT, rep_until TEXT, rep_skip TEXT
);
CREATE INDEX IF NOT EXISTS events_date ON events (date);
CREATE TABLE IF NOT EXISTS rsvp (event_id TEXT NOT NULL, tg_id TEXT NOT NULL, name TEXT, team TEXT, created TEXT, PRIMARY KEY (event_id, tg_id));

-- усі звіти (клуби, малі групи, КР) з деталями; seq — для копіювання на Google Диск
CREATE TABLE IF NOT EXISTS reports (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE, created TEXT, date TEXT, week TEXT, type TEXT, mode TEXT,
  team_id TEXT, area_id TEXT, region_id TEXT, count REAL DEFAULT 0, new_t REAL DEFAULT 0, leaders REAL DEFAULT 0, hours REAL DEFAULT 0,
  topic TEXT, note TEXT, attendees TEXT, author_id TEXT, author TEXT, pid TEXT
);
CREATE INDEX IF NOT EXISTS reports_week ON reports (week);

CREATE TABLE IF NOT EXISTS known (
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL, name TEXT, phone TEXT, ig TEXT, bday TEXT, school TEXT, grade TEXT, leader TEXT, note TEXT,
  added TEXT, active INTEGER NOT NULL DEFAULT 1, updated TEXT, stage TEXT, author_id TEXT
);
CREATE INDEX IF NOT EXISTS known_team ON known (team_id);
CREATE INDEX IF NOT EXISTS known_updated ON known (updated);

CREATE TABLE IF NOT EXISTS finance (
  team_id TEXT NOT NULL, month TEXT NOT NULL, prev REAL, office REAL, church REAL, team REAL, spent REAL, balance REAL,
  author TEXT, updated TEXT, PRIMARY KEY (team_id, month)
);
CREATE INDEX IF NOT EXISTS finance_updated ON finance (updated);

-- черга повідомлень у Telegram (великі розсилки йдуть частинами щохвилини)
CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT NOT NULL, text TEXT, extra TEXT, created TEXT, claimed INTEGER);
CREATE TABLE IF NOT EXISTS broadcasts (id TEXT PRIMARY KEY, text TEXT, audience TEXT, count INTEGER, author TEXT, created TEXT, author_id TEXT);

-- вхід в окремий застосунок через бота
CREATE TABLE IF NOT EXISTS auth_login (nonce TEXT PRIMARY KEY, created INTEGER NOT NULL, user_json TEXT, used INTEGER NOT NULL DEFAULT 0);

-- задачі й опитування
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT, descr TEXT, due TEXT, units TEXT, roles TEXT, audience TEXT, author_id TEXT, author TEXT, author_rank INTEGER, created TEXT, closed TEXT);
CREATE TABLE IF NOT EXISTS task_people (task_id TEXT NOT NULL, tg_id TEXT NOT NULL, name TEXT, status TEXT, note TEXT, updated TEXT, PRIMARY KEY (task_id, tg_id));
CREATE INDEX IF NOT EXISTS task_people_tg ON task_people (tg_id);
CREATE TABLE IF NOT EXISTS polls (id TEXT PRIMARY KEY, question TEXT, options TEXT, multi INTEGER, open_results INTEGER, units TEXT, roles TEXT, audience TEXT, people TEXT, author_id TEXT, author TEXT, author_rank INTEGER, created TEXT, closed TEXT);
CREATE TABLE IF NOT EXISTS poll_votes (poll_id TEXT NOT NULL, tg_id TEXT NOT NULL, opt INTEGER NOT NULL, name TEXT, created TEXT, PRIMARY KEY (poll_id, tg_id, opt));

-- дозволи й доступ
CREATE TABLE IF NOT EXISTS perms (unit TEXT NOT NULL, role_key TEXT NOT NULL, perm TEXT NOT NULL, val INTEGER NOT NULL, by_name TEXT, updated TEXT, PRIMARY KEY (unit, role_key, perm));

-- каса команди
CREATE TABLE IF NOT EXISTS fin_tx (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, date TEXT NOT NULL, kind TEXT NOT NULL, src TEXT, amount REAL NOT NULL, note TEXT, author_id TEXT, author TEXT, created TEXT);
CREATE INDEX IF NOT EXISTS fin_tx_team ON fin_tx (team_id, date);

-- корисні ресурси
CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, title TEXT, url TEXT, file_id TEXT, file_name TEXT, fkey TEXT, note TEXT, aud TEXT, status TEXT, author_id TEXT, author TEXT, created TEXT, decided_by TEXT, decided TEXT);
CREATE INDEX IF NOT EXISTS resources_created ON resources (created);
INSERT OR IGNORE INTO resources (id, title, url, file_id, file_name, fkey, note, aud, status, author_id, author, created, decided_by, decided)
VALUES ('res0budni', 'Подкаст «Будні лідера»', 'https://youtube.com/playlist?list=PLGGHZ9uQYlQ22KKPNudLa9BWr7_jVwPjs&si=xofEqmFRe7jKhu_b', '', '', '', 'Плейлист на YouTube', 'all', 'активний', '', 'Раб Божий', '2026-11-19T16:10:00.000Z', 'Раб Божий', '2026-11-19T16:10:00.000Z');


-- 022: збої на телефонах (для діагностики)
CREATE TABLE IF NOT EXISTS client_log (ts TEXT, data TEXT);
