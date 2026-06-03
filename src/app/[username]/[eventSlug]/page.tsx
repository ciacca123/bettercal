export const dynamic = 'force-dynamic';

import { DateTime } from 'luxon';
import { notFound } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/db';
import { eventTypes } from '@/db/schema';
import { getUserByUsername, getAppearance } from '@/lib/queries';
import { getSlots } from '@/lib/slots';
import { BookingFlow } from './BookingFlow';
import type { HostAppearance } from '@/db/schema';

// ---------------------------------------------------------------------------
// CSS-variable helpers
// ---------------------------------------------------------------------------

function buildStyle(ap: HostAppearance | null, mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  return {
    '--bc-page-bg': isDark ? '#111827' : (ap?.bgColor ? lighten(ap.bgColor) : '#f5f5f5'),
    '--bc-card-bg': isDark ? '#1f2937' : (ap?.bgColor ?? '#ffffff'),
    '--bc-card-border': isDark ? '#374151' : '#e5e5e5',
    '--bc-aside-border': isDark ? '#374151' : '#e5e5e5',
    '--bc-avatar-bg': isDark ? (ap?.accentColor ?? '#3b82f6') : (ap?.accentColor ?? '#171717'),
    '--bc-avatar-text': '#ffffff',
    '--bc-title': isDark ? (ap?.textColor ? dimColor(ap.textColor) : '#f9fafb') : (ap?.textColor ?? '#171717'),
    '--bc-host': isDark ? '#9ca3af' : '#737373',
    '--bc-detail': isDark ? '#9ca3af' : '#737373',
    '--bc-font': ap?.fontFamily ?? 'inherit',
  } as React.CSSProperties;
}

/** Very rough: make a hex slightly lighter for the page background */
function lighten(hex: string): string {
  try {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 0xff) + 30);
    const g = Math.min(255, ((n >> 8) & 0xff) + 30);
    const b = Math.min(255, (n & 0xff) + 30);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch {
    return '#f5f5f5';
  }
}

function dimColor(hex: string): string {
  try {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 0xff) + 80);
    const g = Math.min(255, ((n >> 8) & 0xff) + 80);
    const b = Math.min(255, (n & 0xff) + 80);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch {
    return '#f9fafb';
  }
}

function buildCSS(ap: HostAppearance | null, themeMode: 'light' | 'dark' | 'auto'): string {
  const lightVars = buildStyle(ap, 'light');
  const darkVars = buildStyle(ap, 'dark');

  const toRules = (vars: React.CSSProperties) =>
    Object.entries(vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');

  if (themeMode === 'light') {
    return `[data-bc-theme] {\n${toRules(lightVars)}\n}`;
  }
  if (themeMode === 'dark') {
    return `[data-bc-theme] {\n${toRules(darkVars)}\n}`;
  }
  // auto
  return `[data-bc-theme] {\n${toRules(lightVars)}\n}\n@media (prefers-color-scheme: dark) {\n  [data-bc-theme] {\n${toRules(darkVars)}\n  }\n}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

import React from 'react';

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

  const ap = (await getAppearance(user.id)) ?? null;
  const themeMode = ap?.themeMode ?? 'light';

  // Display values
  const displayName = ap?.brandName ?? user.name ?? user.username;
  const showDuration = ap?.showDuration ?? true;
  const showLocation = ap?.showLocation ?? true;
  const showTimezone = ap?.showTimezone ?? true;
  const durationLabel = ap?.durationLabel ?? 'minutes';
  const timezoneLabel = ap?.timezoneLabel ?? 'Host timezone:';
  const showIcons = (ap?.iconStyle ?? 'emoji') === 'emoji';

  const css = buildCSS(ap, themeMode);

  return (
    <>
      {/* Inject CSS variables for theming */}
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <main
        data-bc-theme
        className="min-h-screen py-10 px-4"
        style={{ backgroundColor: 'var(--bc-page-bg)', fontFamily: 'var(--bc-font)' }}
      >
        <div
          className="mx-auto max-w-4xl overflow-hidden rounded-lg md:grid md:grid-cols-[1fr_1.4fr]"
          style={{ backgroundColor: 'var(--bc-card-bg)', border: '1px solid var(--bc-card-border)' }}
        >
          {/* Left: host + event details */}
          <aside
            className="p-6 md:border-b-0"
            style={{ borderBottom: '1px solid var(--bc-aside-border)' }}
          >
            {/* Avatar */}
            {ap?.avatarUrl ? (
              <img
                src={ap.avatarUrl}
                alt={displayName}
                className="mb-4 h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold"
                style={{ backgroundColor: 'var(--bc-avatar-bg)', color: 'var(--bc-avatar-text)' }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <p className="text-sm" style={{ color: 'var(--bc-host)' }}>{displayName}</p>
            <h1 className="mt-1 text-2xl font-semibold" style={{ color: 'var(--bc-title)' }}>
              {eventType.title}
            </h1>

            <ul className="mt-4 space-y-1.5 text-sm" style={{ color: 'var(--bc-detail)' }}>
              {showDuration && (
                <li>{showIcons ? '⏱ ' : ''}{eventType.durationMin} {durationLabel}</li>
              )}
              {showLocation && eventType.location && (
                <li>{showIcons ? '📍 ' : ''}{eventType.location}</li>
              )}
              {showTimezone && (
                <li>{showIcons ? '🌍 ' : ''}{timezoneLabel} {user.timeZone}</li>
              )}
            </ul>
          </aside>

          {/* Right: pick a time */}
          <section className="p-6" style={{ borderLeft: '1px solid var(--bc-aside-border)' }}>
            <BookingFlow
              username={username}
              slug={eventSlug}
              durationMin={eventType.durationMin}
              slots={slots}
            />
          </section>
        </div>
      </main>
    </>
  );
}
