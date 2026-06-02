# Project: lean scheduling app — Phase 1: availability/slot engine

## Context
We're building a lightweight single-host scheduling app (a leaner Calendly).
The heart is the slot engine. Build ONLY that now: pure, deterministic functions
with all inputs injected. No UI, no OAuth, no DB, no network calls yet.

## Stack & constraints
- TypeScript, strict mode.
- Luxon for all timezone/DST math. Everything internal is UTC; convert only at edges.
- Vitest for tests.
- No tRPC, no monorepo, no ORM in this phase. Just a `src/lib/availability/` module.
- Keep it dependency-light and pure-functional. No hidden global state; `now` is injected.

## Scope of THIS task
Implement and fully test `computeAvailableSlots`. Stub the calendar provider behind
an interface so busy-time is passed in, not fetched.

### Types to define (src/lib/availability/types.ts)
- `TimeInterval { start: string /* UTC ISO */, end: string /* UTC ISO */ }`
- `WeeklyRule { weekday: 0|1|2|3|4|5|6, startTime: "HH:mm", endTime: "HH:mm" }`
- `DateOverride { date: "YYYY-MM-DD", intervals: {startTime,endTime}[] /* empty = unavailable */ }`
- `EventType { durationMin, bufferBeforeMin, bufferAfterMin, minNoticeMin, slotIntervalMin, rangeDays }`
- `SlotQuery { eventType, weekly: WeeklyRule[], overrides: DateOverride[], hostTimeZone: string /* IANA */, busy: TimeInterval[], now: string /* UTC ISO */ }`
- `CalendarProvider { getBusy(range: TimeInterval): Promise<TimeInterval[]> }` // interface only, with an in-memory mock for tests

### Algorithm (src/lib/availability/computeSlots.ts)
1. windowStart = max(now, now + minNoticeMin). windowEnd = startOfDay(now in hostTZ) + rangeDays.
2. For each calendar date in [windowStart, windowEnd] in hostTimeZone:
   - If a DateOverride matches the date, use its intervals (empty array = no availability that day).
     Otherwise use WeeklyRules matching that weekday.
   - Build each working interval as a host-local datetime ON THAT DATE, then convert to UTC via Luxon.
     Per-date conversion is required so DST transitions resolve correctly (do NOT precompute one offset).
3. Merge overlapping `busy` intervals.
4. For each working interval, step candidate starts by slotIntervalMin.
   A slot [s, s+durationMin] is bookable iff ALL hold:
     - s >= windowStart
     - [s, s+durationMin] fits within the working interval
     - [s - bufferBeforeMin, s + durationMin + bufferAfterMin] does not overlap any merged busy interval
5. Return sorted, de-duplicated `TimeInterval[]` in UTC. Output is UTC; viewer-TZ formatting is a separate concern.

### Required tests (src/lib/availability/computeSlots.test.ts)
Cover at minimum:
- Baseline: 09:00–17:00 host TZ, 30-min slots, no busy → exact expected count and boundaries.
- DST spring-forward and fall-back days in a DST-observing zone (e.g. "Europe/Rome"): verify UTC offsets shift correctly across the transition date.
- Busy block mid-day → no returned slot overlaps it.
- Buffers: a busy block plus before/after buffers correctly excludes adjacent slots.
- minNotice: slots earlier than now+minNotice are excluded.
- DateOverride: a date marked unavailable yields zero slots; custom hours override the weekly rule.
- Multiple busy intervals from different sources merge correctly (overlapping + adjacent).
- Edge slot where duration+buffer exceeds the working interval end is excluded.
- Viewer in a different TZ than host: output UTC is identical regardless of viewer TZ.

## Project setup
- Init TypeScript + Vitest. Add `npm test`.
- Folder: src/lib/availability/{types.ts, computeSlots.ts, intervals.ts (merge/subtract helpers), computeSlots.test.ts, mockProvider.ts}.
- Add a short README in that folder explaining the engine and how to run tests.

## Acceptance criteria
- `npm test` passes with all the cases above green.
- computeSlots is pure and deterministic given its inputs (no Date.now, no I/O).
- No TODOs left in the engine itself.

## Explicitly OUT of scope for now (do NOT build)
- Next.js app, any UI, React.
- Google/CalDAV OAuth or real API calls (mock only).
- Database, Drizzle, bookings persistence, event creation.
We'll add those in later phases once the engine is solid.
