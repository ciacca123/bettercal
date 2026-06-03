'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { DateTime } from 'luxon';
import { bookSlotAction } from '@/app/actions';

interface Slot {
  start: string;
  end: string;
}

const COMMON_ZONES = [
  'UTC',
  'Europe/Rome',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function BookingFlow({
  username,
  slug,
  durationMin,
  slots: initialSlots,
}: {
  username: string;
  slug: string;
  durationMin: number;
  slots: Slot[];
}) {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [tz, setTz] = useState(detected);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Slot | null>(null);
  const [pending, startTransition] = useTransition();

  const slotsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Notify parent of height changes for iframe embedding.
  useEffect(() => {
    const sendHeight = () =>
      window.parent.postMessage(
        { type: 'betterCal:resize', height: document.body.scrollHeight },
        '*'
      );
    sendHeight();
    const ro = new ResizeObserver(sendHeight);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  // Scroll to slot list when a date is picked.
  useEffect(() => {
    if (!selectedDate) return;
    slotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.parent.postMessage({ type: 'betterCal:step', step: 'slots' }, '*');
  }, [selectedDate]);

  // Scroll to booking form when a slot is picked.
  useEffect(() => {
    if (!selectedSlot) return;
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.parent.postMessage({ type: 'betterCal:step', step: 'form' }, '*');
  }, [selectedSlot]);

  const tzOptions = useMemo(
    () => Array.from(new Set([detected, ...COMMON_ZONES])),
    [detected]
  );

  // Group slots by calendar date (yyyy-MM-dd) in the viewer's timezone.
  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = DateTime.fromISO(s.start).setZone(tz).toFormat('yyyy-MM-dd');
      const arr = map.get(key);
      if (arr) arr.push(s);
      else map.set(key, [s]);
    }
    return map;
  }, [slots, tz]);

  const availableDates = useMemo(() => new Set(byDate.keys()), [byDate]);
  const firstAvailable = useMemo(
    () => Array.from(byDate.keys()).sort()[0] ?? null,
    [byDate]
  );

  const today = DateTime.now().setZone(tz).startOf('day');
  const monthOf = (key: string | null) =>
    (key ? DateTime.fromFormat(key, 'yyyy-MM-dd', { zone: tz }) : today).startOf(
      'month'
    );

  const [viewMonth, setViewMonth] = useState(() => monthOf(firstAvailable));
  const [focusedDate, setFocusedDate] = useState<string>(
    () => firstAvailable ?? today.toFormat('yyyy-MM-dd')
  );

  // Reset the view when the viewer switches timezone (dates regroup).
  useEffect(() => {
    setSelectedDate(null);
    setSelectedSlot(null);
    setViewMonth(monthOf(firstAvailable));
    setFocusedDate(firstAvailable ?? today.toFormat('yyyy-MM-dd'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tz]);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const minMonth = monthOf(today.toFormat('yyyy-MM-dd'));
  const lastAvailable = useMemo(() => {
    const keys = Array.from(byDate.keys()).sort();
    return keys.length ? keys[keys.length - 1] : null;
  }, [byDate]);
  const maxMonth = monthOf(lastAvailable);

  const fmtTime = (iso: string) =>
    DateTime.fromISO(iso).setZone(tz).toFormat('HH:mm');

  function submit() {
    if (!selectedSlot) return;
    setFormError(null);
    startTransition(async () => {
      const res = await bookSlotAction({
        username,
        slug,
        startUtc: selectedSlot.start,
        endUtc: selectedSlot.end,
        name,
        email,
        timezone: tz,
      });
      if (res.success) {
        setConfirmed(selectedSlot);
      } else if (res.error?.includes('just booked')) {
        // Someone else took it — drop it and bounce back to the list.
        setSlots((prev) => prev.filter((s) => s.start !== selectedSlot.start));
        setSelectedSlot(null);
        setToast(res.error);
      } else {
        setFormError(res.error ?? 'Something went wrong');
      }
    });
  }

  // ---- Confirmation screen ----
  if (confirmed) {
    const start = DateTime.fromISO(confirmed.start).setZone(tz);
    const end = DateTime.fromISO(confirmed.end).setZone(tz);
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl" aria-hidden>
          🎉
        </div>
        <h2 className="text-xl font-semibold text-neutral-900">Booking confirmed</h2>
        <p className="text-neutral-500">
          {start.toFormat('cccc, dd LLLL yyyy')}
          <br />
          {start.toFormat('HH:mm')}–{end.toFormat('HH:mm')} ({tz})
        </p>
        <p className="text-sm text-neutral-500">
          A confirmation was sent to {email} (printed to the server console in this demo).
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <a
            href={googleCalendarUrl(slug, confirmed)}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Add to Google
          </a>
          <a
            href={icsDataUri(slug, confirmed)}
            download="booking.ics"
            className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Download .ics
          </a>
        </div>
      </div>
    );
  }

  // ---- Booking form ----
  if (selectedSlot) {
    return (
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <button
          type="button"
          onClick={() => {
            setSelectedSlot(null);
            setFormError(null);
          }}
          className="text-sm text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          ← Back
        </button>
        <p className="text-sm text-neutral-500">
          {DateTime.fromISO(selectedSlot.start).setZone(tz).toFormat('cccc, dd LLL')} ·{' '}
          {fmtTime(selectedSlot.start)}–{fmtTime(selectedSlot.end)} · {durationMin} min ·{' '}
          {tz}
        </p>
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={formError ? 'true' : undefined}
            aria-describedby={formError ? 'form-error' : undefined}
            className="w-full rounded border border-neutral-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>
        {formError && (
          <p id="form-error" role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {pending ? 'Booking…' : 'Confirm booking'}
        </button>
      </form>
    );
  }

  // ---- Calendar + time picker ----
  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast(null)} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Select a time</h2>
        <select
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Timezone"
        >
          {tzOptions.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </div>

      {availableDates.size === 0 ? (
        <p className="py-10 text-center text-neutral-500">
          No availability in the next two weeks.
        </p>
      ) : (
        <>
          <MonthCalendar
            tz={tz}
            viewMonth={viewMonth}
            minMonth={minMonth}
            maxMonth={maxMonth}
            today={today}
            availableDates={availableDates}
            selectedDate={selectedDate}
            focusedDate={focusedDate}
            onChangeMonth={(m) => {
              setViewMonth(m);
              setFocusedDate(m.toFormat('yyyy-MM-dd'));
            }}
            onFocusDate={setFocusedDate}
            onSelectDate={(d) => {
              setSelectedDate(d);
              setSelectedSlot(null);
            }}
          />

          {selectedDate && (
            <div ref={slotsRef}>
              <h3 className="mb-2 text-sm font-medium text-neutral-900">
                {DateTime.fromFormat(selectedDate, 'yyyy-MM-dd', { zone: tz }).toFormat(
                  'cccc, dd LLLL'
                )}
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(byDate.get(selectedDate) ?? []).map((s) => (
                  <button
                    key={s.start}
                    onClick={() => {
                      setSelectedSlot(s);
                      setFormError(null);
                    }}
                    className="rounded border border-neutral-300 px-2 py-2 text-sm hover:border-neutral-900 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {fmtTime(s.start)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function MonthCalendar({
  tz,
  viewMonth,
  minMonth,
  maxMonth,
  today,
  availableDates,
  selectedDate,
  focusedDate,
  onChangeMonth,
  onFocusDate,
  onSelectDate,
}: {
  tz: string;
  viewMonth: DateTime;
  minMonth: DateTime;
  maxMonth: DateTime;
  today: DateTime;
  availableDates: Set<string>;
  selectedDate: string | null;
  focusedDate: string;
  onChangeMonth: (m: DateTime) => void;
  onFocusDate: (d: string) => void;
  onSelectDate: (d: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const daysInMonth = viewMonth.daysInMonth!;
  const leadingBlanks = viewMonth.weekday % 7; // Sunday-start columns
  const canPrev = viewMonth > minMonth;
  const canNext = viewMonth < maxMonth;

  const key = (day: number) => viewMonth.set({ day }).toFormat('yyyy-MM-dd');

  function moveFocus(delta: number) {
    const current = DateTime.fromFormat(focusedDate, 'yyyy-MM-dd', { zone: tz });
    const next = current.plus({ days: delta });
    if (next.startOf('month').toMillis() !== viewMonth.toMillis()) return; // stay in month
    const k = next.toFormat('yyyy-MM-dd');
    onFocusDate(k);
    requestAnimationFrame(() =>
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${k}"]`)?.focus()
    );
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const map: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in map) {
      e.preventDefault();
      moveFocus(map[e.key]);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => canPrev && onChangeMonth(viewMonth.minus({ months: 1 }))}
          disabled={!canPrev}
          aria-label="Previous month"
          className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-neutral-900" aria-live="polite">
          {viewMonth.toFormat('LLLL yyyy')}
        </span>
        <button
          type="button"
          onClick={() => canNext && onChangeMonth(viewMonth.plus({ months: 1 }))}
          disabled={!canNext}
          aria-label="Next month"
          className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-400">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label="Choose a date"
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-1"
      >
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const k = key(day);
          const dt = viewMonth.set({ day });
          const isPast = dt < today;
          const isAvailable = availableDates.has(k) && !isPast;
          const isSelected = k === selectedDate;
          const isToday = dt.toMillis() === today.toMillis();
          return (
            <button
              key={k}
              type="button"
              data-date={k}
              tabIndex={k === focusedDate ? 0 : -1}
              aria-pressed={isSelected}
              aria-disabled={!isAvailable}
              aria-label={dt.toFormat('cccc, dd LLLL yyyy')}
              onFocus={() => onFocusDate(k)}
              onClick={() => isAvailable && onSelectDate(k)}
              className={[
                'aspect-square rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                isSelected
                  ? 'bg-neutral-900 text-white'
                  : isAvailable
                    ? 'text-neutral-900 hover:bg-neutral-100'
                    : 'cursor-default text-neutral-300',
                isToday && !isSelected ? 'ring-1 ring-inset ring-blue-400' : '',
              ].join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toast({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed right-4 top-4 z-50 flex max-w-xs items-start gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm shadow-sm"
    >
      <span className="text-neutral-900">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="text-neutral-400 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        ✕
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function toICalStamp(iso: string): string {
  return DateTime.fromISO(iso).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
}

function googleCalendarUrl(title: string, slot: Slot): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toICalStamp(slot.start)}/${toICalStamp(slot.end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsDataUri(title: string, slot: Slot): string {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BetterCal//EN',
    'BEGIN:VEVENT',
    `DTSTART:${toICalStamp(slot.start)}`,
    `DTEND:${toICalStamp(slot.end)}`,
    `SUMMARY:${title}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
