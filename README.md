# BetterCal

A lean single-host scheduling app (a leaner Calendly). This is the **local-mock build**:
runnable today with **zero external services** — SQLite on disk, an in-memory calendar, and
email printed to the console. Google/CalDAV/Postgres/OAuth wiring lives behind interfaces and
gets switched on in a later phase.

## Quickstart

```bash
npm install
npm run setup     # create the SQLite DB + seed a demo host
npm run dev       # http://localhost:3000
```

Then open:
- **Booking page (the hero):** http://localhost:3000/demo/intro
- **Host dashboard:** http://localhost:3000/dashboard

Pick a time → enter name/email → confirm. The confirmation email is printed to the **server
console**. Bookings appear under the dashboard's Bookings tab.

## What works

- **Slot engine** (Phase 1): timezone- and DST-correct availability, buffers, min-notice.
- **Provider layer** (Phase 2): Google + CalDAV adapters + aggregator (unit-tested, mocked).
- **Booking flow** (Phase 3, local-mock): `getSlots` → public booking → `createBooking` with a
  **hard double-booking guard** (SQLite transaction + partial unique index on active bookings).
- **UI** (Phase 4 subset): clean neutral booking page with a live timezone switcher and a
  read-only dashboard (event type, weekly availability, calendars, bookings).

## Architecture

```
src/lib/availability/   Phase 1 — pure slot engine (no I/O)        [42 tests]
src/lib/providers/      Phase 2 — Google/CalDAV/aggregator (mocked) [tested]
src/lib/mockCalendar.ts Local-mock calendar (used by the app today)
src/lib/slots.ts        DB + engine → available slots
src/lib/booking.ts      Concurrency-safe booking (guard lives here)
src/db/                 Drizzle schema (SQLite) + seed
src/app/                Next.js App Router (booking page + dashboard)
```

The slot engine and provider adapters are **unchanged** from their tested phases; the app wires
them together. To go to production later: swap `mockCalendar` for the Google/CalDAV adapters,
point `db.ts` at Postgres, and re-enable OAuth — no change to the engine or booking logic.

## Commands

| Command | What |
|---|---|
| `npm run setup` | Create SQLite schema + seed demo host |
| `npm run dev` | Start the app |
| `npm test` | Run the 42-test suite (engine, providers, crypto) |
| `npm run db:seed` | Re-seed (idempotent) |

## Resetting

Delete `bettercal.db*` and run `npm run setup` again.
```bash
rm -f bettercal.db*; npm run setup
```
