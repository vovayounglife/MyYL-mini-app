-- 029: робочий простір команди (дошка задач, сторінки, стратегія, профілі й аналітика)
CREATE TABLE IF NOT EXISTS ws (id TEXT PRIMARY KEY, name TEXT, region TEXT, created TEXT);
CREATE TABLE IF NOT EXISTS ws_members (ws TEXT NOT NULL, tg_id TEXT NOT NULL, role TEXT, pkey TEXT, area TEXT, added TEXT, PRIMARY KEY (ws, tg_id));
CREATE INDEX IF NOT EXISTS ws_members_tg ON ws_members (tg_id);
CREATE TABLE IF NOT EXISTS ws_boards (id TEXT PRIMARY KEY, ws TEXT NOT NULL, title TEXT, pos REAL, created TEXT);
CREATE TABLE IF NOT EXISTS ws_cols (id TEXT PRIMARY KEY, ws TEXT NOT NULL, board_id TEXT NOT NULL, title TEXT, kind TEXT, pos REAL);
CREATE TABLE IF NOT EXISTS ws_cards (
  id TEXT PRIMARY KEY, ws TEXT NOT NULL, board_id TEXT, col_id TEXT, pos REAL, title TEXT, descr TEXT, due TEXT, assignees TEXT, circle TEXT, item_id TEXT,
  links TEXT, checklist TEXT, done INTEGER DEFAULT 0, archived INTEGER DEFAULT 0, author_id TEXT, author TEXT, created TEXT, updated TEXT, updated_by TEXT, reminded TEXT
);
CREATE INDEX IF NOT EXISTS ws_cards_ws ON ws_cards (ws, archived);
CREATE TABLE IF NOT EXISTS ws_comments (id TEXT PRIMARY KEY, ws TEXT, card_id TEXT NOT NULL, tg_id TEXT, name TEXT, text TEXT, created TEXT);
CREATE INDEX IF NOT EXISTS ws_comments_card ON ws_comments (card_id);
CREATE TABLE IF NOT EXISTS ws_pages (id TEXT PRIMARY KEY, ws TEXT NOT NULL, parent_id TEXT, title TEXT, icon TEXT, body TEXT, pos REAL, author_id TEXT, created TEXT, updated TEXT, updated_by TEXT);
CREATE INDEX IF NOT EXISTS ws_pages_ws ON ws_pages (ws);
CREATE TABLE IF NOT EXISTS ws_items (id TEXT PRIMARY KEY, ws TEXT NOT NULL, circle TEXT, kind TEXT, title TEXT, descr TEXT, status TEXT, owner TEXT, due TEXT, url TEXT, pos REAL, created TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS ws_kv (ws TEXT NOT NULL, k TEXT NOT NULL, v TEXT, updated TEXT, PRIMARY KEY (ws, k));
CREATE TABLE IF NOT EXISTS ws_log (ws TEXT, ts TEXT, tg_id TEXT, name TEXT, text TEXT, card_id TEXT);
CREATE INDEX IF NOT EXISTS ws_log_ws ON ws_log (ws, ts);
INSERT OR IGNORE INTO ws (id, name, region, created) VALUES ('west', 'Young Life West Side', 'West', '2026-11-27T12:00:00.000Z');
