CREATE TABLE IF NOT EXISTS fin_tx (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, date TEXT NOT NULL, kind TEXT NOT NULL, src TEXT, amount REAL NOT NULL, note TEXT, author_id TEXT, author TEXT, created TEXT);
CREATE INDEX IF NOT EXISTS fin_tx_team ON fin_tx (team_id, date);
