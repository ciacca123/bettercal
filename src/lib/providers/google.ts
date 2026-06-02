import { calendar_v3, google } from 'googleapis';
import { DateTime } from 'luxon';
import { TimeInterval, CreateEventInput, CalendarProvider } from '../availability/types';
import { mergeIntervals } from '../availability/intervals';

export class GoogleCalendarAdapter implements CalendarProvider {
  private calendar: calendar_v3.Calendar;
  private getAccessToken: () => Promise<string>;
  private readCalendarIds: string[];
  private writeCalendarId: string;
  private httpClient: typeof fetch;

  constructor(
    getAccessToken: () => Promise<string>,
    readCalendarIds: string[],
    writeCalendarId: string,
    httpClient: typeof fetch = fetch
  ) {
    this.getAccessToken = getAccessToken;
    this.readCalendarIds = readCalendarIds;
    this.writeCalendarId = writeCalendarId;
    this.httpClient = httpClient;

    this.calendar = google.calendar({ version: 'v3' });
  }

  async getBusy(range: TimeInterval): Promise<TimeInterval[]> {
    const accessToken = await this.getAccessToken();

    const requestBody = {
      timeMin: range.start,
      timeMax: range.end,
      items: this.readCalendarIds.map((id) => ({ id })),
    };

    try {
      const response = await this.calendar.freebusy.query(
        { requestBody },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const busyIntervals: TimeInterval[] = [];

      if (response.data.calendars) {
        for (const calendarId of this.readCalendarIds) {
          const calendarBusy = response.data.calendars[calendarId];
          if (calendarBusy && calendarBusy.busy) {
            for (const busy of calendarBusy.busy) {
              if (busy.start && busy.end) {
                busyIntervals.push({
                  start: new Date(busy.start).toISOString(),
                  end: new Date(busy.end).toISOString(),
                });
              }
            }
          }
        }
      }

      return mergeIntervals(busyIntervals);
    } catch (error: any) {
      if (error.status === 401) {
        const newAccessToken = await this.getAccessToken();
        const retryResponse = await this.calendar.freebusy.query(
          { requestBody },
          { headers: { Authorization: `Bearer ${newAccessToken}` } }
        );

        const busyIntervals: TimeInterval[] = [];

        if (retryResponse.data.calendars) {
          for (const calendarId of this.readCalendarIds) {
            const calendarBusy = retryResponse.data.calendars[calendarId];
            if (calendarBusy && calendarBusy.busy) {
              for (const busy of calendarBusy.busy) {
                if (busy.start && busy.end) {
                  busyIntervals.push({
                    start: new Date(busy.start).toISOString(),
                    end: new Date(busy.end).toISOString(),
                  });
                }
              }
            }
          }
        }

        return mergeIntervals(busyIntervals);
      }

      throw error;
    }
  }

  async createEvent(input: CreateEventInput): Promise<{ externalId: string }> {
    const accessToken = await this.getAccessToken();

    const event: calendar_v3.Schema$Event = {
      summary: input.title,
      description: input.description,
      start: {
        dateTime: input.startUtc,
        timeZone: 'UTC',
      },
      end: {
        dateTime: input.endUtc,
        timeZone: 'UTC',
      },
      attendees: [
        {
          email: input.attendee.email,
          displayName: input.attendee.name,
        },
      ],
    };

    try {
      const response = await this.calendar.events.insert(
        {
          calendarId: this.writeCalendarId,
          requestBody: event,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Idempotency-Key': input.idempotencyKey,
          },
        }
      );

      return { externalId: response.data.id || '' };
    } catch (error: any) {
      if (error.status === 401) {
        const newAccessToken = await this.getAccessToken();
        const retryResponse = await this.calendar.events.insert(
          {
            calendarId: this.writeCalendarId,
            requestBody: event,
          },
          {
            headers: {
              Authorization: `Bearer ${newAccessToken}`,
              'Idempotency-Key': input.idempotencyKey,
            },
          }
        );

        return { externalId: retryResponse.data.id || '' };
      }

      throw error;
    }
  }
}
