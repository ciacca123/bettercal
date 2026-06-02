# Project: lean scheduling app — Phase 3: Next.js app, OAuth, DB, booking flow

## Prerequisite
Phases 1 (availability engine) and 2 (provider adapters + aggregator) are complete and green.
Reuse them as-is: `computeAvailableSlots` (Phase 1) and `aggregator.getBusyAll` / `createOnTarget`
(Phase 2). Do NOT reimplement slot logic or calendar I/O — wire them in. The aggregator's
getBusyAll output feeds computeAvailableSlots' `busy` input directly.

## Context / goal
Build the real app around the existing core: a Next.js App Router project with a Postgres/Drizzle
database, Google OAuth (login = calendar consent), encrypted CalDAV credentials, a public booking
flow with a hard double-booking guard, confirmation emails, and a minimal host dashboard.

## Stack & constraints
- Next.js App Router, React Server Components + Server Actions. NO tRPC.
- Postgres + Drizzle ORM. Migrations checked in.
- Auth.js (NextAuth) Google provider for the host. CalDAV creds entered via form.
- Luxon for TZ. All timestamps stored UTC.
- Resend for email, behind an injectable/mockable client.
- Secrets via env. Tokens encrypted at rest. Never log credentials.
- Keep it lean: no monorepo, no plugin system, no extra abstractions beyond what's specified.

## Milestone 3.1 — Database schema + Drizzle (src/db/schema.ts + migrations)

### Tables

#### `users`
- id (uuid, pk)
- email (text, unique, not null)
- name (text)
- image (text, nullable)
- time_zone (text, default 'UTC') — IANA timezone
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

#### `connected_calendars`
- id (uuid, pk)
- user_id (uuid, fk→users, not null)
- provider ('google' | 'caldav', not null)
- external_account_id (text) — Google account email or CalDAV server URL
- read_busy (boolean, default true)
- write_target (boolean, default false) — **Only one per user; enforce at app level + DB constraint**
- read_calendar_ids (jsonb) — ['calendar1@gmail.com', ...] for Google; calendar URLs for CalDAV
- write_calendar_id (text) — primary@gmail.com or calendar URL
- encrypted_credentials (text) — Base64(IV || tag || ciphertext) for Google refresh_token or CalDAV password
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
- Constraint: unique(user_id, provider, external_account_id)
- Constraint: at most one write_target per user_id

#### `event_types`
- id (uuid, pk)
- user_id (uuid, fk→users, not null)
- slug (text, not null) — URL slug (e.g., "1:1", "onboarding")
- title (text, not null)
- duration_min (int, not null)
- buffer_before_min (int, default 0)
- buffer_after_min (int, default 0)
- min_notice_min (int, default 0)
- slot_interval_min (int, default 30)
- range_days (int, default 30)
- location (text, nullable) — meeting location
- active (boolean, default true)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
- Constraint: unique(user_id, slug)

#### `weekly_availability`
- id (uuid, pk)
- user_id (uuid, fk→users, not null)
- weekday (smallint 0-6, not null) — 0=Sun, 6=Sat
- start_time (text, not null) — "HH:mm" (e.g., "09:00")
- end_time (text, not null) — "HH:mm"
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

#### `date_overrides`
- id (uuid, pk)
- user_id (uuid, fk→users, not null)
- date (text, not null) — "YYYY-MM-DD"
- intervals (jsonb) — `[{startTime: "HH:mm", endTime: "HH:mm"}, ...]` or `[]` for unavailable
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
- Constraint: unique(user_id, date)

#### `bookings`
- id (uuid, pk)
- event_type_id (uuid, fk→event_types, not null)
- start_utc (timestamptz, not null)
- end_utc (timestamptz, not null)
- attendee_name (text, not null)
- attendee_email (text, not null)
- attendee_timezone (text, not null) — IANA timezone
- status ('pending' | 'confirmed' | 'cancelled' | 'failed', default 'pending')
- external_event_id (text, nullable) — calendar provider's event ID
- calendar_id (uuid, nullable) — fk→connected_calendars (the write-target used)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
- **Partial unique index**: `UNIQUE (calendar_id, start_utc) WHERE status IN ('pending', 'confirmed')`
  — Hard guard against double-booking on the same calendar.

## Milestone 3.2 — Auth, OAuth & encrypted token storage

### Auth.js setup (src/lib/auth.ts)
- Google provider with:
  - `client_id`, `client_secret` from env
  - `allowDangerousEmailAccountLinking: true` (host can link multiple Google accounts)
  - Scopes: `https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events`
  - `access_type: 'offline'` (get refresh token)
  - `prompt: 'consent'` (always show consent, even if previously granted)

- Callbacks:
  - `signIn`: validate user, insert/update in users table
  - `jwt`: store provider/tokens in JWT
  - `session`: expose user info + provider tokens to server actions

### Encryption (src/lib/crypto.ts)
- `encrypt(plaintext: string, key: Buffer): string`
  - Generate random IV (16 bytes)
  - AES-256-GCM encrypt with key
  - Return Base64(IV || authTag || ciphertext)
  
- `decrypt(ciphertext64: string, key: Buffer): string`
  - Decode Base64
  - Extract IV, authTag, ciphertext
  - Decrypt; throw on auth tag mismatch
  - Return plaintext

- Key: from `ENCRYPTION_KEY` env (32 bytes, base64 decoded)

### Token getter for Google adapter (src/lib/tokenGetter.ts)
```typescript
export async function getGoogleAccessToken(userId: string): Promise<string> {
  // 1. Fetch google connected_calendar row from DB
  // 2. Check token expiry; if expired, call Google auth endpoint to refresh
  // 3. Decrypt new refresh_token, re-encrypt and persist
  // 4. Return new access_token
}
```

### CalDAV connect action (src/app/actions/connectCalDAV.ts)
- Server action: `connectCalDAVAction(serverUrl, username, password, readUrls, writeUrl)`
- Validates creds: call `new CalDAVAdapter(...).getBusy(testRange)` — if it fails, return error
- Encrypts password, stores in connected_calendars table
- Returns success or error (no re-throw; user sees a toast)

## Milestone 3.3 — Slots + booking flow (the crown jewel)

### getSlots function (src/lib/slots.ts)
```typescript
export async function getSlots(
  userId: string,
  eventSlug: string,
  rangeStart: string, // UTC ISO
  rangeEnd: string,   // UTC ISO
): Promise<{
  slots: TimeInterval[];
  warning?: { type: 'partial_failure', failures: Array<{calendar, error}> };
}>
```

Logic:
1. Load event_type, weekly_availability, date_overrides from DB
2. Load all connected_calendars for the user
3. Construct aggregator from connected calendars
4. Call `aggregator.getBusyAll({ start: rangeStart, end: rangeEnd })`
5. If `!result.success`, surface the warning (config decides: throw or warn)
6. Call `computeAvailableSlots({
     busy: result.busy,
     weekly: weeklyAvailability,
     overrides: dateOverrides,
     eventType: { durationMin, bufferBeforeMin, ... },
     hostTimeZone: user.time_zone,
     now: new Date().toISOString()
   })`
7. Return slots in UTC; caller (UI) converts to viewer timezone

### createBooking server action (src/app/actions/createBooking.ts)
```typescript
export async function createBookingAction(
  eventSlug: string,
  startUtc: string,
  attendeeName: string,
  attendeeEmail: string,
  attendeeTimezone: string
): Promise<{ success: boolean; bookingId?: string; error?: string }>
```

**Concurrency-safe algorithm:**

1. **Start a database transaction**
2. **Acquire advisory lock** (serialize on the write-target calendar):
   ```sql
   SELECT pg_advisory_xact_lock(('connected_calendar:' || writeCalendarId)::bigint)
   ```
   This ensures only one createBooking for the same write-target calendar runs at a time.

3. **Re-validate slot availability**:
   - Load event_type, user, connected_calendars from DB
   - Check existing bookings: `SELECT * FROM bookings WHERE start_utc = $1 AND end_utc = $2 AND status IN ('pending', 'confirmed')`
   - Fresh `aggregator.getBusyAll()` for a window around the slot
   - Call `computeAvailableSlots()` with fresh busy
   - If slot NOT in result → abort transaction, return error "slot no longer available"

4. **Insert booking row** with status 'pending':
   ```sql
   INSERT INTO bookings (event_type_id, start_utc, end_utc, attendee_name, attendee_email, 
     attendee_timezone, status, calendar_id, created_at)
   VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, now())
   RETURNING id
   ```
   The partial unique index is the hard backstop: if another INSERT succeeded in step 3,
   this one will fail with a constraint violation.

5. **Commit transaction** (lock released)
   - ⚠️ Keep NO external I/O (network calls) inside the transaction.

6. **Create event on target calendar** (outside transaction):
   ```typescript
   const result = await aggregator.createOnTarget({
     startUtc, endUtc, title: eventType.title,
     attendee: {name: attendeeName, email: attendeeEmail},
     idempotencyKey: bookingId, // reuse booking ID for idempotency
   });
   ```

7. **Handle calendar write result**:
   - Success → `UPDATE bookings SET status = 'confirmed', external_event_id = $1 WHERE id = $2`
   - Failure → `UPDATE bookings SET status = 'failed' WHERE id = $1`; return error to user

8. **Send emails** (best-effort, do NOT fail the booking):
   - Confirmation email to attendee (include .ics attachment with the slot)
   - Notification email to host
   - On email failure: log but do not throw

9. **Return success + booking ID** (or error)

### Why this is safe

- **Advisory lock** ensures only one write-target booking at a time (serializes on calendar)
- **Partial unique index** is a fallback: if two requests slip through lock creation (shouldn't happen),
  the DB rejects one
- **Re-validation inside transaction** checks against both the bookings table AND fresh busy blocks
- **Lock is released on commit**, minimizing contention
- **No network inside transaction** means no "locked for 30 seconds waiting for flaky API"

## Milestone 3.4 — Minimal UI (follow lean, fast-first-paint principles)

### Public booking page: `/[username]/[eventSlug]`
- RSC: fetch user + event type
- Date picker (client): select date → fetch slots for that date
- Show slots in **viewer's timezone** (auto-detect via `Intl.DateTimeFormat`; allow override)
- Booking form: name, email, submit
- Optimistic UI: show "Creating..." + disable button
- Success → show confirmation screen with .ics download link
- Error → show toast + allow retry

### Host dashboard (authenticated): `/dashboard`
- **Sidebar navigation**: event types, availability, connected calendars, bookings
- **Event types page** (`/dashboard/event-types`):
  - List event types + active status toggle
  - Create new (form for slug, title, duration, buffers, etc.)
  - Edit/delete
  
- **Availability page** (`/dashboard/availability`):
  - Weekly editor: pick hours for each day
  - Date overrides: add/remove specific days (unavailable or custom hours)
  - Save via server action
  
- **Connected calendars** (`/dashboard/calendars`):
  - List connected calendars
  - **Google sign-in button**: redirects to `/api/auth/signin`, on callback creates connected_calendar
  - **CalDAV form**: server URL, username, password; calls `connectCalDAVAction`
  - Delete calendar (unlink)
  
- **Bookings list** (`/dashboard/bookings`):
  - Table: date/time, attendee, status, actions
  - Status badges: pending (gray), confirmed (green), failed (red), cancelled (strikethrough)
  - Cancel button (stretch goal for Phase 4)

### Styling
- Use TailwindCSS (already in Next.js template)
- Keep components simple: avoid client-side state libraries
- Prefer Server Actions over client-side fetch

## Required tests

### crypto.test.ts
- `encrypt(plaintext) → decrypt(ciphertext) === plaintext`
- Tampered ciphertext → `decrypt` throws
- Different key → decrypt fails

### tokenGetter.test.ts
- Expired token → calls Google API to refresh → returns new access_token
- New token persisted + encrypted in DB
- Refresh failure → throws

### slots.test.ts (integration)
- Seed DB with event_type, weekly_availability, connected_calendars
- Mock aggregator (return canned busy blocks)
- `getSlots()` → returns correct UTC slots
- Partial failure (aggregator returns `success: false`) → warning surfaced

### createBooking.test.ts (concurrency)
- **Test 1**: Sequential bookings → both succeed
- **Test 2**: Parallel bookings for SAME slot → one 'confirmed', one fails with "no longer available"
- **Test 3**: Calendar write fails → booking marked 'failed', error returned, no email sent
- **Test 4**: Email fails → booking still 'confirmed' (email is best-effort)
- **Test 5**: Double-booking via raw SQL INSERT (bypassing app) → constraint violation

### auth.test.ts
- Google sign-in callback → inserts user, creates google connected_calendar with encrypted refresh_token
- CalDAV connect → validates creds, encrypts, stores

## Env vars (document in README)
```
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=<32 bytes, base64>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=<random>
NEXTAUTH_URL=http://localhost:3000 (dev) | https://... (prod)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@bettercal.local (dev) | noreply@yourdomain.com (prod)
```

## Acceptance criteria
- `npm run dev` boots; `npm run migrate` applies migrations; seed DB with test user + event type
- Full happy path works against a test Google account (manual): sign in, see availability, book a slot, receive email
- Automated tests (mocked external services):
  - All units pass: crypto, token getter, slots, booking concurrency, auth
  - Coverage ≥ 80% for business logic (slots, booking)
  - No tokens/secrets in logs
- Phases 1 & 2 unchanged; no reimplementation
- Two concurrent bookings for the same slot → exactly one confirmed (test both + verify DB)

## Out of scope (future)
- Teams / round-robin
- Payments (Stripe)
- Reschedule & cancel UX (cancel can be a stretch goal for Phase 4)
- Microsoft calendar (add provider adapter in Phase 2.5)
- Webhooks, real-time updates
- Multi-host (SaaS)
- Custom domain per host
- Advanced features (recurring bookings, group events, etc.)

Keep hooks clean for these but don't build them in Phase 3.
