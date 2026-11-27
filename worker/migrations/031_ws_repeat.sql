-- 031: повторювальні задачі
ALTER TABLE ws_cards ADD COLUMN rep TEXT;
ALTER TABLE ws_cards ADD COLUMN rep_n INTEGER DEFAULT 0;
ALTER TABLE ws_cards ADD COLUMN rep_last TEXT;
