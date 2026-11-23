-- per-type email preferences and the summary email
ALTER TABLE users ADD COLUMN email_budget_alerts BIT(1) NULL;
ALTER TABLE users ADD COLUMN email_payment_updates BIT(1) NULL;
ALTER TABLE users ADD COLUMN summary_frequency VARCHAR(16) NULL;   -- NULL / OFF / WEEKLY / MONTHLY (off by default)
ALTER TABLE users ADD COLUMN summary_last_period DATE NULL;        -- end date of the last period a summary was sent for

-- keep today's behaviour: until now one switch (email_reminders) covered payment and budget emails too,
-- so anyone who turned it off keeps getting none of them
UPDATE users SET
  email_budget_alerts = COALESCE(email_reminders, b'1'),
  email_payment_updates = COALESCE(email_reminders, b'1');
