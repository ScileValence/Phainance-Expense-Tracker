# Phainance

![Version](https://img.shields.io/badge/version-1.7.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DBFB.svg)
![Backend](https://img.shields.io/badge/backend-Spring%20Boot%203-6DB33F.svg)
![Database](https://img.shields.io/badge/database-MySQL-4479A1.svg)

Phainance is a full-stack personal finance web app for tracking expenses, income and budgets, with recurring-payment reminders delivered by email and web push. The frontend is React (Vite), the backend is Spring Boot, data lives in MySQL, and sessions are secured with JWT.

Version 1.7.0 is a redesign of the interface plus a set of new features: income tracking, recurring payments with reminders, multiple display currencies, email verification and a guest mode.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Reminders: email and web push](#reminders-email-and-web-push)
- [How the main features work](#how-the-main-features-work)
- [API overview](#api-overview)
- [Preparing for production](#preparing-for-production)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Changelog](#changelog)
- [Author](#author)
- [License](#license)

---

## Features

**Accounts and guest mode**
- Sign up and log in with JWT authentication; passwords are hashed with BCrypt.
- Guest mode: the app is usable without an account. Data stays in the browser only, and can be imported into an account at login or sign-up.
- Email verification with a time-limited link. Unverified users can use the app, but reminder emails are held back until the address is confirmed.

**Money tracking**
- Expenses: add, edit inline, delete and filter by month, with categories.
- Income: record income by source (Salary, Freelance, Gift, Other) and see totals per source.
- Budgets: set a monthly limit and track spending against it.
- Dashboard: remaining budget, income, spend and savings at a glance, a category breakdown and a daily spending chart.

**Recurring payments and reminders**
- Create recurring payments with a custom interval (every N days, weeks or months), a start date and a time of day.
- A reminder is sent at the due time by email and by web push, even when the app is closed.
- Reminders never create an expense on their own: you confirm with "Mark paid" (which logs the expense and moves to the next occurrence) or "Skip".

**Currencies**
- Switch the display currency at any time from the sidebar (INR, USD, EUR, GBP, JPY, AUD, CAD, SGD, AED, CNY, CHF, SAR).
- Amounts are stored in INR. The switcher converts what you see and what you type using daily exchange rates.

**Interface**
- Redesigned layout with a light and a dark theme.
- Custom select, date, time and month pickers that follow the theme.
- Responsive layout; the sidebar becomes a bottom tab bar on small screens.

---

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 18, Vite, React Router, Axios, Recharts, React Toastify, Lucide icons |
| Backend | Java 21, Spring Boot 3.2, Spring Security, Spring Data JPA, Spring Mail |
| Database | MySQL 8 |
| Auth | JWT, BCrypt |
| Notifications | SMTP (Gmail by default), Web Push with VAPID (web-push library) |
| Build tools | Maven, npm |

---

## Project structure

```
Phainance-Expense-Tracker/
  backend/
    pom.xml
    src/main/java/com/example/expensetracker/
      config/        security, JWT filter, scheduling, seed data
      controller/    REST controllers
      model/         JPA entities
      repository/    Spring Data repositories
      service/       business logic, reminders, email templates
    src/main/resources/
      application.properties
      secrets.properties.example
  frontend/
    public/sw.js     service worker for web push
    src/
      api/           Axios clients
      components/    shared components, custom pickers in components/ui
      context/       app-wide state
      pages/         Dashboard, Income, Recurring, auth pages
      styles/        design system and page styles
      utils/         currency, guest-mode store, helpers
  database/          legacy SQL (tables are now created automatically)
  CHANGELOG.md
```

---

## Getting started

### Prerequisites

- JDK 21
- Maven 3.9 or newer
- Node.js 18 or newer (the current LTS is recommended)
- MySQL 8 running locally

### 1. Clone the repository

```bash
git clone https://github.com/ScileValence/Phainance-Expense-Tracker.git
cd Phainance-Expense-Tracker
git checkout 1.7
```

### 2. Create the database

```sql
CREATE DATABASE expense_tracker;
```

Tables are created and updated by Flyway migrations (`backend/src/main/resources/db/migration`) on first start; existing databases are upgraded in place. The default credentials are `root` / `root`; override them as described under [Configuration](#configuration).

### 3. Run the backend

```bash
cd backend
mvn spring-boot:run
```

The API starts on `http://localhost:8080`. Default categories are seeded on first run.

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Without an account you start in guest mode; use Sign in to create an account.

---

## Configuration

Settings are read from `backend/src/main/resources/application.properties`, and every value can be overridden with an environment variable. For local development, put overrides in `backend/src/main/resources/secrets.properties` (copy `secrets.properties.example`). That file is gitignored and is loaded automatically when present.

| Variable | Purpose | Default |
|----------|---------|---------|
| `DB_URL` | JDBC URL | `jdbc:mysql://localhost:3306/expense_tracker` |
| `DB_USERNAME` | Database user | `root` |
| `DB_PASSWORD` | Database password | `root` |
| `JWT_SECRET` | Base64 secret used to sign tokens | development value |
| `MAIL_HOST` / `MAIL_PORT` | SMTP server | `smtp.gmail.com` / `587` |
| `MAIL_USERNAME` | SMTP username (also the From address) | empty (email disabled) |
| `MAIL_PASSWORD` | SMTP password or app password | empty |
| `VAPID_PUBLIC_KEY` | Web push public key | empty (push disabled) |
| `VAPID_PRIVATE_KEY` | Web push private key | empty |
| `VAPID_SUBJECT` | Contact for push services, `mailto:you@example.com` | `mailto:admin@example.com` |
| `APP_URL` | Public frontend URL used in email links | `http://localhost:5173` |
| `app.summary.cron` | When the summary emails go out (Spring cron, server time) | `0 0 8 * * *` (08:00 daily) |
| `DDL_AUTO` | Hibernate schema mode. `validate` checks the entities against the Flyway schema on start | `update` |

---

## Tests

```bash
cd backend && mvn test                              # unit tests: alert rules, schedules, rate limiter, emails, date ranges
cd frontend && npm test                             # unit tests: expense filters, sorting, CSV export
DB_CMD="mysql -uroot -proot" database/tests/test-migrations.sh   # applies the migrations to a throw-away database and checks the result
```

---

## Reminders: email and web push

Both channels are optional. With neither configured the app works normally, and reminders still appear inside the app while a tab is open.

### Email (Gmail SMTP)

1. Turn on 2-Step Verification for your Google account.
2. Create an app password at https://myaccount.google.com/apppasswords.
3. In `secrets.properties`, set `MAIL_USERNAME` to your Gmail address and `MAIL_PASSWORD` to the app password with the spaces removed.

For production, use a transactional provider instead of a personal Gmail account. Any SMTP provider works by changing `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME` and `MAIL_PASSWORD`; Brevo has a free plan that suits small projects.

### Web push

1. Generate a key pair: `npx web-push generate-vapid-keys`
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in `secrets.properties`.
3. Restart the backend and look for `Web push enabled` in the log.

Web push requires `localhost` or HTTPS and the user's permission in the browser.

### Turning it on in the app

Open the Recurring page, find the Reminder alerts card, enable Push on this device and use Send test. Email reminders go to the address on the account and are enabled once that address is verified.

### Choosing which emails you get

Settings, then Emails (signed-in accounts with a verified address):

- **Payment reminders:** at the due time of a recurring payment (the same switch as the Email row on the Recurring page's Reminder alerts card).
- **Budget alerts:** at 80% of a budget and when you go over it.
- **Payment updates:** when a payment is paused, resumed, skipped, paid, edited or stopped.
- **Summary email:** off by default. Weekly (Mondays, covering the Monday to Sunday before) or monthly (the 1st, covering the previous month): total spent, change since the period before, top categories, the biggest expense, the budget used (monthly) and what is due in the next 7 days. Turning it on never sends an old period, and a period is never sent twice, even after a restart or downtime. "Send me a sample" mails the latest completed period straight away (at most once a minute).

The summary is checked once a day at the time set by `app.summary.cron`.

---

## How the main features work

**Reminders.** A scheduler checks every minute. When a recurring payment reaches its due date and time (in the time zone it was created in), one email and one push per subscribed device are sent. Each occurrence is notified once. Editing the date or time allows a fresh reminder.

**Email verification.** On sign-up a link valid for 24 hours is emailed. Tokens are stored hashed. Accounts created before 1.7 are treated as verified. If SMTP is not configured, the verification link is printed in the backend log for development.

**Guest mode.** Without a token the Axios client answers requests from a small in-browser data store instead of the server, so every page works unchanged. At login or sign-up you are offered an import of that data into your account.

**Currency.** All amounts are stored in INR. Rates come from the free ExchangeRate-API endpoint (updated daily, cached for 12 hours) with Frankfurter as a fallback. If rates cannot be loaded, only INR is selectable. Reminder emails always show amounts in INR.

---

## API overview

All endpoints except `/api/auth/**` require `Authorization: Bearer <token>`.

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/verify-email` |
| Categories | `GET /api/categories`, `POST`, `PUT /{id}`, `DELETE /{id}` (default categories are read-only) |
| Expenses | `GET /api/expenses?month=YYYY-MM` or `?from=YYYY-MM-DD&to=YYYY-MM-DD`, `POST`, `PUT /{id}`, `DELETE /{id}` |
| Income | `GET /api/income?month=YYYY-MM`, `POST`, `PUT /{id}`, `DELETE /{id}` |
| Budget | `GET /api/budget?month=YYYY-MM`, `POST`, `PUT` |
| Analytics | `GET /api/analytics/category`, `/daily`, `/monthly`, `/budget-trend` |
| Recurring | `GET /api/recurring`, `POST`, `PUT /{id}`, `DELETE /{id}`, `POST /{id}/confirm`, `/skip`, `/toggle` |
| Notifications | `GET`/`PUT /api/notifications/settings`, `POST /push/subscribe`, `/push/unsubscribe`, `/resend-verification`, `/test` |

---

## Preparing for production

The project is set up for local development. Before deploying publicly:

- Set `JWT_SECRET`, `DB_USERNAME` and `DB_PASSWORD` to real values; do not rely on the defaults.
- Serve the app over HTTPS and set `APP_URL` to the public address.
- `APP_URL` is also the browser origin the API accepts, so it must be your public frontend address.
- The schema is managed by Flyway. Once it has run on your database, set `DDL_AUTO=validate` so Hibernate only checks it.
- Use a transactional email provider and a domain you control.
- Behind a reverse proxy the login limiter sees the proxy's address, which would let anyone lock out any account. Set `server.forward-headers-strategy=framework` only if your proxy overwrites `X-Forwarded-For`; if it does not, clients could fake their address, so leave it off and limit logins at the proxy instead.
- Consider moving the token from `localStorage` to an httpOnly cookie, and consider rate limiting at your proxy as well (logins are already limited to 5 failures per username and address in 15 minutes).

---

## Troubleshooting

| Problem | Likely cause |
|---------|--------------|
| `Failed to configure a DataSource` | `application.properties` or `secrets.properties` missing the database URL; run `mvn clean spring-boot:run` |
| Email switch is disabled | `MAIL_USERNAME` / `MAIL_PASSWORD` not set, or the email address is not verified yet |
| Push switch is disabled | VAPID keys not set, notifications blocked in the browser, or not on `localhost` / HTTPS |
| Currency list shows only INR | Exchange rates could not be fetched; check the network and reload |
| `npm` blocked on Windows PowerShell | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use `npm.cmd` |

---

## Roadmap

- Export reports to CSV and PDF
- Category-based budget limits
- Email alerts for overspending
- Spending insights
- Automated tests and CI

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history. Current version: 1.7.0.

---

## Author

Aashirwad Asmit Pradhan ([@ScileValence](https://github.com/ScileValence))

---

## License

Released under the MIT License. See [LICENSE](LICENSE).
