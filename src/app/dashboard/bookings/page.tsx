export const dynamic = 'force-dynamic';

import { DateTime } from 'luxon';
import { eq, inArray, desc } from 'drizzle-orm';
import { db } from '@/db/db';
import { bookings, eventTypes } from '@/db/schema';
import { getDemoUser } from '@/lib/queries';

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-neutral-100 text-neutral-500 line-through',
  failed: 'bg-red-100 text-red-800',
};

export default async function BookingsPage() {
  const user = await getDemoUser();
  if (!user) return <p>Run <code>npm run setup</code> to seed the demo host.</p>;

  const myEventTypes = await db.query.eventTypes.findMany({
    where: eq(eventTypes.userId, user.id),
  });
  const ids = myEventTypes.map((e) => e.id);
  const titleById = new Map(myEventTypes.map((e) => [e.id, e.title]));

  const rows =
    ids.length > 0
      ? await db.query.bookings.findMany({
          where: inArray(bookings.eventTypeId, ids),
          orderBy: [desc(bookings.startUtc)],
        })
      : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-neutral-900">Bookings</h1>
      {rows.length === 0 ? (
        <p className="text-neutral-500">
          No bookings yet. Book one at{' '}
          <a className="text-blue-600 underline" href={`/${user.username}/intro`}>
            /{user.username}/intro
          </a>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="p-3 font-medium">When</th>
                <th className="p-3 font-medium">Attendee</th>
                <th className="p-3 font-medium">Event</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b border-neutral-100 last:border-0">
                  <td className="p-3">
                    {DateTime.fromJSDate(b.startUtc)
                      .setZone(user.timeZone)
                      .toFormat('dd LLL, HH:mm')}
                  </td>
                  <td className="p-3">
                    {b.attendeeName}
                    <span className="block text-xs text-neutral-400">
                      {b.attendeeEmail}
                    </span>
                  </td>
                  <td className="p-3">{titleById.get(b.eventTypeId) ?? '—'}</td>
                  <td className="p-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        STATUS_STYLES[b.status] ?? ''
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}