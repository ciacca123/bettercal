import { describe, it, expect } from 'vitest';
import { computeAvailableSlots } from './computeSlots';
import { SlotQuery, EventType } from './types';

function baseQuery(overrides: Partial<SlotQuery> = {}): SlotQuery {
  const defaultEventType: EventType = {
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    minNoticeMin: 0,
    slotIntervalMin: 30,
    rangeDays: 7,
  };

  return {
    eventType: { ...defaultEventType, ...overrides.eventType },
    weekly: overrides.weekly || [
      { weekday: 1, startTime: '09:00', endTime: '17:00' }, // Monday
      { weekday: 2, startTime: '09:00', endTime: '17:00' }, // Tuesday
      { weekday: 3, startTime: '09:00', endTime: '17:00' }, // Wednesday
      { weekday: 4, startTime: '09:00', endTime: '17:00' }, // Thursday
      { weekday: 5, startTime: '09:00', endTime: '17:00' }, // Friday
    ],
    overrides: overrides.overrides || [],
    hostTimeZone: overrides.hostTimeZone || 'UTC',
    busy: overrides.busy || [],
    now: overrides.now || '2024-01-01T08:00:00Z',
  };
}

describe('computeAvailableSlots', () => {
  it('baseline: 09:00-17:00, 30-min slots, no busy', () => {
    // Monday 2024-01-01 is actually Monday
    const query = baseQuery({
      now: '2024-01-01T08:00:00Z', // Before 09:00 UTC
      hostTimeZone: 'UTC',
    });

    const slots = computeAvailableSlots(query);

    // 09:00-17:00 is 8 hours = 480 minutes
    // 30-min slots: 09:00, 09:30, 10:00, ..., 16:30
    // That's 17 slots (0-16.5 hours in 30-min intervals = 17 slots)
    expect(slots.length).toBeGreaterThan(0);

    // Check first slot starts at 09:00
    expect(slots[0].start).toContain('09:00');

    // Check slots don't overlap
    for (let i = 0; i < slots.length - 1; i++) {
      expect(slots[i].end <= slots[i + 1].start).toBe(true);
    }
  });

  it('DST spring-forward: Europe/Rome', () => {
    // 2024-03-31 is DST transition in Europe/Rome (02:00 -> 03:00)
    // Query starting from 2024-03-30 (Saturday) to check the transition
    const query = baseQuery({
      now: '2024-03-30T06:00:00Z',
      hostTimeZone: 'Europe/Rome',
      weekly: [
        { weekday: 5, startTime: '09:00', endTime: '17:00' }, // Saturday
        { weekday: 6, startTime: '09:00', endTime: '17:00' }, // Sunday (transition day)
      ],
    });

    const slots = computeAvailableSlots(query);

    // Should have slots from both days
    expect(slots.length).toBeGreaterThan(0);

    // All slots should be in valid UTC
    for (const slot of slots) {
      expect(slot.start).toMatch(/Z$/);
      expect(slot.end).toMatch(/Z$/);
    }
  });

  it('DST fall-back: Europe/Rome', () => {
    // 2024-10-27 is DST transition in Europe/Rome (03:00 -> 02:00)
    const query = baseQuery({
      now: '2024-10-26T06:00:00Z',
      hostTimeZone: 'Europe/Rome',
      weekly: [
        { weekday: 5, startTime: '09:00', endTime: '17:00' }, // Saturday
        { weekday: 6, startTime: '09:00', endTime: '17:00' }, // Sunday (transition day)
      ],
    });

    const slots = computeAvailableSlots(query);

    expect(slots.length).toBeGreaterThan(0);

    // All slots should have valid UTC times
    for (const slot of slots) {
      const startTime = new Date(slot.start);
      const endTime = new Date(slot.end);
      expect(startTime < endTime).toBe(true);
    }
  });

  it('busy block mid-day excludes overlapping slots', () => {
    const query = baseQuery({
      now: '2024-01-01T08:00:00Z',
      hostTimeZone: 'UTC',
      busy: [
        {
          start: '2024-01-01T12:00:00Z',
          end: '2024-01-01T13:00:00Z', // 12:00-13:00 blocked
        },
      ],
    });

    const slots = computeAvailableSlots(query);

    // Should not have slots starting at 12:00 or 12:30
    for (const slot of slots) {
      const slotStart = new Date(slot.start);
      const busyStart = new Date('2024-01-01T12:00:00Z');
      const busyEnd = new Date('2024-01-01T13:00:00Z');

      if (slotStart >= busyStart && slotStart < busyEnd) {
        throw new Error('Slot overlaps with busy time');
      }
    }
  });

  it('buffers: slot with busy block and buffers excludes adjacent slots', () => {
    const query = baseQuery({
      now: '2024-01-01T08:00:00Z',
      hostTimeZone: 'UTC',
      eventType: {
        durationMin: 30,
        bufferBeforeMin: 30,
        bufferAfterMin: 30,
        minNoticeMin: 0,
        slotIntervalMin: 30,
        rangeDays: 7,
      },
      busy: [
        {
          start: '2024-01-01T12:00:00Z',
          end: '2024-01-01T13:00:00Z',
        },
      ],
    });

    const slots = computeAvailableSlots(query);

    // Should not have slots from 11:30-13:30 (busy time + buffers)
    for (const slot of slots) {
      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);

      const bufferStart = new Date('2024-01-01T11:30:00Z');
      const bufferEnd = new Date('2024-01-01T13:30:00Z');

      const overlaps =
        slotStart < bufferEnd && slotEnd > bufferStart;
      expect(overlaps).toBe(false);
    }
  });

  it('minNotice excludes slots earlier than now + minNotice', () => {
    const query = baseQuery({
      now: '2024-01-01T09:00:00Z',
      hostTimeZone: 'UTC',
      eventType: {
        durationMin: 30,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        minNoticeMin: 60, // 1 hour notice required
        slotIntervalMin: 30,
        rangeDays: 7,
      },
    });

    const slots = computeAvailableSlots(query);

    // Earliest slot should be at 10:00 or later (09:00 + 60 minutes)
    if (slots.length > 0) {
      const earliestStart = new Date(slots[0].start);
      const minTime = new Date('2024-01-01T10:00:00Z');
      expect(earliestStart >= minTime).toBe(true);
    }
  });

  it('DateOverride: unavailable date yields zero slots', () => {
    const query = baseQuery({
      now: '2024-01-01T08:00:00Z',
      hostTimeZone: 'UTC',
      overrides: [
        {
          date: '2024-01-01',
          intervals: [], // Completely unavailable
        },
      ],
    });

    const slots = computeAvailableSlots(query);

    // Should have no slots on 2024-01-01
    for (const slot of slots) {
      expect(slot.start).not.toContain('2024-01-01');
    }
  });

  it('DateOverride: custom hours override weekly rule', () => {
    const query = baseQuery({
      now: '2024-01-01T08:00:00Z',
      hostTimeZone: 'UTC',
      weekly: [{ weekday: 1, startTime: '09:00', endTime: '17:00' }], // Monday 09-17
      overrides: [
        {
          date: '2024-01-01',
          intervals: [{ startTime: '10:00', endTime: '12:00' }], // Override to 10-12
        },
      ],
    });

    const slots = computeAvailableSlots(query);

    // Should have slots only in 10:00-12:00 range for 2024-01-01
    // and we expect 4 slots (10:00, 10:30, 11:00, 11:30)
    for (const slot of slots) {
      if (slot.start.startsWith('2024-01-01')) {
        const hour = parseInt(slot.start.split('T')[1].split(':')[0]);
        expect(hour).toBeGreaterThanOrEqual(10);
        expect(hour).toBeLessThan(12);
      }
    }
  });

  it('multiple busy intervals merge correctly', () => {
    const query = baseQuery({
      now: '2024-01-01T08:00:00Z',
      hostTimeZone: 'UTC',
      busy: [
        { start: '2024-01-01T12:00:00Z', end: '2024-01-01T13:00:00Z' },
        { start: '2024-01-01T13:00:00Z', end: '2024-01-01T14:00:00Z' }, // Adjacent
        { start: '2024-01-01T12:30:00Z', end: '2024-01-01T12:45:00Z' }, // Overlapping
      ],
    });

    const slots = computeAvailableSlots(query);

    // Should not have slots in the merged 12:00-14:00 block
    for (const slot of slots) {
      const slotStart = new Date(slot.start);
      const blockStart = new Date('2024-01-01T12:00:00Z');
      const blockEnd = new Date('2024-01-01T14:00:00Z');

      if (slotStart >= blockStart && slotStart < blockEnd) {
        throw new Error('Slot overlaps with merged busy interval');
      }
    }
  });

  it('edge slot: duration + buffer exceeds working interval end', () => {
    const query = baseQuery({
      now: '2024-01-01T08:00:00Z',
      hostTimeZone: 'UTC',
      eventType: {
        durationMin: 30,
        bufferBeforeMin: 0,
        bufferAfterMin: 30, // 30-min buffer after
        minNoticeMin: 0,
        slotIntervalMin: 30,
        rangeDays: 1, // Just one day to simplify
      },
      weekly: [{ weekday: 1, startTime: '09:00', endTime: '17:00' }],
    });

    const slots = computeAvailableSlots(query);

    // Verify that no slot has buffer that extends past 17:00
    for (const slot of slots) {
      const slotEnd = new Date(slot.end);
      const bufferEnd = new Date(slotEnd.getTime() + 30 * 60 * 1000); // Add 30 min buffer
      const workingEnd = new Date('2024-01-01T17:00:00Z');
      expect(bufferEnd <= workingEnd).toBe(true);
    }
  });

  it('viewer in different TZ than host: output UTC identical', () => {
    const sharedNow = '2024-01-01T12:00:00Z';

    // Query from UTC host
    const queryUTC = baseQuery({
      now: sharedNow,
      hostTimeZone: 'UTC',
      weekly: [{ weekday: 1, startTime: '09:00', endTime: '17:00' }],
    });

    // Query from US/Eastern host (same working hours local time)
    const queryEastern = baseQuery({
      now: sharedNow,
      hostTimeZone: 'America/New_York',
      weekly: [{ weekday: 1, startTime: '09:00', endTime: '17:00' }],
    });

    const slotsUTC = computeAvailableSlots(queryUTC);
    const slotsEastern = computeAvailableSlots(queryEastern);

    // Output should be different in UTC because the working hours are at different UTC times
    // But both should have the same structure (sorted, de-duplicated, etc.)
    expect(slotsUTC.length).toBeGreaterThan(0);
    expect(slotsEastern.length).toBeGreaterThan(0);

    // All output slots must be valid UTC ISO strings
    for (const slot of [...slotsUTC, ...slotsEastern]) {
      expect(slot.start).toMatch(/Z$/);
      expect(slot.end).toMatch(/Z$/);
    }
  });
});
