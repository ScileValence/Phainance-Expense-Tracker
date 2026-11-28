# Changelog  
_All notable changes to **Phainance** will be documented in this file._  

---

## Version 1.12.1 - Unreleased
**Hotfix: migration V4 on older schemas**

### Fixed
- **The backend could not start on a database where `users.email_reminders` is `TINYINT(1)`** (typical of schemas created by an older version or by `database/schema.sql`): migration V4 failed with "Data too long for column 'email_budget_alerts'", left half its columns behind (MySQL cannot roll back `ALTER TABLE`), and Flyway then refused to start with "Detected failed migration to version 4". V4 now compares the flag as a number, so it works for `BIT(1)` and `TINYINT(1)`.
- **V4 and V5 are safe to run again** after a partial run (columns are only added when missing, the copy step only fills empty columns, `CREATE TABLE IF NOT EXISTS`).
- The migration test now runs against MySQL 8.0 and covers a `TINYINT(1)` reminder column, a repeated V4 and V5, and completing a partial run.

### If you already hit the error
Stop the backend and run, in MySQL: `DELETE FROM flyway_schema_history WHERE success = 0;` (see the README troubleshooting entry), then start it again. Nothing else needs to be repaired by hand.

---

## Version 1.12.0 - Unreleased
**Recurring: automatic logging, history and a calendar**

### Added
- **Log it automatically.** A switch on each recurring payment (off by default) adds the expense by itself at the due time. Each occurrence is claimed with one atomic database update before it is logged, so it can never be logged twice, even with two server instances; missed occurrences are caught up (up to 12 per payment per run); budget alerts still fire; you get one message per run ("Rent was logged") instead of a due reminder. In guest mode the same happens when the list is loaded.
- **History.** Each payment has a History button listing every occurrence that was paid, skipped or logged automatically, kept after the payment is deleted (`GET /api/recurring/{id}/history`).
- **Upcoming bills calendar.** A List / Calendar switch on the Recurring page; a Monday-first month grid with each day's bills, the count and total due for the month, and a day list. The 31st clamps to the last day of short months.
- A shared schedule module for the calendar and guest mode, checked against the server's date rules (same fixed cases, plus 20,000 random schedules compared with zero differences).

### Fixed
- The footer of payment-update and budget emails still pointed to the old Recurring switch; it now says where each kind is switched off (Settings, Emails).

### Database
- New migration `V5__recurring_history_autolog.sql` (`recurring_payments.auto_log`, table `recurring_events`).

---

## Version 1.11.0 - Unreleased
**Summary emails and email preferences**

### Added
- **Weekly or monthly summary email** (off by default): total spent, change since the period before, top categories, the biggest expense, how much of the monthly budget was used, and the payments due in the next 7 days. Weeks run Monday to Sunday and months are calendar months; only a completed period is sent, once, and turning it on never sends an old one. A "Send me a sample" button previews it.
- **Choose your emails.** Settings, then Emails, has separate switches for payment reminders, budget alerts and payment updates, plus the summary option. Each saves immediately.
- Tests for the email rules, the period planner and the summary numbers; the migration test now checks the new preference columns.

### Changed
- The Email switch on the Recurring page's Reminder alerts card now covers due-payment reminders only. Payment updates and budget alerts have their own switches in Settings. Anyone who had email reminders off keeps getting no payment or budget emails (the migration copies the setting).

### Fixed
- The plain-text version of budget alert emails linked to the Recurring page instead of the Budget page.

### Database
- New migration `V4__email_preferences.sql` (four columns on `users`).

---

## Version 1.10.0 - Unreleased
**Search, filters, sort and export for expenses**

### Added
- **Search and filters on the Expenses page.** Search by description or category, filter by category (including "No category") and by minimum and maximum amount, and clear everything with one click. The header shows "7 of 12 entries" and the total for what you see.
- **Periods.** Beyond a single month you can list the last 3 months, this year, all time, or a custom date range (`GET /api/expenses?from=&to=`; a bad or reversed range falls back to the month, and a range is capped in length).
- **Sorting.** Newest, oldest, highest or lowest amount, or description A to Z, from the menu or by clicking a column heading.
- **Export CSV.** Downloads exactly the rows you are looking at (filtered and sorted), in your display currency with a currency column. The file opens correctly in Excel (UTF-8) and text that looks like a formula is neutralised so a spreadsheet will not run it.
- **Tests:** filters and sorting, the CSV builder (`npm test`), and date-range resolution.

---

## Version 1.9.1 - Unreleased
**Quality pass**

### Added
- **Login rate limiting.** After 5 failed attempts for the same username and address within 15 minutes, further attempts get a "Try again in N minutes" message (HTTP 429) until the oldest failure ages out. A correct password does not end a lock-out early. The login screen now shows the server's message instead of always saying "Invalid username or password".
- **Tests.** Recurring schedule dates (month ends, leap years, anchors), the five payment status emails, and the login limiter, plus `database/tests/test-migrations.sh`, which applies the migrations to a throw-away database and checks the merged categories and limits.
- **`DDL_AUTO` setting.** Set `DDL_AUTO=validate` to have Hibernate check the entities against the Flyway schema on start. The default is unchanged (`update`).

---

## Version 1.9.0 - Unreleased
**Per-category budgets and alerts**

### Added
- **Category limits.** Set a monthly cap for any category on the Budget page; limits apply every month and are private to your account.
- **Budget alerts.** When spending crosses 80% of a limit, and again when it goes over, you get an email (same look as the payment emails, if email reminders are on) and a push notification. This covers both the overall monthly budget and category limits, and applies to expenses you add, edit, or log with Mark as paid. Adding more after you are already over does not repeat the alert.
- **In-app heads-up.** The Add expense screen shows how an entry affects the overall budget and the category limit before you save, and a toast appears if saving crosses a line (also in guest mode).
- **Unit tests** for the alert rules and the email templates (`mvn test`).

### Database
- New migration `V3__category_budgets.sql` (table `category_budgets`).

---

## Version 1.8.1 - Unreleased
**Motion and feel**

### Added
- **Press feedback:** buttons, chips and the new Add button squash on press and spring back; the notification switch knob stretches.
- **Origin-aware motion:** Settings grows out of the control you pressed, dropdowns grow out of their trigger, ripples start at your finger, and the theme change spreads out from the toggle.
- **Peak moments:** saving an expense, income or budget and marking a recurring payment as paid play a short check-and-confetti moment (confetti flies on arcs); the new expense row glows when you land back on the list.
- **Delete with Undo:** expenses slide away immediately and can be restored for 5 seconds (replaces the confirm dialog). Playing animations reverse if you undo mid-way.
- **Rubber banding:** pulling past the top or bottom of a page on touch screens stretches and springs back; Settings can be dragged down to dismiss and resists when pulled up.
- **Progress feedback:** a thin top bar appears only when a request takes over ~120ms; the dashboard shows placeholders if the first load is slow.
- **Mobile Add button:** a large lime button within thumb reach on Overview, Expenses and Income.
- **Settings is easier to scan:** collapsible sections, and a short Popular list at the top of the currency menu.
- Numbers on the dashboard count to their new value; charts animate in 280ms.

### Changed
- Entrance animations play once per screen per session (and the sidebar on first load), staggered; revisiting a screen is instant. Hover lifts on cards were removed.
- All UI transitions are 280ms or less and use slow-in/slow-out or spring curves; depth added with highlights and shaded edges on buttons, cards and bars.
- Touch targets are at least 40px on touch screens; small icon buttons have a larger invisible hit area.
- `prefers-reduced-motion` turns animations off, including confetti and the theme reveal.

---

## Version 1.8.0 - Unreleased
**Foundations: migrations and your own categories**

### Added
- **Flyway database migrations.** New databases get the full schema; existing ones are baselined and upgraded in place.
- **Your own categories.** Add, rename and delete custom categories in Settings. They are private to your account; the default five stay shared and read-only. A category that is in use can't be deleted.
- **Import creates missing categories** from the file instead of falling back to Other.

### Changed
- Duplicate categories are merged automatically (expenses and recurring payments are repointed) and can't be created again.
- The API base URL (`VITE_API_URL`) and allowed CORS origin (`APP_URL`) now come from configuration.

### Removed
- Duplicate `src/api.js` client (everything uses `src/api/axios.js`).
- `database/fix_duplicate_categories.sql` (replaced by migration V2) and the table definitions in `database/schema.sql`.

---

## Version 1.7.0 - November 20, 2026
**Redesign, income, recurring payments and reminders**

### Added
- **Income tracking:** record income by source (Salary, Freelance, Gift, Other), filter by month and see totals per source.
- **Recurring payments:** custom intervals (every N days, weeks or months), a due date and a time of day. Reminders never log an expense on their own; use Mark paid or Skip.
- **Email and web push reminders:** sent at the due time, even when the app is closed. Branded HTML emails with a plain-text fallback. Reminder alerts card with email and push switches and a Send test button.
- **Email verification:** link valid for 24 hours, resend with a cooldown. Reminder emails wait until the address is verified; accounts created before 1.7 count as verified.
- **Multiple currencies:** display-currency switcher (12 currencies) with daily exchange rates. Amounts are stored in INR.
- **Guest mode:** the app works without an account; data stays in the browser and can be imported at login or sign-up. The default route now opens the dashboard.
- **Custom controls:** themed select, date, time and month pickers replace the browser defaults.

### Changed
- Complete visual redesign: new type, colour system, light and dark themes, sidebar with live reminder badge, bottom tab bar on mobile.
- Dashboard now shows income, spend, savings and upcoming payments alongside the budget hero card.
- Toast notifications close faster.
- Database, JWT and mail settings can be overridden with environment variables or a gitignored `secrets.properties`.
- Repository cleanup: `.gitignore` added, `node_modules` and build output no longer tracked, new README and LICENSE.

### Fixed
- Sign-up no longer accepts a client-supplied user id or verification flag.

---

## Version 1.6.0 — November 10, 2025  
**"Refined, Animated & Intuitive" Release**

### New Additions
- **Rebrand:** Application renamed from *Expense Tracker* → **Phainance**  
- **New UI Theme:**  
  - Elegant lavender–white gradient with soft shadows  
  - Enhanced typography with *Poppins* + *Inter*  
  - Smoother transitions and subtle fade-in animations throughout  
- **Dune-Inspired Login & Signup Pages:**  
  - Added static illustrated image for left panel  
  - Refined centered form layout for a professional, minimal experience  
  - Gradient animated “Phainance” title with tagline  

### Dashboard Enhancements
- **Improved Chart Rendering:** Fixed pie chart clipping issue (no more cropped categories)  
- **Add Expense Button:** Now visible directly from dashboard for quicker access  
- **Theme Toggle Update:** Replaced emoji with clean “Light / Dark” text label  
- **Budget View:** Budget button removed for a cleaner dashboard experience  
- **Animation Polish:**  
  - Added unified “cardEntrance” animation for smoother component appearance  
  - Dashboard and Expense List now have matching transitions  

### Notification System
- Introduced **React Toastify** across the app for consistent alerts  
  - Rounded corners and gradient backgrounds for success/error/info  
  - No emoji clutter — replaced with clean iconography  
  - Implemented for Add, Edit, Delete, Save, and Budget actions  

### Expense List Improvements
- Inline Editing expanded — now supports **Category** and **Date** editing  
- Buttons repositioned with spacing for better usability  
- Delete button recolored (deep red gradient with hover animation)  

### Add / Budget Page Revamp
- Center-aligned design with improved spacing  
- Back button repositioned to top-left corner for consistent navigation  
- Form layouts expanded with consistent input styling  
- Added entrance animation for Add Expense and Budget pages  

---

## Technical & Structural Updates
- Refactored CSS structure for dashboard consistency  
- Introduced unified layout grid across all pages  
- `AppProvider` context added globally for app-wide state handling  
- Cleaned up redundant code and removed unused imports  
- Ensured secure JWT token decoding and auto-navigation on expiry  

---

## Version Summary

| Component | Enhancement |
|------------|--------------|
| **Dashboard** | Recharts fix, button layout cleanup, smoother UI |
| **Expense List** | Inline edits extended, spacing & animations |
| **Add Expense** | Centered layout, top-left back button |
| **Budget Form** | Refined visuals, improved hierarchy |
| **Auth Pages** | New static background, rebranding, gradient typography |
| **Global UI** | Unified animations, soft shadows, color balance |

---

## Previous Releases

### **v1.5.0 — October 2025**
- Introduced analytics dashboard with pie and line charts  
- Added global month selector synced with localStorage  
- Created budget management system  
- Implemented responsive sidebar layout  

### **v1.3.0 — September 2025**
- Added JWT-based authentication  
- Integrated MySQL with Spring Boot backend  
- Established core expense CRUD APIs  

### **v1.0.0 — August 2025**
- Initial release with base expense tracking features  

---
