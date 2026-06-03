'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function loginAction(password: string, next: string) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return { error: 'ADMIN_PASSWORD non configurata.' };
  }

  if (password !== adminPassword) {
    return { error: 'Password errata.' };
  }

  const token = Buffer.from(adminPassword).toString('base64');
  const cookieStore = await cookies();
  cookieStore.set('bc_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 giorni
  });

  redirect(next);
}
