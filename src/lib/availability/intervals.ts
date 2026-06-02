import { TimeInterval } from './types';

export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start.localeCompare(b.start));

  const merged: TimeInterval[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // If current overlaps or is adjacent to last, merge them
    if (current.start <= last.end) {
      last.end = current.end > last.end ? current.end : last.end;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

export function subtractIntervals(
  interval: TimeInterval,
  toSubtract: TimeInterval[]
): TimeInterval[] {
  if (toSubtract.length === 0) return [interval];

  const merged = mergeIntervals(toSubtract);
  let result: TimeInterval[] = [interval];

  for (const sub of merged) {
    const next: TimeInterval[] = [];

    for (const current of result) {
      if (sub.end <= current.start || sub.start >= current.end) {
        // No overlap
        next.push(current);
      } else {
        // There's overlap; split the interval
        if (current.start < sub.start) {
          next.push({ start: current.start, end: sub.start });
        }
        if (sub.end < current.end) {
          next.push({ start: sub.end, end: current.end });
        }
      }
    }

    result = next;
  }

  return result;
}

export function overlapsInterval(
  interval: TimeInterval,
  other: TimeInterval
): boolean {
  return !(interval.end <= other.start || interval.start >= other.end);
}
