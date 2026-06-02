import { db } from '@/db/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getUserByUsername(username: string) {
  return db.query.users.findFirst({ where: eq(users.username, username) });
}

/** In local-mock mode there is no auth; the dashboard acts as the seeded demo host. */
export async function getDemoUser() {
  return db.query.users.findFirst({ where: eq(users.username, 'demo') });
}
