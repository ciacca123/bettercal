# Availability & Slot Engine

The core of the lean scheduling app. Pure, deterministic functions that compute available time slots for events based on:

- **Weekly availability rules** (e.g., "Monday–Friday, 9am–5pm")
- **Date-specific overrides** (e.g., holidays, custom hours)
- **Busy intervals** from an external calendar provider
- **Event constraints** (duration, buffers, notice period, slot interval)

## Design principles

- **Pure & deterministic**: No global state, no hidden I/O. All inputs injected: `now`, timezone, busy intervals, rules.
- **UTC internally**: All intervals stored and computed in UTC. Timezone conversion happens only at edges (converting host-local hours to UTC per-date to handle DST correctly).
- **Per-date DST handling**: Each calendar date is independently converted from host local time to UTC, so spring-forward and fall-back transitions resolve correctly.
- **Dependency-light**: Luxon for datetime math, Vitest for tests. No ORM, no network layer at this level.

## Modules

### `types.ts`

Core types:
- `TimeInterval`: start/end in UTC ISO 8601
- `WeeklyRule`: recurring availability pattern (e.g., every Monday, 9–5)
- `DateOverride`: specific date availability (replaces weekly rule for that date)
- `EventType`: event constraints (duration, buffers, notice, slot interval)
- `SlotQuery`: all inputs to the slot-computation algorithm
- `CalendarProvider`: interface for fetching busy times (implementation injected)

### `computeSlots.ts`

Main algorithm: `computeAvailableSlots(query: SlotQuery): TimeInterval[]`

**Algorithm outline:**
1. Compute the window: earliest slot is `max(now, now + minNotice)`; latest is `startOfDay(now in hostTZ) + rangeDays`.
2. For each calendar date in the window, resolve availability:
   - If a `DateOverride` matches, use its intervals (empty = unavailable).
   - Otherwise, use `WeeklyRule`s matching that weekday.
   - **Per-date conversion**: Convert each interval from host-local time to UTC using the date-specific offset (handles DST).
3. Merge all busy intervals into non-overlapping ranges.
4. For each working interval, step candidate start times by `slotIntervalMin`:
   - A slot `[s, s+durationMin]` is bookable iff:
     - `s >= windowStart`
     - Slot fits within the working interval
     - `[s - bufferBeforeMin, s + durationMin + bufferAfterMin]` does not overlap any busy interval
5. Sort and de-duplicate. Output is UTC.

### `intervals.ts`

Utility functions for interval algebra:
- `mergeIntervals(intervals)`: Coalesce overlapping/adjacent intervals.
- `subtractIntervals(interval, toSubtract)`: Remove intervals from a target interval.
- `overlapsInterval(a, b)`: Check for overlap.

### `mockProvider.ts`

`InMemoryCalendarProvider`: Stub calendar provider for tests. Pass busy intervals at construction; tests can update them via `setBusy()`.

## Running tests

```bash
npm test
```

Runs all tests in `computeSlots.test.ts`. Coverage includes:
- Baseline slot generation (no busy, straightforward grid)
- DST transitions (spring-forward and fall-back)
- Busy blocks, buffers, and minimum notice
- Date overrides
- Multiple busy intervals merging
- Edge cases (duration + buffer exceeding working hours, etc.)
- UTC consistency across different host timezones

### Optional: UI mode

```bash
npm run test:ui
```

Opens a browser-based test dashboard for debugging.

## Future work (out of scope for Phase 1)

- Real calendar provider (Google Calendar, CalDAV)
- Database models and persistence
- HTTP API layer
- React UI
- Booking confirmation flow
