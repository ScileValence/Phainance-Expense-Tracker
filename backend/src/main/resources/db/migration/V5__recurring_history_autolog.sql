-- Opt-in automatic logging per recurring payment (off for every existing payment), and the history of what
-- happened to each occurrence. Written to be safe to run again after a partial run (MySQL cannot roll back DDL).

SET @c := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'recurring_payments' AND column_name = 'auto_log');
SET @ddl := IF(@c = 0, 'ALTER TABLE recurring_payments ADD COLUMN auto_log BIT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- PAID (Mark as paid), SKIPPED, AUTO_PAID (logged by the app).
-- The title and amount are copied so the history still reads well after a payment is edited or deleted.
CREATE TABLE IF NOT EXISTS recurring_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  recurring_id BIGINT NULL,
  title VARCHAR(255) NOT NULL,
  amount DOUBLE NULL,
  due_date DATE NOT NULL,
  action VARCHAR(16) NOT NULL,
  happened_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_revents_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_revents_recurring FOREIGN KEY (recurring_id) REFERENCES recurring_payments (id) ON DELETE SET NULL,
  INDEX ix_revents_payment (user_id, recurring_id, happened_at)
);
