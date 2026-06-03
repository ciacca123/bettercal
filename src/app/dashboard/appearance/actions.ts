'use server';

import { z } from 'zod';
import { getDemoUser, upsertAppearance } from '@/lib/queries';
import { revalidatePath } from 'next/cache';

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color (#rrggbb)')
  .nullable();

const appearanceSchema = z.object({
  brandName: z.string().max(80).nullable(),
  avatarUrl: z.string().url('Must be a valid URL').max(500).nullable(),
  accentColor: hex,
  bgColor: hex,
  textColor: hex,
  fontFamily: z.string().max(200).nullable(),
  showDuration: z.boolean(),
  showLocation: z.boolean(),
  showTimezone: z.boolean(),
  durationLabel: z.string().max(40).nullable(),
  timezoneLabel: z.string().max(60).nullable(),
  iconStyle: z.enum(['emoji', 'none']),
  themeMode: z.enum(['light', 'dark', 'auto']),
});

export type AppearanceState = { success: boolean; error?: string };

export async function saveAppearanceAction(
  _prev: AppearanceState,
  formData: FormData
): Promise<AppearanceState> {
  const user = await getDemoUser();
  if (!user) return { success: false, error: 'User not found' };

  const raw = {
    brandName: (formData.get('brandName') as string) || null,
    avatarUrl: (formData.get('avatarUrl') as string) || null,
    accentColor: formData.get('clearAccentColor') === 'on' ? null : ((formData.get('accentColor') as string) || null),
    bgColor: formData.get('clearBgColor') === 'on' ? null : ((formData.get('bgColor') as string) || null),
    textColor: formData.get('clearTextColor') === 'on' ? null : ((formData.get('textColor') as string) || null),
    fontFamily: (formData.get('fontFamily') as string) || null,
    showDuration: formData.get('showDuration') === 'on',
    showLocation: formData.get('showLocation') === 'on',
    showTimezone: formData.get('showTimezone') === 'on',
    durationLabel: (formData.get('durationLabel') as string) || null,
    timezoneLabel: (formData.get('timezoneLabel') as string) || null,
    iconStyle: formData.get('iconStyle') as 'emoji' | 'none',
    themeMode: formData.get('themeMode') as 'light' | 'dark' | 'auto',
  };

  const parsed = appearanceSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await upsertAppearance(user.id, parsed.data);
  revalidatePath('/dashboard/appearance');
  revalidatePath(`/${user.username}`);
  return { success: true };
}
