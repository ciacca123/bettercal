'use server';

import { z } from 'zod';
import { getUserByUsername } from '@/lib/queries';
import { createBooking, CreateBookingResult } from '@/lib/booking';

const bookSchema = z.object({
  username: z.string().min(1),
  slug: z.string().min(1),
  startUtc: z.string().datetime(),
  endUtc: z.string().datetime(),
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Enter a valid email'),
  timezone: z.string().min(1),
});

export async function bookSlotAction(
  input: z.infer<typeof bookSchema>
): Promise<CreateBookingResult> {
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { username, slug, startUtc, endUtc, name, email, timezone } = parsed.data;

  const user = await getUserByUsername(username);
  if (!user) return { success: false, error: 'Host not found' };

  return createBooking({
    userId: user.id,
    eventSlug: slug,
    startUtc,
    endUtc,
    attendeeName: name,
    attendeeEmail: email,
    attendeeTimezone: timezone,
  });
}
