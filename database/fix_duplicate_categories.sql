-- Merge duplicate categories (MySQL). Keeps the lowest id per name, repoints expenses and
-- recurring payments to it, deletes the extras, then adds a unique index so it cannot happen again.
-- The backend also runs this merge automatically on startup.
USE expense_tracker;
SET SQL_SAFE_UPDATES = 0;

UPDATE expenses t
JOIN categories c ON t.category_id = c.id
JOIN (SELECT MIN(id) AS keep_id, LOWER(TRIM(name)) AS n FROM categories GROUP BY LOWER(TRIM(name))) k
  ON k.n = LOWER(TRIM(c.name))
SET t.category_id = k.keep_id
WHERE t.category_id <> k.keep_id;

UPDATE recurring_payments t
JOIN categories c ON t.category_id = c.id
JOIN (SELECT MIN(id) AS keep_id, LOWER(TRIM(name)) AS n FROM categories GROUP BY LOWER(TRIM(name))) k
  ON k.n = LOWER(TRIM(c.name))
SET t.category_id = k.keep_id
WHERE t.category_id <> k.keep_id;

DELETE c FROM categories c
JOIN (SELECT MIN(id) AS keep_id, LOWER(TRIM(name)) AS n FROM categories GROUP BY LOWER(TRIM(name))) k
  ON k.n = LOWER(TRIM(c.name))
WHERE c.id <> k.keep_id;

-- run once; errors with "Duplicate key name" if it already exists, which is fine
ALTER TABLE categories ADD CONSTRAINT ux_categories_name UNIQUE (name);

SELECT * FROM categories;
