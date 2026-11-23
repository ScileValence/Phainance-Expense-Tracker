-- standing monthly limit per category (one row per user and category)
CREATE TABLE category_budgets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  limit_amount DOUBLE NOT NULL,
  CONSTRAINT fk_catbudget_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_catbudget_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
  CONSTRAINT ux_catbudget_user_category UNIQUE (user_id, category_id)
);
