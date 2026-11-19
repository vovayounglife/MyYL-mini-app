CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT, descr TEXT, due TEXT, units TEXT, roles TEXT, audience TEXT, author_id TEXT, author TEXT, author_rank INTEGER, created TEXT, closed TEXT);
CREATE TABLE IF NOT EXISTS task_people (task_id TEXT NOT NULL, tg_id TEXT NOT NULL, name TEXT, status TEXT, note TEXT, updated TEXT, PRIMARY KEY (task_id, tg_id));
CREATE INDEX IF NOT EXISTS task_people_tg ON task_people (tg_id);
CREATE TABLE IF NOT EXISTS polls (id TEXT PRIMARY KEY, question TEXT, options TEXT, multi INTEGER, open_results INTEGER, units TEXT, roles TEXT, audience TEXT, people TEXT, author_id TEXT, author TEXT, author_rank INTEGER, created TEXT, closed TEXT);
CREATE TABLE IF NOT EXISTS poll_votes (poll_id TEXT NOT NULL, tg_id TEXT NOT NULL, opt INTEGER NOT NULL, name TEXT, created TEXT, PRIMARY KEY (poll_id, tg_id, opt));
