import { db } from '@/db/db';
import { bookings, eventTypes, connectedCalendars, users } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { getSlots } from './slots';
import { mockCalendar } from './mockCalendar';
import { sendBookingConfirmation, sendHostNotification } from './email';

export interface CreateBookingInput {
  userId: string;
  eventSlug: string;
  startUtc: string;
  endUtc: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeeTimezone: string;
}

export interface CreateBookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
}

const SLOT_TAKEN = 'This time was just booked. Please pick another slot.';

export async function createBooking(
  input: CreateBookingInput
): Promise<CreateBookingResult> {
  const {
    userId,
    eventSlug,
    startUtc,
    endUtc,
    attendeeName,
    attendeeEmail,
    attendeeTimezone,
  } = input;

  const eventType = await db.query.eventTypes.findFirst({
    where: and(eq(eventTypes.userId, userId), eq(eventTypes.slug, eventSlug)),
  });
  if (!eventType) return { success: false, error: 'Event type not found' };

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return { success: false, error: 'User not found' };

  const writeCalendar = await db.query.connectedCalendars.findFirst({
    where: and(
      eq(connectedCalendars.userId, userId),
      eq(connectedCalendars.writeTarget, true)
    ),
  });
  if (!writeCalendar)
    return { success: false, error: 'No calendar configured for bookings' };

  // Re-validate the slot is genuinely bookable right now.
  const { slots } = await getSlots(
    userId,
    eventSlug,
    startUtc,
    DateTime.fromISO(endUtc).plus({ hours: 1 }).toISO()!
  );
  if (!slots.some((s) => s.start === startUtc && s.end === endUtc)) {
    return { success: false, error: SLOT_TAKEN };
  }

  // Reserve the slot. The partial unique index (calendar_id, start_utc) over
  // active statuses is the hard double-booking guard; the synchronous SQLite
  // transaction serializes concurrent attempts.
  let bookingId: string;
  try {
    bookingId = await db.transaction(async (tx) => {
      // Serialize concurrent bookings targeting the same calendar.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${writeCalendar.id}))`
      );

      const clash = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.calendarId, writeCalendar.id),
            eq(bookings.startUtc, new Date(startUtc)),
            inArray(bookings.status, ['pending', 'confirmed'])
          )
        );
      if (clash.length > 0) throw new Error(SLOT_TAKEN);

      const [row] = await tx
        .insert(bookings)
        .values({
          eventTypeId: eventType.id,
          startUtc: new Date(startUtc),
          endUtc: new Date(endUtc),
          attendeeName,
          attendeeEmail,
          attendeeTimezone,
          status: 'pending',
          calendarId: writeCalendar.id,
        })
        .returning({ id: bookings.id });
      return row.id;
    });
  } catch (e: any) {
    // Unique-index violation (23505) or explicit clash → slot already taken.
    return { success: false, error: SLOT_TAKEN };
  }

  // Write the calendar event outside the transaction.
  try {
    const { externalId } = await mockCalendar.createEvent({
      startUtc,
      endUtc,
      title: eventType.title,
      description: eventType.location ?? undefined,
      attendee: { name: attendeeName, email: attendeeEmail },
      idempotencyKey: bookingId,
    });

    await db
      .update(bookings)
      .set({ status: 'confirmed', externalEventId: externalId, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));
  } catch (err) {
    await db
      .update(bookings)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));
    return { success: false, error: 'Could not create the calendar event.' };
  }

  // Best-effort notifications — never fail the booking.
  try {
    await Promise.all([
      sendBookingConfirmation({
        attendeeName,
        attendeeEmail,
        startUtc,
        eventTitle: eventType.title,
        hostEmail: user.email,
      }),
      sendHostNotification({
        attendeeName,
        attendeeEmail,
        startUtc,
        eventTitle: eventType.title,
        hostEmail: user.email,
      }),
    ]);
  } catch (e) {
    console.error('[email] send failed (booking still confirmed):', e);
  }

  return { success: true, bookingId };
}
