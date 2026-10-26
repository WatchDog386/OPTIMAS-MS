import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { setThemeColor, STATUS_BAR_COLOR } from './install';

/** Paints the phone's status bar (web/PWA theme-color) to match this screen while it is focused. */
export function useStatusBarColor(color: string) {
  useFocusEffect(
    useCallback(() => {
      setThemeColor(color);
      return () => setThemeColor(STATUS_BAR_COLOR);
    }, [color]),
  );
}
