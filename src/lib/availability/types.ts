export interface TimeInterval {
  start: string; // UTC ISO 8601
  end: string; // UTC ISO 8601
}

export interface WeeklyRule {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday
  startTime: string; // "HH:mm" in host timezone
  endTime: string; // "HH:mm" in host timezone
}

export interface DateOverride {
  date: string; // "YYYY-MM-DD" in host timezone
  intervals: Array<{ startTime: string; endTime: string }>; // empty = unavailable
}

export interface EventType {
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  slotIntervalMin: number;
  rangeDays: number;
}

export interface SlotQuery {
  eventType: EventType;
  weekly: WeeklyRule[];
  overrides: DateOverride[];
  hostTimeZone: string; // IANA timezone (e.g., "Europe/Rome", "America/New_York")
  busy: TimeInterval[];
  now: string; // UTC ISO 8601
}

export interface CreateEventInput {
  startUtc: string; // UTC ISO 8601
  endUtc: string; // UTC ISO 8601
  title: string;
  description?: string;
  attendee: { name: string; email: string };
  idempotencyKey: string; // dedup on retry
}

export interface CalendarProvider {
  getBusy(range: TimeInterval): Promise<TimeInterval[]>;
  createEvent(input: CreateEventInput): Promise<{ externalId: string }>;
}

export interface ConnectedCalendar {
  name: string;
  provider: CalendarProvider;
  readBusy: boolean;
  writeTarget: boolean;
}

export interface BusyResult {
  success: boolean;
  busy: TimeInterval[];
  failures?: Array<{ calendar: string; error: Error }>;
}
