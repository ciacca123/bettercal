import { db } from '@/db/db';
import {
  eventTypes,
  weeklyAvailability,
  dateOverrides,
  bookings,
  users,
} from '@/db/schema';
import { eq, and, inArray, gt, lt } from 'drizzle-orm';
import { computeAvailableSlots } from '@/lib/availability/computeSlots';
import { TimeInterval } from '@/lib/availability/types';
import { getCalendarProvider } from '@/lib/calendarProvider';
import { getCachedBusy } from '@/lib/calendarCache';

export interface SlotsResult {
  slots: TimeInterval[];
  warning?: { type: 'partial_failure'; failures: string[] };
}

export async function getSlots(
  userId: string,
  eventSlug: string,
  rangeStart: string,
  rangeEnd: string
): Promise<SlotsResult> {
  const eventType = await db.query.eventTypes.findFirst({
    where: and(eq(eventTypes.userId, userId), eq(eventTypes.slug, eventSlug)),
  });
  if (!eventType) throw new Error('Event type not found');

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error('User not found');

  const weekly = await db.query.weeklyAvailability.findMany({
    where: eq(weeklyAvailability.userId, userId),
  });
  const overrides = await db.query.dateOverrides.findMany({
    where: eq(dateOverrides.userId, userId),
  });

  let externalBusy: TimeInterval[] = [];
  try {
    const cacheKey = `${userId}:${rangeStart}:${rangeEnd}`;
    externalBusy = await getCachedBusy(cacheKey, () =>
      getCalendarProvider().getBusy({ start: rangeStart, end: rangeEnd })
    );
  } catch (err) {
    console.error('[calendar] getBusy failed, proceeding without external busy:', err);
  }

  // Existing active bookings (any of this host's event types) also block time,
  // so a booked slot never reappears as available.
  const hostEventTypeIds = (
    await db.query.eventTypes.findMany({
      where: eq(eventTypes.userId, userId),
      columns: { id: true },
    })
  ).map((e) => e.id);

  const bookedBusy =
    hostEventTypeIds.length > 0
      ? (
          await db.query.bookings.findMany({
            where: and(
              inArray(bookings.eventTypeId, hostEventTypeIds),
              inArray(bookings.status, ['pending', 'confirmed']),
              lt(bookings.startUtc, new Date(rangeEnd)),
              gt(bookings.endUtc, new Date(rangeStart))
            ),
          })
        ).map((b) => ({
          start: b.startUtc.toISOString(),
          end: b.endUtc.toISOString(),
        }))
      : [];

  const busy = [...externalBusy, ...bookedBusy];

  const slots = computeAvailableSlots({
    eventType: {
      durationMin: eventType.durationMin,
      bufferBeforeMin: eventType.bufferBeforeMin,
      bufferAfterMin: eventType.bufferAfterMin,
      minNoticeMin: eventType.minNoticeMin,
      slotIntervalMin: eventType.slotIntervalMin,
      rangeDays: eventType.rangeDays,
    },
    weekly: weekly.map((w) => ({
      weekday: w.weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      startTime: w.startTime,
      endTime: w.endTime,
    })),
    overrides: overrides.map((o) => ({
      date: o.date,
      intervals: o.intervals ?? [],
    })),
    busy,
    hostTimeZone: user.timeZone,
    now: new Date().toISOString(),
  });

  return { slots };
}
