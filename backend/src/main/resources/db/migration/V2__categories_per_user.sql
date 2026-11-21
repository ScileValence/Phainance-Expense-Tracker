-- 1) merge duplicate categories: keep the lowest id per name, repoint what uses the extras, delete the extras
UPDATE expenses t
JOIN categories c ON t.category_id = c.id
JOIN (SELECT MIN(id) AS keep_id, LOWER(TRIM(name)) AS n FROM categories GROUP BY LOWER(TRIM(name))) k
  ON k.n = LOWER(TRIM(c.name))
SET t.category_id = k.keep_id
WHERE t.category_id <> k.keep_id;

-- recurring_payments does not exist on databases older than v1.5, so guard it
SET @has_rec := (SELECT COUNT(*) FROM information_schema.tables
                 WHERE table_schema = DATABASE() AND table_name = 'recurring_payments');
SET @ddl := IF(@has_rec > 0,
  'UPDATE recurring_payments t JOIN categories c ON t.category_id = c.id JOIN (SELECT MIN(id) AS keep_id, LOWER(TRIM(name)) AS n FROM categories GROUP BY LOWER(TRIM(name))) k ON k.n = LOWER(TRIM(c.name)) SET t.category_id = k.keep_id WHERE t.category_id <> k.keep_id',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DELETE c FROM categories c
JOIN (SELECT MIN(id) AS keep_id, LOWER(TRIM(name)) AS n FROM categories GROUP BY LOWER(TRIM(name))) k
  ON k.n = LOWER(TRIM(c.name))
WHERE c.id <> k.keep_id;

-- 2) older databases (database/schema.sql) have a global unique index on name; it would block two users
--    from having the same custom category, so drop it if present
SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = 'categories' AND index_name = 'ux_categories_name');
SET @ddl := IF(@idx > 0, 'ALTER TABLE categories DROP INDEX ux_categories_name', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) user_id NULL = built-in category shared by everyone; otherwise it belongs to that user
ALTER TABLE categories ADD COLUMN user_id BIGINT NULL;
ALTER TABLE categories ADD CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE categories ADD CONSTRAINT ux_categories_user_name UNIQUE (user_id, name);
