import { router } from 'expo-router';
import { homeFor, useAuth } from '../store/auth';

/** Back to the previous screen, or to the person's home when the page was opened directly (no history). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace(homeFor(useAuth.getState().user?.role ?? 'TECHNICIAN') as never);
}
