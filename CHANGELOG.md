# Changelog  
_All notable changes to **Phainance** will be documented in this file._  

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
