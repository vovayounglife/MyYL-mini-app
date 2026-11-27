-- 036: регіон «Європа» (ерії й команди додаються згодом у застосунку)
INSERT INTO regions (id, name) SELECT 'r_eu', 'Європа' WHERE NOT EXISTS (SELECT 1 FROM regions WHERE name = 'Європа');
UPDATE meta SET v = v + 1 WHERE k = 'ver' AND changes() > 0;
