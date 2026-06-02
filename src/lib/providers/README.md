# Calendar Providers

Real calendar integrations (Google Calendar, CalDAV) behind a unified `CalendarProvider` interface.
Credentials/tokens are injected; this layer does NOT handle OAuth or persistence (Phase 3).

## Architecture

- **`CalendarProvider` interface**: `getBusy(range)` and `createEvent(input)` — both async, pure functions.
- **Adapters**: Google Calendar, CalDAV. Both implement the interface.
- **Aggregator**: Fans out `getBusy` across multiple calendars, merges results, handles partial failures.

## Google Calendar Adapter

### Setup

```typescript
import { GoogleCalendarAdapter } from './google';

const adapter = new GoogleCalendarAdapter(
  async () => accessToken, // refresh logic handled by caller
  ['calendar1@gmail.com', 'calendar2@gmail.com'], // read calendars
  'primary', // write calendar
  fetch // optional: inject fetch for testing
);
```

### `getBusy(range: TimeInterval): Promise<TimeInterval[]>`

- Calls `freebusy.query` API with all read calendars
- Returns UTC intervals (server expands recurrence)
- On 401: refreshes token once and retries

### `createEvent(input: CreateEventInput): Promise<{ externalId: string }>`

- Creates a Google Calendar event
- Uses `idempotencyKey` to prevent duplicates on retry
- Returns event ID as `externalId`

## CalDAV Adapter

### Setup

```typescript
import { CalDAVAdapter } from './caldav';

const adapter = new CalDAVAdapter(
  'https://caldav.example.com',
  'user@example.com',
  'password123',
  ['https://caldav.example.com/calendars/user/cal1/'], // read calendars
  'https://caldav.example.com/calendars/user/cal1/', // write calendar
  fetch // optional
);
```

### `getBusy(range: TimeInterval): Promise<TimeInterval[]>`

1. **Preferred**: VFREEBUSY query (server-side recurrence expansion)
2. **Fallback**: Calendar-query + client-side recurrence expansion (if VFREEBUSY fails)
3. Merges all intervals, handles all-day events correctly

### `createEvent(input: CreateEventInput): Promise<{ externalId: string }>`

- Builds and PUTs a VEVENT to the server
- Returns the event's UID as `externalId`

## Aggregator

### Setup

```typescript
import { CalendarAggregator } from './aggregator';

const aggregator = new CalendarAggregator([
  { name: 'Work', provider: googleAdapter, readBusy: true, writeTarget: false },
  { name: 'Personal', provider: caldavAdapter, readBusy: true, writeTarget: true },
]);
```

### `getBusyAll(range: TimeInterval): Promise<BusyResult>`

- Queries all `readBusy: true` calendars in parallel
- If one fails, returns **partial results** (success: false, busy: [...], failures: [...])
- Caller decides whether to block booking

```typescript
const result = await aggregator.getBusyAll(range);
if (!result.success) {
  console.warn('Some calendars failed:', result.failures);
}
// Use result.busy regardless
```

### `getBusy(range) and createEvent(input)`

- Thin wrappers: `getBusy` returns `getBusyAll().busy`; `createEvent` routes to write-target

## Error handling

- **Transient errors** (network, 5xx): propagated to caller
- **Auth errors** (401): token refresh attempted once, then error propagated
- **Provider-specific failures** (invalid calendar, malformed event): caught by aggregator, returned as partial failure
- **No write target**: `createEvent` throws a clear error

## Testing

All tests use **mocked HTTP** (no live API calls). Adapters are pure functions given injected credentials and fetch.

```bash
npm test
```

Tests cover:
- Busy interval merging
- Timezone normalization
- Recurrence expansion
- Token refresh + retry
- Partial failure handling
- Idempotency

## Future work (Phase 3+)

- OAuth flow to acquire & refresh tokens
- Token persistence (database)
- Event confirmation workflow
- Attendee availability UI
