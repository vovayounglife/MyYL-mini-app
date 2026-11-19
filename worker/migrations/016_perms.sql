CREATE TABLE IF NOT EXISTS perms (unit TEXT NOT NULL, role_key TEXT NOT NULL, perm TEXT NOT NULL, val INTEGER NOT NULL, by_name TEXT, updated TEXT, PRIMARY KEY (unit, role_key, perm));
