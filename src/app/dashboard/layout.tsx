export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getDemoUser } from '@/lib/queries';

const links = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/event-types', label: 'Event Types' },
  { href: '/dashboard/availability', label: 'Availability' },
  { href: '/dashboard/calendars', label: 'Calendars' },
  { href: '/dashboard/bookings', label: 'Bookings' },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getDemoUser();

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="w-60 border-r border-neutral-200 bg-white p-6">
        <h2 className="mb-8 text-xl font-semibold">BetterCal</h2>
        <nav className="space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="mt-10 text-xs text-neutral-400">
          {user?.email ?? 'no demo user — run npm run setup'}
        </p>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}