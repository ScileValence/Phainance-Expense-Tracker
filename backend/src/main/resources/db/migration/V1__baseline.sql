-- Baseline schema (what Hibernate generated up to v1.7). Existing databases are baselined at version 1
-- and skip this file; fresh databases get it.

CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  email_reminders BIT(1) NULL,
  email_verified BIT(1) NULL,
  verification_token_hash VARCHAR(255) NULL,
  verification_expires_at DATETIME(6) NULL,
  verification_sent_at DATETIME(6) NULL,
  CONSTRAINT uk_users_username UNIQUE (username),
  CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE TABLE categories (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NULL
);

CREATE TABLE expenses (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  amount DOUBLE NULL,
  description VARCHAR(255) NULL,
  date DATE NULL,
  category_id BIGINT NULL,
  user_id BIGINT NULL,
  CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_expenses_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE budgets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  month VARCHAR(255) NULL,
  limit_amount DOUBLE NULL,
  user_id BIGINT NULL,
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE incomes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  amount DOUBLE NULL,
  source VARCHAR(255) NULL,
  description VARCHAR(255) NULL,
  date DATE NULL,
  user_id BIGINT NULL,
  CONSTRAINT fk_incomes_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE recurring_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NULL,
  amount DOUBLE NULL,
  category_id BIGINT NULL,
  interval_value INT NULL,
  interval_unit VARCHAR(255) NULL,
  next_due_date DATE NULL,
  due_time TIME(6) NULL,
  anchor_day INT NULL,
  time_zone VARCHAR(255) NULL,
  notified_for DATETIME(6) NULL,
  active BIT(1) NOT NULL DEFAULT b'1',
  user_id BIGINT NULL,
  CONSTRAINT fk_recurring_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_recurring_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE push_subscriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  endpoint VARCHAR(1000) NOT NULL,
  p256dh VARCHAR(255) NULL,
  auth VARCHAR(255) NULL,
  created_at DATETIME(6) NULL,
  user_id BIGINT NULL,
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users (id)
);
