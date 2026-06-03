/**
 * Seeds a demo host so the booking flow is testable immediately.
 * Gated in production by the compose entrypoint (SEED_DEMO=true).
 */
import { eq } from 'drizzle-orm';
import { db, pool } from './db';
import {
  users,
  connectedCalendars,
  eventTypes,
  weeklyAvailability,
  hostAppearance,
} from './schema';

async function seed() {
  const existing = await db.select().from(users).where(eq(users.username, 'demo'));
  if (existing.length > 0) {
    console.log('Demo user already exists — skipping seed.');
    return;
  }

  const [user] = await db
    .insert(users)
    .values({
      username: 'demo',
      email: 'me@corradofriscia.top',
      name: 'Demo Host',
      timeZone: 'Europe/Rome',
    })
    .returning();

  await db.insert(connectedCalendars).values({
    userId: user.id,
    provider: 'mock',
    externalAccountId: 'mock-calendar',
    readBusy: true,
    writeTarget: true,
    writeCalendarId: 'mock-primary',
  });

  await db.insert(eventTypes).values({
    userId: user.id,
    slug: 'intro',
    title: 'Intro Call',
    durationMin: 30,
    minNoticeMin: 60,
    slotIntervalMin: 30,
    rangeDays: 14,
    location: 'Google Meet',
  });

  for (let weekday = 1; weekday <= 5; weekday++) {
    await db
      .insert(weeklyAvailability)
      .values({ userId: user.id, weekday, startTime: '09:00', endTime: '17:00' });
  }

  await db.insert(hostAppearance).values({
    userId: user.id,
    themeMode: 'auto',
  });

  console.log('Seeded demo host → /demo/intro');
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
