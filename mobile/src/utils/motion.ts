import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/*
 * Shared motion language: one easing curve and a few spring feels, used by every screen, button and pop-up so
 * the app moves as one product. People who ask their phone for less motion get simple fades instead.
 */

export const NATIVE = Platform.OS !== 'web';

/** The house easing: quick start, long soft landing. */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.4, 0, 1, 1);

/** Spring feels (react-native Animated.spring config). */
export const spring = {
  /** Pop-ups and cards arriving: lively, small overshoot. */
  pop: { damping: 14, stiffness: 190, mass: 0.9 },
  /** Pages and sheets settling: firm, no bounce. */
  settle: { damping: 24, stiffness: 240, mass: 1 },
  /** Buttons reacting to a finger. */
  press: { damping: 18, stiffness: 420, mass: 0.7 },
};

let reduced = false;
const listeners = new Set<(v: boolean) => void>();
const set = (v: boolean) => {
  reduced = v;
  listeners.forEach((l) => l(v));
};
AccessibilityInfo.isReduceMotionEnabled?.().then(set).catch(() => undefined);
AccessibilityInfo.addEventListener?.('reduceMotionChanged', set);
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
  const q = window.matchMedia('(prefers-reduced-motion: reduce)');
  set(q.matches);
  q.addEventListener?.('change', (e) => set(e.matches));
}

export const prefersReducedMotion = () => reduced;

/** True when the person asked for less motion (phone setting or browser preference). */
export function useReducedMotion() {
  const [v, setV] = useState(reduced);
  useEffect(() => {
    listeners.add(setV);
    setV(reduced);
    return () => void listeners.delete(setV);
  }, []);
  return v;
}

/** Tiny physical taps. No-ops where the device has no haptics (web, desktops). */
export const haptic = {
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  press: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined),
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined),
};
