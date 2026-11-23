#!/usr/bin/env bash
# Applies the Flyway migrations to a throw-away database and checks the data they leave behind.
#
#   DB_CMD="mysql -uroot -proot" database/tests/test-migrations.sh
#
# DB_CMD is the client command including credentials (default: mysql). It creates and drops the database
# phainance_migration_test. SKIP_V2=1 / SKIP_V4=1 skip a migration, which is how you watch the matching checks fail.
set -uo pipefail

DB_CMD=${DB_CMD:-mysql}
HERE=$(cd "$(dirname "$0")" && pwd)
MIG="$HERE/../../backend/src/main/resources/db/migration"
DB=phainance_migration_test
fails=0

q() { $DB_CMD -N -B "$DB" -e "$1"; }
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "ok   - $1"; else echo "FAIL - $1 (expected $2, got $3)"; fails=$((fails + 1)); fi
}

$DB_CMD -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB;" || { echo "cannot create the test database"; exit 2; }
trap '$DB_CMD -e "DROP DATABASE IF EXISTS $DB;" >/dev/null 2>&1' EXIT

$DB_CMD "$DB" < "$MIG/V1__baseline.sql" || exit 2

# fixture: an older database where the same category exists several times and is in use
q "INSERT INTO users(username,email,password) VALUES ('a','a@x','p');
   INSERT INTO categories(name) VALUES ('Food'),('Rent'),('Food'),('food '),('Food');
   INSERT INTO expenses(amount,date,category_id,user_id) VALUES (1,'2026-01-01',3,1),(2,'2026-01-02',4,1),(3,'2026-01-03',5,1),(4,'2026-01-04',2,1);
   INSERT INTO recurring_payments(title,amount,category_id,user_id,active) VALUES ('r',5,3,1,1);
   INSERT INTO users(username,email,password,email_reminders) VALUES ('mute','m@x','p',0),('loud','l@x','p',1);"
check "fixture starts with 4 Food rows" 4 "$(q "SELECT COUNT(*) FROM categories WHERE LOWER(TRIM(name))='food'")"

[ "${SKIP_V2:-0}" = "1" ] || $DB_CMD "$DB" < "$MIG/V2__categories_per_user.sql" >/dev/null || exit 2
$DB_CMD "$DB" < "$MIG/V3__category_budgets.sql" || exit 2
[ "${SKIP_V4:-0}" = "1" ] || $DB_CMD "$DB" < "$MIG/V4__email_preferences.sql" || exit 2

check "one Food row remains" 1 "$(q "SELECT COUNT(*) FROM categories WHERE LOWER(TRIM(name))='food'")"
check "Rent is untouched" 1 "$(q "SELECT COUNT(*) FROM categories WHERE name='Rent'")"
check "the 3 Food expenses all point at the kept row" 3 "$(q "SELECT COUNT(*) FROM expenses e JOIN categories c ON e.category_id=c.id WHERE c.name='Food'")"
check "no expense points at a deleted category" 0 "$(q "SELECT COUNT(*) FROM expenses WHERE category_id NOT IN (SELECT id FROM categories)")"
check "the recurring payment points at the kept Food row" 1 "$(q "SELECT COUNT(*) FROM recurring_payments r JOIN categories c ON r.category_id=c.id WHERE c.name='Food'")"
check "categories has a user_id column" 1 "$(q "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='categories' AND column_name='user_id'")"
check "built-in categories have no owner" 0 "$(q "SELECT COUNT(*) FROM categories WHERE user_id IS NOT NULL" 2>/dev/null || echo missing)"

# per-user names and limits
q "INSERT INTO users(username,email,password) VALUES ('b','b@x','p');" 2>/dev/null
q "INSERT INTO categories(name,user_id) VALUES ('Gym',1),('Gym',2);" 2>/dev/null
check "two users can both have a Gym category" 2 "$(q "SELECT COUNT(*) FROM categories WHERE name='Gym'" 2>/dev/null || echo 0)"
q "INSERT INTO categories(name,user_id) VALUES ('Gym',1);" >/dev/null 2>&1
check "the same user cannot have Gym twice" 2 "$(q "SELECT COUNT(*) FROM categories WHERE name='Gym'" 2>/dev/null || echo 0)"

GYM=$(q "SELECT id FROM categories WHERE name='Gym' AND user_id=1" 2>/dev/null)
q "INSERT INTO category_budgets(user_id,category_id,limit_amount) VALUES (1,$GYM,500);"
q "INSERT INTO category_budgets(user_id,category_id,limit_amount) VALUES (1,$GYM,900);" >/dev/null 2>&1
check "one limit per user and category" 1 "$(q "SELECT COUNT(*) FROM category_budgets WHERE user_id=1 AND category_id=$GYM")"
q "DELETE FROM categories WHERE id=$GYM;"
check "deleting a category removes its limit" 0 "$(q "SELECT COUNT(*) FROM category_budgets")"

# email preferences keep today's behaviour
flags() { q "SELECT CONCAT(email_budget_alerts+0, email_payment_updates+0) FROM users WHERE username='$1'" 2>/dev/null || echo missing; }
check "a user with no reminder setting keeps getting budget and payment emails" 11 "$(flags a)"
check "a user who turned reminders off gets no budget or payment emails" 00 "$(flags mute)"
check "a user who had reminders on keeps them" 11 "$(flags loud)"
check "nobody gets a summary by default" 0 "$(q "SELECT COUNT(*) FROM users WHERE summary_frequency IS NOT NULL OR summary_last_period IS NOT NULL" 2>/dev/null || echo missing)"

if [ "$fails" -eq 0 ]; then echo "all migration checks passed"; else echo "$fails migration check(s) failed"; exit 1; fi
