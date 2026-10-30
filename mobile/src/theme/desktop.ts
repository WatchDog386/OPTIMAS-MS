import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Wide screens (a laptop or desktop browser) get the Business-SME desktop layout from this width up. */
export const DESKTOP_MIN = 1024;

const wide = () => Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= DESKTOP_MIN;

/** Whether the app opened on a wide screen (fixed for the visit, like the font). */
export const OPENED_ON_DESKTOP = wide();

/** True while the window is desktop-wide; follows resizes. */
export function useDesktop() {
  const [on, setOn] = useState(wide);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => setOn(wide());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return on;
}
