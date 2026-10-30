import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { homeFor, useAuth } from '../store/auth';

/**
 * Web app: the phone's Back button must never drop out of the app (switching tabs adds no history, so
 * Back on a tab left the app: a black screen in the installed app, with nothing to reload). One extra
 * history step is kept under the app; reaching it brings the person to their home page. Back on the
 * home page itself still leaves the app, as phones expect.
 */
export function BackGuard() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const mark = () => {
      window.history.replaceState({ ...(window.history.state ?? {}), optimasBase: true }, '', window.location.href);
      window.history.pushState({ ...(window.history.state ?? {}), optimasBase: false }, '', window.location.href);
    };
    mark();
    const onPop = () => {
      if (!window.history.state?.optimasBase) return;
      const home = homeFor(useAuth.getState().user?.role);
      if (window.location.pathname === home) return; // at home: the next Back leaves the app
      // Let the router finish with this step first, then take the person home and keep the guard
      setTimeout(() => {
        router.replace(home as never);
        setTimeout(mark, 50);
      }, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return null;
}
