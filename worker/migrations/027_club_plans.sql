-- план клубу команди (наступний клуб + архів проведених) і кошик ідей
CREATE TABLE IF NOT EXISTS club_plans (
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL, date TEXT, topic TEXT, sermon TEXT, preacher TEXT, scripture TEXT, program TEXT, roles TEXT, note TEXT,
  status TEXT DEFAULT 'plan', report TEXT, report_id TEXT, created TEXT, updated TEXT, author_id TEXT, done_at TEXT, done_by TEXT
);
CREATE INDEX IF NOT EXISTS club_plans_team ON club_plans (team_id, status);
CREATE TABLE IF NOT EXISTS club_ideas (
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL, cat TEXT, text TEXT, descr TEXT, author_id TEXT, author TEXT, created TEXT
);
CREATE INDEX IF NOT EXISTS club_ideas_team ON club_ideas (team_id);
