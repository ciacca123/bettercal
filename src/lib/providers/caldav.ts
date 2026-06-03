import { DateTime } from 'luxon';
import { TimeInterval, CreateEventInput, CalendarProvider } from '../availability/types';
import { mergeIntervals } from '../availability/intervals';
import ICAL from 'ical.js';

export class CalDAVAdapter implements CalendarProvider {
  private serverUrl: string;
  private username: string;
  private password: string;
  private readCalendarUrls: string[];
  private writeCalendarUrl: string;
  private httpClient: typeof fetch;

  constructor(
    serverUrl: string,
    username: string,
    password: string,
    readCalendarUrls: string[],
    writeCalendarUrl: string,
    httpClient: typeof fetch = fetch
  ) {
    this.serverUrl = serverUrl;
    this.username = username;
    this.password = password;
    this.readCalendarUrls = readCalendarUrls;
    this.writeCalendarUrl = writeCalendarUrl;
    this.httpClient = httpClient;
  }

  private getAuthHeader(): string {
    const credentials = `${this.username}:${this.password}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  async getBusy(range: TimeInterval): Promise<TimeInterval[]> {
    return this.getBusyFromCalendars(range);
  }

  private async getBusyFromCalendars(range: TimeInterval): Promise<TimeInterval[]> {
    const busyIntervals: TimeInterval[] = [];

    for (const calendarUrl of this.readCalendarUrls) {
      try {
        const intervals = await this.queryCalendarBusy(calendarUrl, range);
        busyIntervals.push(...intervals);
      } catch (error) {
        // Fallback to calendar-query if VFREEBUSY fails
        const intervals = await this.queryCalendarEvents(calendarUrl, range);
        busyIntervals.push(...intervals);
      }
    }

    return mergeIntervals(busyIntervals);
  }

  private async queryCalendarBusy(
    calendarUrl: string,
    range: TimeInterval
  ): Promise<TimeInterval[]> {
    const vfreebusy = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BetterCal//EN
BEGIN:VFREEBUSY
DTSTART:${DateTime.fromISO(range.start).toISO()}
DTEND:${DateTime.fromISO(range.end).toISO()}
END:VFREEBUSY
END:VCALENDAR`;

    const response = await this.httpClient(calendarUrl, {
      method: 'REPORT',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'text/calendar',
      },
      body: vfreebusy,
    });

    if (!response.ok) {
      throw new Error(`VFREEBUSY query failed: ${response.status}`);
    }

    const text = await response.text();
    return this.parseVFREEBUSY(text);
  }

  private parseVFREEBUSY(ical: string): TimeInterval[] {
    try {
      const jcalData = ICAL.parse(ical);
      const component = new ICAL.Component(jcalData);
      const busyIntervals: TimeInterval[] = [];

      const freebusy = component.getFirstSubcomponent('vfreebusy');
      if (freebusy) {
        const busyProperty = freebusy.getFirstPropertyValue('freebusy');
        if (busyProperty) {
          const periods = Array.isArray(busyProperty) ? busyProperty : [busyProperty];
          for (const period of periods) {
            if (period && typeof period === 'object' && 'start' in period && 'end' in period) {
              busyIntervals.push({
                start: (period.start as any).toJSDate().toISOString(),
                end: (period.end as any).toJSDate().toISOString(),
              });
            }
          }
        }
      }

      return busyIntervals;
    } catch {
      return [];
    }
  }

  private async queryCalendarEvents(
    calendarUrl: string,
    range: TimeInterval
  ): Promise<TimeInterval[]> {
    const response = await this.httpClient(calendarUrl, {
      method: 'REPORT',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/xml',
        'Depth': '1',
      },
      body: `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${DateTime.fromISO(range.start).toUTC().toFormat("yyyyMMdd'T'HHmmss") + 'Z'}" end="${DateTime.fromISO(range.end).toUTC().toFormat("yyyyMMdd'T'HHmmss") + 'Z'}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[caldav] calendar-query failed ${response.status}:`, body.slice(0, 300));
      throw new Error(`Calendar query failed: ${response.status}`);
    }

    const text = await response.text();
    return this.parseCalendarEvents(text);
  }

  private parseCalendarEvents(xmlResponse: string): TimeInterval[] {
    const busyIntervals: TimeInterval[] = [];

    // Simple XML parsing for calendar-data
    const eventMatches = xmlResponse.match(/<C:calendar-data>([^<]+)<\/C:calendar-data>/g);
    if (!eventMatches) {
      return busyIntervals;
    }

    for (const match of eventMatches) {
      const icalText = match.replace(/<\/?C:calendar-data>/g, '');
      try {
        const jcalData = ICAL.parse(icalText);
        const component = new ICAL.Component(jcalData);
        const vevent = component.getFirstSubcomponent('vevent');

        if (vevent) {
          const dtstart = vevent.getFirstPropertyValue('dtstart');
          const dtend = vevent.getFirstPropertyValue('dtend');
          const rrule = vevent.getFirstPropertyValue('rrule');

          if (dtstart && dtend) {
            const start = (dtstart as any).toJSDate();
            const end = (dtend as any).toJSDate();

            if (rrule) {
              // Expand recurrence
              const expanded = this.expandRecurrence(start, end, rrule);
              busyIntervals.push(...expanded);
            } else {
              busyIntervals.push({
                start: start.toISOString(),
                end: end.toISOString(),
              });
            }
          }
        }
      } catch {
        // Skip malformed events
        continue;
      }
    }

    return busyIntervals;
  }

  private expandRecurrence(
    start: Date,
    end: Date,
    rrule: any
  ): TimeInterval[] {
    const intervals: TimeInterval[] = [];
    const iterator = rrule.iterator(start);
    let occurrence = iterator.next();
    const maxDate = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year limit

    while (occurrence && occurrence < maxDate) {
      const duration = end.getTime() - start.getTime();
      const occurrenceEnd = new Date(occurrence.getTime() + duration);

      intervals.push({
        start: occurrence.toISOString(),
        end: occurrenceEnd.toISOString(),
      });

      occurrence = iterator.next();
    }

    return intervals;
  }

  async createEvent(input: CreateEventInput): Promise<{ externalId: string }> {
    const uid = `${Date.now()}-${Math.random().toString(36).substring(7)}@bettercal`;

    const vevent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BetterCal//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${DateTime.utc().toISO()}
DTSTART:${input.startUtc}
DTEND:${input.endUtc}
SUMMARY:${this.escapeICalText(input.title)}
DESCRIPTION:${this.escapeICalText(input.description || '')}
ORGANIZER;CN="${this.escapeICalText(input.attendee.name)}":mailto:${input.attendee.email}
ATTENDEE;CN="${this.escapeICalText(input.attendee.name)}":mailto:${input.attendee.email}
END:VEVENT
END:VCALENDAR`;

    const eventPath = `${this.writeCalendarUrl}/${uid}.ics`;

    const response = await this.httpClient(eventPath, {
      method: 'PUT',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'text/calendar',
      },
      body: vevent,
    });

    if (!response.ok) {
      throw new Error(`Event creation failed: ${response.status}`);
    }

    return { externalId: uid };
  }

  private escapeICalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  }
}
