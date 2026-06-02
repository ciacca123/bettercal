import { randomUUID } from 'crypto';
import {
  CalendarProvider,
  CreateEventInput,
  TimeInterval,
} from '@/lib/availability/types';

/**
 * Local-mock calendar used in place of Google/CalDAV for today's testable build.
 * getBusy returns no external busy time (availability comes from the host's rules
 * and existing bookings); createEvent just mints an id.
 */
export class MockCalendarProvider implements CalendarProvider {
  constructor(private readonly busy: TimeInterval[] = []) {}

  async getBusy(range: TimeInterval): Promise<TimeInterval[]> {
    return this.busy.filter(
      (b) => b.end > range.start && b.start < range.end
    );
  }

  async createEvent(_input: CreateEventInput): Promise<{ externalId: string }> {
    return { externalId: `mock-${randomUUID()}` };
  }
}

export const mockCalendar = new MockCalendarProvider();
