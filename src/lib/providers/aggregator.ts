import {
  TimeInterval,
  CreateEventInput,
  CalendarProvider,
  ConnectedCalendar,
  BusyResult,
} from '../availability/types';
import { mergeIntervals } from '../availability/intervals';

export class CalendarAggregator implements CalendarProvider {
  private calendars: ConnectedCalendar[];

  constructor(calendars: ConnectedCalendar[]) {
    this.calendars = calendars;
  }

  async getBusy(range: TimeInterval): Promise<TimeInterval[]> {
    const result = await this.getBusyAll(range);
    return result.busy;
  }

  async getBusyAll(range: TimeInterval): Promise<BusyResult> {
    const readCalendars = this.calendars.filter((c) => c.readBusy);

    const results = await Promise.allSettled(
      readCalendars.map((cal) => cal.provider.getBusy(range))
    );

    const busyIntervals: TimeInterval[] = [];
    const failures: Array<{ calendar: string; error: Error }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const calendar = readCalendars[i];

      if (result.status === 'fulfilled') {
        busyIntervals.push(...result.value);
      } else {
        failures.push({
          calendar: calendar.name,
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        });
      }
    }

    return {
      success: failures.length === 0,
      busy: mergeIntervals(busyIntervals),
      failures: failures.length > 0 ? failures : undefined,
    };
  }

  async createEvent(input: CreateEventInput): Promise<{ externalId: string }> {
    const writeTarget = this.calendars.find((c) => c.writeTarget);

    if (!writeTarget) {
      throw new Error('No write-target calendar configured');
    }

    return writeTarget.provider.createEvent(input);
  }
}
