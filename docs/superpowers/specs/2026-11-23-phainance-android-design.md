# Phainance Android App: Design

Date: 2026-11-23 · Status: draft, awaiting approval
Source: Phainance 1.7 (React/Vite + Spring Boot 3.2 + MySQL 8), codebase read in full.

Legend: **[Decided]** = chosen by the owner. **[Call]** = my proposal, not yet agreed.

---

## 1. Intent

Turn Phainance into a public, free Android app (Play Store) whose main value is **effortless expense capture**: log in seconds, and have UPI payments appear without typing them in.

## 2. Goals / non-goals / anti-goals

**Goals**
- Public release on Google Play. **[Decided]**
- Fast manual entry (quick-add, home-screen widget, share target). **[Decided]**
- Auto-capture of UPI/bank payments from Android notifications, on-device. **[Decided]**
- Works fully offline; account and sync are optional. **[Decided]**
- The web app stays and shares one account with the Android app: signing in on either shows the same data. **[Decided]**
- Keep existing features: income, budgets, category limits, recurring payments, currencies, CSV export.

**Non-goals (v1)** **[Call]**
- iOS (no notification-listener equivalent exists there).
- SMS reading, bank linking (Account Aggregator), card storage.
- Paid tier.

**Anti-goals** (failures even if it "works")
- Raw notification text leaves the phone or is stored.
- Auto-captured items silently become expenses (wrong amounts erode trust).
- Play rejection or suspension over permissions/data handling.

## 3. Constraints
- Cards cannot be "linked" for history; no bank/network exposes it to third parties. Saving card numbers triggers PCI-DSS. Not done.
- Play restricts SMS access and requires disclosure for notification access, a Data safety form, a privacy policy, and in-app plus web account deletion. Verify current rules at submission.
- Existing stack is reused: React UI, Spring Boot, MySQL, Flyway.
- Solo developer; keep the native surface small.

## 4. Approaches considered

| Decision | Options | Picked |
|---|---|---|
| Auto-capture | A notification listener · B SMS parsing · C Account Aggregator · D fast manual | **D + A** [Decided]. B risks Play rejection; C needs an AA partner and cost, revisit later. |
| Data location | Server-first · local-first + optional sync · local-only | **Local-first + optional sync** [Decided] |
| Client | Capacitor + Kotlin plugin · React Native · native Kotlin | **Capacitor + Kotlin plugin** [Decided]. Reaffirmed once the web app had to stay in sync: one React codebase serves both web and Android, where native Kotlin would mean maintaining two UIs. |
| Audience | Personal · public free · public paid | **Public free** [Decided] |

## 5. Architecture [Call unless noted]

```
Android app (Capacitor)
 ├─ React UI (existing, adapted)
 ├─ App DB: SQLite (SQLCipher), owned by JS layer, source of truth
 ├─ Kotlin plugin
 │   ├─ NotificationListenerService → parse → encrypted native inbox
 │   ├─ Quick-add widget + share-target activity → inbox
 │   └─ Local reminder scheduling
 └─ Sync client (only if signed in)
        │ HTTPS
Spring Boot API ── MySQL
 (auth, sync, email, optional push)
```

- The listener runs when the app is closed, so it cannot write to the JS-owned DB. It writes to a small native encrypted **inbox**; the JS layer drains it on app open into the **Review queue**.
- The existing guest store (`guestStore.js`, ~375 lines) is the seed for the local data layer: same API shape, now backed by SQLite instead of in-memory/localStorage.

## 6. Capture pipeline [Call]
1. Listener receives notifications only from an **allow-list of packages** (UPI apps and banks; list maintained in code).
2. Per-source parser templates extract: amount, direction (debit only), merchant/payee, timestamp, UPI reference if present, source app.
3. **Raw notification text is discarded** after parsing; only the parsed fields are stored.
4. Duplicates (UPI app and bank both notify; or a manual entry for the same payment) are merged by UPI reference when present, else amount + 10-minute window.
5. Items land in the **Review queue**: confirm, edit category, or dismiss. Only confirmed items become expenses. Category suggestions come from payee→category memory of past confirmations.
6. Unparseable notifications are dropped, never guessed.

## 7. Data model changes [Call]
- Money: integer **minor units** (paise) plus currency code, replacing `DOUBLE`. Migrate existing rows in a Flyway migration.
- Every synced entity gets: client-generated UUID, `updated_at`, soft-delete flag.
- Expense gains `source` (manual / notification / widget / import) and `upi_ref` (nullable).

## 8. Sync [Call]
- Pull-since-cursor + batched push; idempotent by UUID; last-write-wins per record; deletes are tombstones.
- Server stores only confirmed records. Never raw notifications.
- Signed-out use stays fully local. Signing in uploads existing local data (replaces the current guest import).
- The web app is a first-class sync client using the same sync layer and data model (browser storage as its local cache). Both clients sync on sign-in, app open/focus, after local changes, and periodically. Real-time push-triggered sync is a later option.
- Notification capture is Android-only; confirmed items sync to the web like any other expense.

## 9. Reminders [Call]
- Recurring-payment reminders become local scheduled notifications so they work offline.
- Exact alarms are restricted on recent Android for non-alarm apps; builder verifies permission rules and falls back to a minutes-wide window if needed.
- Server email/push remain as optional extras for synced users.

## 10. Backend changes [Call]
- Auth: short-lived access token + rotating refresh token; subject is user id, not username; refuse to start with the default `JWT_SECRET`.
- Tokens on device in Android Keystore-backed storage, not `localStorage`; web build uses httpOnly cookies.
- `/api/analytics/**` currently `permitAll` with manual token parsing: put it behind normal authentication.
- `DDL_AUTO=validate` by default; Flyway only.
- Upgrade `bcprov-jdk15on` 1.70 (deprecated line) and `jjwt` 0.11.5.
- Add account-deletion endpoint (hard delete of all user data), data export, rate limiting beyond login.
- CORS: Capacitor origins plus the web URL.
- Sign-in: email + password plus Google Sign-In. **[Decided]**
- Hosting: free-tier host (Render, Fly or Railway) to start. **[Decided]** Builder verifies current free-tier limits. Free tiers typically sleep when idle, which breaks the per-minute reminder and daily summary schedulers: server-side email/push reminders need an always-on instance or an external scheduler ping. Local reminders on the phone are unaffected.
- Database engine: move from MySQL to Postgres. **[Decided]** Port Flyway V1–V4 (and any MySQL-specific queries), and migrate data for existing accounts if any matter.

## 11. Security and privacy [Call]
- Local DB encrypted (SQLCipher), key held in Android Keystore. Android backup of app data disabled.
- Notification access: prominent in-app disclosure explaining exactly what is read and that it never leaves the device, then deep-link to the system settings screen. App fully usable if the user declines.
- Optional app lock (biometric/PIN). Hide amounts in the recents screen.
- Privacy policy, Play Data safety form, and Financial features declaration, all matching actual behavior.
- India DPDP Act basics: consent, purpose limitation, deletion, grievance contact.

## 12. Phases [Call]
0. Hardening and schema fixes on the existing backend (money type, auth, analytics, Flyway-only).
1. Capacitor shell; local SQLite data layer replacing the guest store; all pages working offline.
2. Fast entry: quick-add screen, widget, share target.
3. Notification capture, parsers, dedupe, Review queue.
4. Auth rework and sync.
5. Local reminders.
6. Release: closed testing (check Play's current testing requirement for new developer accounts), store listing, policies, production.

Testing: keep existing unit suites; add parser fixtures per source app, sync idempotency tests, migration tests; set up CI.

## 13. Left to the builder / open
- App name, package id, branding, Play developer account status. Open.
- Initial allow-list of source apps and parser templates (needs real sample notifications).
- Exact-alarm and notification-listener Play policy details at implementation time.
