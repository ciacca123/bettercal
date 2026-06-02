export const dynamic = 'force-dynamic';

import { DateTime } from 'luxon';
import { notFound } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/db';
import { eventTypes } from '@/db/schema';
import { getUserByUsername } from '@/lib/queries';
import { getSlots } from '@/lib/slots';
import { BookingFlow } from './BookingFlow';

export default async function BookingPage({
  params,
}: {
  params: Promise<{ username: string; eventSlug: string }>;
}) {
  const { username, eventSlug } = await params;

  const user = await getUserByUsername(username);
  if (!user) notFound();

  const eventType = await db.query.eventTypes.findFirst({
    where: and(eq(eventTypes.userId, user.id), eq(eventTypes.slug, eventSlug)),
  });
  if (!eventType || !eventType.active) notFound();

  const now = DateTime.utc();
  const { slots } = await getSlots(
    user.id,
    eventSlug,
    now.toISO()!,
    now.plus({ days: eventType.rangeDays + 1 }).toISO()!
  );

  return (
    <main className="min-h-screen bg-neutral-50 py-10 px-4">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-neutral-200 bg-white md:grid md:grid-cols-[1fr_1.4fr]">
        {/* Left: host + event details */}
        <aside className="border-b border-neutral-200 p-6 md:border-b-0 md:border-r">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-lg font-semibold text-white">
            {(user.name ?? user.username).charAt(0).toUpperCase()}
          </div>
          <p className="text-sm text-neutral-500">{user.name ?? user.username}</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
            {eventType.title}
          </h1>
          <ul className="mt-4 space-y-1.5 text-sm text-neutral-500">
            <li>⏱ {eventType.durationMin} minutes</li>
            {eventType.location && <li>📍 {eventType.location}</li>}
            <li>🌍 Host timezone: {user.timeZone}</li>
          </ul>
        </aside>

        {/* Right: pick a time */}
        <section className="p-6">
          <BookingFlow
            username={username}
            slug={eventSlug}
            durationMin={eventType.durationMin}
            slots={slots}
          />
        </section>
      </div>
    </main>
  );
}