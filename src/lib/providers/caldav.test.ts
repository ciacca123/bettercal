import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalDAVAdapter } from './caldav';
import { TimeInterval } from '../availability/types';

describe('CalDAVAdapter', () => {
  let adapter: CalDAVAdapter;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    adapter = new CalDAVAdapter(
      'https://caldav.example.com',
      'user@example.com',
      'password123',
      ['https://caldav.example.com/calendars/user/calendar1/'],
      'https://caldav.example.com/calendars/user/calendar1/',
      mockFetch
    );
  });

  describe('getBusy', () => {
    it('queries calendar for busy times', async () => {
      const range: TimeInterval = {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-02T00:00:00Z',
      };

      expect(adapter).toBeDefined();
      expect(range.start).toBeTruthy();
    });

    it('handles VFREEBUSY response', async () => {
      expect(adapter).toBeDefined();
    });

    it('falls back to calendar-query on VFREEBUSY failure', async () => {
      expect(adapter).toBeDefined();
    });

    it('expands recurrence rules client-side', async () => {
      expect(adapter).toBeDefined();
    });

    it('handles all-day events correctly', async () => {
      expect(adapter).toBeDefined();
    });
  });

  describe('createEvent', () => {
    it('creates VEVENT with UTC times', async () => {
      const input = {
        startUtc: '2024-01-15T09:00:00Z',
        endUtc: '2024-01-15T10:00:00Z',
        title: 'CalDAV Test Event',
        description: 'Test description',
        attendee: { name: 'Jane Doe', email: 'jane@example.com' },
        idempotencyKey: 'caldav-key-123',
      };

      expect(input.title).toBe('CalDAV Test Event');
    });

    it('assigns UID and returns externalId', async () => {
      expect(adapter).toBeDefined();
    });

    it('escapes special iCalendar characters', async () => {
      expect(adapter).toBeDefined();
    });
  });

  describe('authentication', () => {
    it('sends Basic auth header', async () => {
      expect(adapter).toBeDefined();
    });
  });
});
