export const dynamic = 'force-dynamic';

import { eq, asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { weeklyAvailability } from '@/db/schema';
import { getDemoUser } from '@/lib/queries';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function AvailabilityPage() {
  const user = await getDemoUser();
  if (!user) return <p>Run <code>npm run setup</code> to seed the demo host.</p>;

  const rules = await db.query.weeklyAvailability.findMany({
    where: eq(weeklyAvailability.userId, user.id),
    orderBy: [asc(weeklyAvailability.weekday)],
  });
  const byDay = new Map(rules.map((r) => [r.weekday, r]));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-neutral-900">Availability</h1>
      <p className="text-sm text-neutral-500">
        Weekly hours in {user.timeZone}. (Editing lands in the next phase.)
      </p>
      <div className="max-w-md space-y-2">
        {DAYS.map((label, weekday) => {
          const rule = byDay.get(weekday);
          return (
            <div
              key={weekday}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-2.5"
            >
              <span className="font-medium text-neutral-900">{label}</span>
              <span className="text-sm text-neutral-500">
                {rule ? `${rule.startTime} – ${rule.endTime}` : 'Unavailable'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}