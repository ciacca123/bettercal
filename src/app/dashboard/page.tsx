export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getDemoUser } from '@/lib/queries';

export default async function DashboardHome() {
  const user = await getDemoUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">
          Welcome{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-1 text-neutral-500">
          Local-mock build. Share your public booking link to receive bookings.
        </p>
      </div>
      <Link
        href="/demo/intro"
        className="inline-block rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        View public page (/demo/intro)
      </Link>
    </div>
  );
}