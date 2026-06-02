# Project: lean scheduling app — Phase 2: calendar provider adapters

## Prerequisite
Phase 1 (availability engine) is complete and green. Reuse its `TimeInterval` type and
the merge/subtract helpers in `src/lib/availability/intervals.ts`. Do NOT modify the engine;
this phase produces the real busy data that feeds it.

## Context / goal
Implement the real `CalendarProvider` adapters (Google Calendar + CalDAV) behind one interface,
plus an aggregator that fans out across multiple connected calendars and merges the result.
Still NO Next.js app, NO OAuth UI, NO DB. Credentials/tokens are INJECTED into the adapters;
acquiring and persisting them is Phase 3. Tests mock the HTTP layer — no live API calls in tests.

## Stack & constraints
- TypeScript strict. Luxon for any TZ normalization. All outputs are UTC ISO.
- Google: `googleapis` (or direct fetch to Calendar API v3).
- CalDAV: `tsdav`.
- The HTTP client must be injectable/mockable (inject a fetch client, or use msw in tests).
- Adapters are stateless given injected credentials. No global state.

## Interface (extend src/lib/availability/types.ts)

```typescript
interface CalendarProvider {
  getBusy(range: TimeInterval): Promise<TimeInterval[]>;
  createEvent(input: CreateEventInput): Promise<{ externalId: string }>;
}

interface CreateEventInput {
  startUtc: string; // UTC ISO 8601
  endUtc: string;   // UTC ISO 8601
  title: string;
  description?: string;
  attendee: { name: string; email: string };
  idempotencyKey: string; // dedup on retry
}

interface ConnectedCalendar {
  provider: CalendarProvider;
  readBusy: boolean;
  writeTarget: boolean;
}

interface BusyResult {
  success: boolean;
  busy: TimeInterval[];
  failures?: Array<{ calendar: string; error: Error }>;
}
```

## Google adapter (src/lib/providers/google.ts)

### Constructor
```typescript
GoogleCalendarAdapter(
  getAccessToken: () => Promise<string>,
  readCalendarIds: string[],
  writeCalendarId: string,
  httpClient?: typeof fetch  // optional, defaults to global fetch
)
```

### `getBusy(range: TimeInterval): Promise<TimeInterval[]>`
- Call `freebusy.query` on all read calendar IDs over the range
- Parse each returned busy block to a UTC `TimeInterval`
- Recurrence is expanded server-side — do not manually expand events
- Return merged intervals (use Phase 1's `mergeIntervals`)

### `createEvent(input: CreateEventInput): Promise<{ externalId: string }>`
- Call `events.insert` on the write-target calendar
- Map `CreateEventInput` → Google event resource:
  - `startTime`, `endTime` with `timeZone: "UTC"`
  - attendees from input
  - title, description
- Use `idempotencyKey` as a request header to prevent duplicates on retry
- Return the event's `id` as `externalId`

### Token refresh
- On a 401 response, call `getAccessToken()` to refresh exactly once
- Retry the request with the new token
- If refresh or retry fails, propagate the error

## CalDAV adapter (src/lib/providers/caldav.ts)

### Constructor
```typescript
CalDAVAdapter(
  serverUrl: string,
  username: string,
  password: string,
  readCalendarUrls: string[],
  writeCalendarUrl: string,
  httpClient?: typeof fetch
)
```

### `getBusy(range: TimeInterval): Promise<TimeInterval[]>`
1. **Preferred path**: Use VFREEBUSY query (server-side recurrence expansion)
   - Build and send a VFREEBUSY request covering all read calendars in the range
   - Parse the response to UTC `TimeInterval[]`
   
2. **Fallback path** (if server doesn't support VFREEBUSY):
   - Query for VEVENT resources in the range across all read calendars
   - Parse and expand recurrence rules (RRULE) client-side using Luxon
   - Convert all events to UTC `TimeInterval[]`
   - Handle all-day events correctly (they span a full day in the host's timezone)

3. Merge all intervals before returning

### `createEvent(input: CreateEventInput): Promise<{ externalId: string }>`
- Build a VEVENT resource:
  - DTSTART, DTEND in UTC
  - SUMMARY (title), DESCRIPTION
  - ORGANIZER and ATTENDEE fields
  - Assign a UID
- PUT the event to the write-calendar URL
- Return the UID/resource href as `externalId`

## Aggregator (src/lib/providers/aggregator.ts)

### Constructor
```typescript
CalendarAggregator(
  calendars: Array<{ 
    name: string; 
    provider: CalendarProvider; 
    readBusy: boolean; 
    writeTarget: boolean 
  }>
)
```

### `getBusyAll(range: TimeInterval): Promise<BusyResult>`
- Fan out `getBusy(range)` across all calendars with `readBusy: true` in parallel
- If a provider succeeds, collect its intervals
- If a provider fails (throws), record the error but **continue with others**
- Merge all collected intervals (use Phase 1's `mergeIntervals`)
- Return:
  ```typescript
  {
    success: failureCount === 0,
    busy: mergedIntervals,
    failures: failedProviders.length > 0 ? failedProviders : undefined
  }
  ```
- Caller decides whether to block the booking if `success: false` or if specific calendars failed

### `createOnTarget(input: CreateEventInput): Promise<{ externalId: string }>`
- Find the provider with `writeTarget: true`
- Call its `createEvent(input)` and return the result
- If no write target is configured, throw a clear error

## Required tests (mocked HTTP — no live network)

### Google adapter tests (src/lib/providers/google.test.ts)
- **getBusy**: 
  - Freebusy response with multiple calendars → correctly merged UTC intervals
  - Events in non-UTC zones (e.g., Europe/Rome) → normalized to UTC
  - All-day event → treated as a full-day interval
  - Empty response (no events) → empty array
  - Multiple busy blocks per calendar → merged

- **createEvent**:
  - Correct request payload to `events.insert`
  - attendee field mapped to attendees array
  - idempotencyKey sent as request header
  - Successful response → returns event ID as externalId

- **Token refresh**:
  - 401 response → calls `getAccessToken()` to refresh
  - Retry with new token succeeds → returns result
  - Refresh fails → propagates error
  - Token refreshed only once per request (no infinite loops)

- **Error handling**:
  - Network error → propagates as-is
  - Invalid calendar ID → 404 → handled gracefully

### CalDAV adapter tests (src/lib/providers/caldav.test.ts)
- **getBusy (VFREEBUSY)**:
  - VFREEBUSY response parsed to UTC intervals
  - Recurrence in VFREEBUSY expanded server-side correctly
  - Multiple busy blocks merged

- **getBusy (fallback)**:
  - Server returns 404 for VFREEBUSY → falls back to calendar-query
  - VEVENT list with RRULE → client-side expansion produces correct intervals
  - All-day VEVENTs handled correctly
  - Time zones normalized to UTC

- **createEvent**:
  - VEVENT built with correct DTSTART/DTEND in UTC
  - UID assigned and returned as externalId
  - PUT request successful

- **Error handling**:
  - Invalid credentials → 401 → error propagated
  - Server down → network error

### Aggregator tests (src/lib/providers/aggregator.test.ts)
- **getBusyAll**:
  - Multiple calendars queried in parallel
  - Results merged correctly (overlapping + adjacent intervals)
  - One provider fails → others still return results + failures recorded
  - All providers fail → success: false, but caller gets the error details
  - Empty busy list (no events) → empty interval array

- **Partial failure handling**:
  - Calendar A succeeds with [09:00–10:00]
  - Calendar B fails with a network error
  - Result: success: false, busy: [09:00–10:00], failures: [{ calendar: "B", error }]

- **createOnTarget**:
  - Finds the correct write-target provider
  - Routes the event creation and returns externalId
  - No write target configured → throws a clear error

## Mocking strategy (MSW or custom fetch mock)
- Mock `fetch` globally or inject a mock HTTP client
- For Google: mock responses to `https://www.googleapis.com/calendar/v3/*`
- For CalDAV: mock responses to the DAV server URL
- Tests do NOT make real HTTP requests

## Acceptance criteria
- `npm test` passes for all provider + aggregator tests
- No live API calls in CI (all mocked)
- All adapters are pure functions given injected credentials
- Errors in one provider do NOT crash the aggregator or other providers
- All output is UTC ISO; no timezone bugs
- Idempotency (Google) prevents accidental duplicate events on retry
