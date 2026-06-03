export const dynamic = 'force-dynamic';

import { getDemoUser, getAppearance } from '@/lib/queries';
import AppearanceForm from './AppearanceForm';

export default async function AppearancePage() {
  const user = await getDemoUser();
  const ap = user ? (await getAppearance(user.id)) ?? null : null;
  return <AppearanceForm ap={ap} />;
}
