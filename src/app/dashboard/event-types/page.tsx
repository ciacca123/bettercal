export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { eventTypes } from '@/db/schema';
import { getDemoUser } from '@/lib/queries';

export default async function EventTypesPage() {
  const user = await getDemoUser();
  if (!user) return <p>Run <code>npm run setup</code> to seed the demo host.</p>;

  const events = await db.query.eventTypes.findMany({
    where: eq(eventTypes.userId, user.id),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-neutral-900">Event Types</h1>
      {events.length === 0 ? (
        <p className="text-neutral-500">No event types yet.</p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4"
            >
              <div>
                <h3 className="font-semibold text-neutral-900">{e.title}</h3>
                <p className="text-sm text-neutral-500">
                  /{user.username}/{e.slug} · {e.durationMin} min ·{' '}
                  {e.active ? 'active' : 'inactive'}
                </p>
              </div>
              <Link
                href={`/${user.username}/${e.slug}`}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
              >
                Open
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}