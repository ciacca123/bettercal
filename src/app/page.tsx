import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-4 text-center">
      <h1 className="text-4xl font-semibold text-neutral-900">BetterCal</h1>
      <p className="max-w-md text-neutral-500">
        A lean scheduling app. This is the local-mock build — a demo host is already seeded.
      </p>
      <div className="flex gap-3">
        <Link
          href="/demo/intro"
          className="rounded bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Open booking page →
        </Link>
        <Link
          href="/dashboard"
          className="rounded border border-neutral-300 px-5 py-2.5 text-sm hover:bg-neutral-100"
        >
          Host dashboard
        </Link>
      </div>
    </main>
  );
}
