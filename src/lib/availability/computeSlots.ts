import { DateTime } from 'luxon';
import {
  DateOverride,
  EventType,
  SlotQuery,
  TimeInterval,
  WeeklyRule,
} from './types';
import { mergeIntervals, overlapsInterval } from './intervals';

function parseISODateString(iso: string): DateTime {
  const dt = DateTime.fromISO(iso, { zone: 'utc' });
  if (!dt.isValid) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return dt;
}

function buildDateOverrideMap(
  overrides: DateOverride[]
): Map<string, Array<{ startTime: string; endTime: string }>> {
  const map = new Map();
  for (const override of overrides) {
    map.set(override.date, override.intervals);
  }
  return map;
}

function buildWeeklyRuleMap(
  weekly: WeeklyRule[]
): Map<number, Array<{ startTime: string; endTime: string }>> {
  const map = new Map<number, Array<{ startTime: string; endTime: string }>>();
  for (const rule of weekly) {
    if (!map.has(rule.weekday)) {
      map.set(rule.weekday, []);
    }
    map.get(rule.weekday)!.push({ startTime: rule.startTime, endTime: rule.endTime });
  }
  return map;
}

function getWorkingIntervals(
  dateStr: string, // "YYYY-MM-DD"
  hostTz: string,
  overrideMap: Map<string, Array<{ startTime: string; endTime: string }>>,
  weeklyMap: Map<number, Array<{ startTime: string; endTime: string }>>
): TimeInterval[] {
  const overrides = overrideMap.get(dateStr);
  if (overrides !== undefined) {
    return overrides.map((interval) => {
      const start = DateTime.fromISO(`${dateStr}T${interval.startTime}:00`, {
        zone: hostTz,
      });
      const end = DateTime.fromISO(`${dateStr}T${interval.endTime}:00`, {
        zone: hostTz,
      });
      return {
        start: start.toUTC().toISO()!,
        end: end.toUTC().toISO()!,
      };
    });
  }

  const date = DateTime.fromISO(dateStr, { zone: hostTz });
  const luxonWeekday = date.weekday; // 1-7, where 1=Mon, 7=Sun
  const weekdayForMap = luxonWeekday === 7 ? 0 : luxonWeekday; // Map to our 0-6: Sun=0, Mon=1, ..., Sat=6

  const rules = weeklyMap.get(weekdayForMap);
  if (!rules || rules.length === 0) {
    return [];
  }

  return rules.map((rule) => {
    const start = DateTime.fromISO(`${dateStr}T${rule.startTime}:00`, {
      zone: hostTz,
    });
    const end = DateTime.fromISO(`${dateStr}T${rule.endTime}:00`, {
      zone: hostTz,
    });
    return {
      start: start.toUTC().toISO()!,
      end: end.toUTC().toISO()!,
    };
  });
}

export function computeAvailableSlots(query: SlotQuery): TimeInterval[] {
  const now = parseISODateString(query.now);
  const eventType = query.eventType;

  // 1. Compute window: earliest slot start is max(now, now + minNotice)
  const windowStart = now.plus({ minutes: eventType.minNoticeMin });
  const windowEnd = DateTime.fromISO(
    now.toISODate()!,
    { zone: query.hostTimeZone }
  )
    .plus({ days: eventType.rangeDays })
    .endOf('day')
    .toUTC();

  // 2. Build lookups
  const overrideMap = buildDateOverrideMap(query.overrides);
  const weeklyMap = buildWeeklyRuleMap(query.weekly);

  // 3. Collect all working intervals in the window
  const workingIntervals: TimeInterval[] = [];
  let current = DateTime.fromISO(windowStart.toISODate()!, {
    zone: query.hostTimeZone,
  });
  const endDateStr = DateTime.fromISO(windowEnd.toISODate()!, {
    zone: query.hostTimeZone,
  }).toISODate()!;

  while (current.toISODate()! <= endDateStr) {
    const dateStr = current.toISODate()!;
    const intervals = getWorkingIntervals(
      dateStr,
      query.hostTimeZone,
      overrideMap,
      weeklyMap
    );
    workingIntervals.push(...intervals);
    current = current.plus({ days: 1 });
  }

  // 4. Merge busy intervals
  const mergedBusy = mergeIntervals(query.busy);

  // 5. Generate candidate slots
  const slots: TimeInterval[] = [];

  for (const workingInterval of workingIntervals) {
    const workingStart = parseISODateString(workingInterval.start);
    const workingEnd = parseISODateString(workingInterval.end);

    // Start from the maximum of window start and working interval start
    let slotStart = workingStart > windowStart ? workingStart : windowStart;

    while (true) {
      const slotEnd = slotStart.plus({ minutes: eventType.durationMin });
      const bufferEnd = slotEnd.plus({ minutes: eventType.bufferAfterMin });

      // Check if slot + duration + after-buffer fits within working interval
      if (bufferEnd > workingEnd) {
        break;
      }

      // Check buffer constraints: [slotStart - bufferBefore, slotEnd + bufferAfter]
      const bufferStart = slotStart.minus({ minutes: eventType.bufferBeforeMin });

      let isAvailable = true;
      for (const busyInterval of mergedBusy) {
        const busyStart = parseISODateString(busyInterval.start);
        const busyEnd = parseISODateString(busyInterval.end);

        // Check if buffered slot overlaps with busy
        if (
          overlapsInterval(
            { start: bufferStart.toISO()!, end: bufferEnd.toISO()! },
            busyInterval
          )
        ) {
          isAvailable = false;
          break;
        }
      }

      if (isAvailable) {
        slots.push({
          start: slotStart.toISO()!,
          end: slotEnd.toISO()!,
        });
      }

      slotStart = slotStart.plus({ minutes: eventType.slotIntervalMin });
    }
  }

  // 6. Sort and deduplicate
  const sorted = slots.sort((a, b) => a.start.localeCompare(b.start));
  const deduped: TimeInterval[] = [];
  for (const slot of sorted) {
    if (
      deduped.length === 0 ||
      deduped[deduped.length - 1].start !== slot.start
    ) {
      deduped.push(slot);
    }
  }

  return deduped;
}
