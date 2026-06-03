import { db } from '@/db/db';
import { users, hostAppearance } from '@/db/schema';
import type { HostAppearance } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getUserByUsername(username: string) {
  return db.query.users.findFirst({ where: eq(users.username, username) });
}

/** In local-mock mode there is no auth; the dashboard acts as the seeded demo host. */
export async function getDemoUser() {
  return db.query.users.findFirst({ where: eq(users.username, 'demo') });
}

export async function getAppearance(userId: string): Promise<HostAppearance | undefined> {
  return db.query.hostAppearance.findFirst({
    where: eq(hostAppearance.userId, userId),
  });
}

export async function upsertAppearance(
  userId: string,
  data: Partial<Omit<HostAppearance, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<HostAppearance> {
  const existing = await getAppearance(userId);
  if (existing) {
    const [row] = await db
      .update(hostAppearance)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hostAppearance.userId, userId))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(hostAppearance)
    .values({ userId, ...data })
    .returning();
  return row;
}
