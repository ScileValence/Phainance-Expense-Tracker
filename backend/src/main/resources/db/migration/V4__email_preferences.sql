-- Per-type email preferences and the summary email.
--
-- MySQL cannot roll back ALTER TABLE, so this file is written to be safe to run again after a partial run:
-- each column is only added if it is missing, and the copy step only fills columns that are still empty.
-- It also works whatever type users.email_reminders has (BIT(1) or TINYINT(1)).

SET @c := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'email_budget_alerts');
SET @ddl := IF(@c = 0, 'ALTER TABLE users ADD COLUMN email_budget_alerts BIT(1) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'email_payment_updates');
SET @ddl := IF(@c = 0, 'ALTER TABLE users ADD COLUMN email_payment_updates BIT(1) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'summary_frequency');
SET @ddl := IF(@c = 0, 'ALTER TABLE users ADD COLUMN summary_frequency VARCHAR(16) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'summary_last_period');
SET @ddl := IF(@c = 0, 'ALTER TABLE users ADD COLUMN summary_last_period DATE NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- summary_frequency: NULL or OFF, WEEKLY, MONTHLY (off by default).
-- summary_last_period: end date of the last period a summary was sent for.

-- Keep the current behaviour. Until now one switch (email_reminders) also covered payment and budget emails,
-- so anyone who turned it off keeps getting none of them. Compared as a number so it works for BIT and TINYINT.
UPDATE users
SET email_budget_alerts = CASE WHEN email_reminders IS NULL OR email_reminders <> 0 THEN 1 ELSE 0 END
WHERE email_budget_alerts IS NULL;

UPDATE users
SET email_payment_updates = CASE WHEN email_reminders IS NULL OR email_reminders <> 0 THEN 1 ELSE 0 END
WHERE email_payment_updates IS NULL;
