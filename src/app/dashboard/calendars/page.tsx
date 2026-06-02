export const dynamic = 'force-dynamic';

import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { connectedCalendars } from '@/db/schema';
import { getDemoUser } from '@/lib/queries';

export default async function CalendarsPage() {
  const user = await getDemoUser();
  if (!user) return <p>Run <code>npm run setup</code> to seed the demo host.</p>;

  const calendars = await db.query.connectedCalendars.findMany({
    where: eq(connectedCalendars.userId, user.id),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-neutral-900">Connected Calendars</h1>
      <p className="text-sm text-neutral-500">
        Local-mock build uses an in-memory calendar. Google/CalDAV wiring is in the
        provider layer, enabled in a later phase.
      </p>
      <div className="space-y-3">
        {calendars.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4"
          >
            <div>
              <h3 className="font-semibold capitalize text-neutral-900">{c.provider}</h3>
              <p className="text-sm text-neutral-500">
                {c.writeTarget ? 'Write target' : 'Read only'} ·{' '}
                {c.readBusy ? 'busy synced' : 'busy ignored'}
              </p>
            </div>
            <span className="text-sm text-green-600">✓ connected</span>
          </div>
        ))}
      </div>
    </div>
  );
}