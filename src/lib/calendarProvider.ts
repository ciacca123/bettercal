import { CalDAVAdapter } from './providers/caldav';
import { mockCalendar } from './mockCalendar';
import type { CalendarProvider } from './availability/types';

export function getCalendarProvider(): CalendarProvider {
  const { CALDAV_URL, CALDAV_USERNAME, CALDAV_PASSWORD, CALDAV_CALENDAR } = process.env;

  if (CALDAV_URL && CALDAV_USERNAME && CALDAV_PASSWORD && CALDAV_CALENDAR) {
    const base = CALDAV_URL.replace(/\/$/, '');
    const calendarUrl = `${base}/calendars/${CALDAV_USERNAME}/${CALDAV_CALENDAR}/`;
    console.log('[calendar] CalDAV provider active, calendar URL:', calendarUrl);
    return new CalDAVAdapter(
      CALDAV_URL,
      CALDAV_USERNAME,
      CALDAV_PASSWORD,
      [calendarUrl],
      calendarUrl
    );
  }

  return mockCalendar;
}
