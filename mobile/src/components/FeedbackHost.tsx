import { useEffect, useRef } from 'react';
import { Animated, BackHandler, Easing, PanResponder, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFeedback, type Toast, type ToastKind } from '../store/feedback';
import { colors, fonts } from '../theme';
import { EASE_IN, EASE_OUT, NATIVE, haptic, prefersReducedMotion, spring } from '../utils/motion';
import { Button } from './Button';
import { CelebrationHost } from './Celebration';
import { Text } from './Text';

const KIND: Record<ToastKind, { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }> = {
  success: { icon: 'checkmark', bg: colors.success, fg: colors.white },
  error: { icon: 'close', bg: colors.danger, fg: colors.white },
  warning: { icon: 'alert', bg: '#F59E0B', fg: colors.white },
  info: { icon: 'information', bg: colors.highlight, fg: colors.onHighlight },
};
const TOAST_MS: Record<ToastKind, number> = { success: 3200, info: 3600, warning: 4200, error: 5200 };

/** Renders toasts (top), the dialog (centre) and the celebration. Mount once at the root. */
export function FeedbackHost() {
  const toasts = useFeedback((s) => s.toasts);
  const dialog = useFeedback((s) => s.dialog);
  const insets = useSafeAreaInsets();
  return (
    <>
      <View pointerEvents="box-none" style={[styles.toasts, { top: insets.top + 10 }]}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </View>
      {dialog ? <DialogView /> : null}
      <CelebrationHost />
    </>
  );
}

/**
 * A toast drops in with a small spring, its icon pops, a hairline counts down the time left, and it leaves
 * upward. Drag it up to send it away early; tap to dismiss.
 */
function ToastCard({ toast }: { toast: Toast }) {
  const reduced = prefersReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const icon = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const countdown = useRef(new Animated.Value(1)).current;
  const dismiss = useFeedback((s) => s.dismiss);
  const remove = useFeedback((s) => s.remove);
  const k = KIND[toast.kind];

  useEffect(() => {
    if (toast.kind === 'success') haptic.success();
    else if (toast.kind === 'error') haptic.error();
    else if (toast.kind === 'warning') haptic.warning();
    if (reduced) return;
    Animated.spring(enter, { toValue: 1, ...spring.pop, useNativeDriver: NATIVE }).start();
    Animated.spring(icon, { toValue: 1, ...spring.pop, delay: 120, useNativeDriver: NATIVE } as Animated.SpringAnimationConfig).start();
    // The countdown line is the only thing animated on the JS thread (width cannot use the native driver)
    Animated.timing(countdown, { toValue: 0, duration: TOAST_MS[toast.kind], easing: Easing.linear, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast.leaving) return;
    if (reduced) return void remove(toast.id);
    Animated.timing(enter, { toValue: 0, duration: 240, easing: EASE_IN, useNativeDriver: NATIVE }).start(() => remove(toast.id));
  }, [toast.leaving, enter, remove, toast.id, reduced]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.min(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -28 || g.vy < -0.6) dismiss(toast.id);
        else Animated.spring(drag, { toValue: 0, ...spring.settle, useNativeDriver: NATIVE }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      {...pan.panHandlers}
      style={{
        width: '100%',
        alignItems: 'center',
        opacity: enter.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
        transform: [{ translateY: Animated.add(enter.interpolate({ inputRange: [0, 1], outputRange: [-46, 0] }), drag) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
      }}
    >
      <Pressable onPress={() => dismiss(toast.id)} accessibilityRole="alert" style={styles.toast}>
        <Animated.View style={[styles.toastIcon, { backgroundColor: k.bg, transform: [{ scale: icon.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] }]}>
          <Ionicons name={k.icon} size={18} color={k.fg} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text variant="title" style={{ fontFamily: fonts.semibold, fontSize: 14.5 }} numberOfLines={2}>
            {toast.title}
          </Text>
          {toast.message ? (
            <Text variant="label" color={colors.textMuted} numberOfLines={3} style={{ marginTop: 1 }}>
              {toast.message}
            </Text>
          ) : null}
        </View>
        <View pointerEvents="none" style={styles.countTrack}>
          <Animated.View style={[styles.countFill, { backgroundColor: k.bg, width: countdown.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * A dialog fades in over a softly blurred backdrop while the card springs up, its icon pops after it, and
 * both leave quickly (so choosing feels instant).
 */
function DialogView() {
  const dialog = useFeedback((s) => s.dialog)!;
  const close = useFeedback((s) => s.close);
  const reduced = prefersReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const icon = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const leaving = useRef(false);

  const finish = (ok: boolean) => {
    if (leaving.current) return;
    leaving.current = true;
    if (reduced) return close(ok);
    Animated.timing(v, { toValue: 0, duration: 170, easing: EASE_IN, useNativeDriver: NATIVE }).start(() => close(ok));
  };

  useEffect(() => {
    if (!reduced) {
      Animated.spring(v, { toValue: 1, ...spring.pop, useNativeDriver: NATIVE }).start();
      Animated.spring(icon, { toValue: 1, ...spring.pop, delay: 110, useNativeDriver: NATIVE } as Animated.SpringAnimationConfig).start();
    }
    // Android back button = cancel
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      finish(false);
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const danger = dialog.tone === 'danger';
  const iconName = dialog.icon ?? (danger ? 'alert-circle' : dialog.cancelLabel ? 'help-circle' : 'information-circle');
  const blur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as unknown as ViewStyle) : null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, blur, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => (dialog.cancelLabel ? finish(false) : undefined)} accessibilityLabel="Close" />
      <Animated.View
        accessibilityViewIsModal
        style={[styles.card, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }]}
      >
        <Animated.View style={[styles.cardIcon, { backgroundColor: danger ? colors.dangerSoft : colors.highlight, transform: [{ scale: icon.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}>
          <Ionicons name={iconName} size={26} color={danger ? colors.danger : colors.onHighlight} />
        </Animated.View>
        <Text variant="h2" style={styles.title}>
          {dialog.title}
        </Text>
        {dialog.message ? (
          <Text variant="bodySm" color={colors.textMuted} style={styles.message}>
            {dialog.message}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {dialog.cancelLabel ? <Button label={dialog.cancelLabel} variant="secondary" onPress={() => finish(false)} style={{ flex: 1 }} /> : null}
          <Button label={dialog.confirmLabel ?? 'OK'} variant={danger ? 'danger' : 'primary'} onPress={() => finish(true)} style={{ flex: 1 }} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toasts: { position: 'absolute', left: 14, right: 14, zIndex: 70, gap: 8 },
  toast: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(28,29,31,0.06)',
    shadowColor: '#1C1D1F',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    overflow: 'hidden',
  },
  toastIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  countTrack: { position: 'absolute', left: 14, right: 14, bottom: 0, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(28,29,31,0.05)' },
  countFill: { height: 3, borderRadius: 2, opacity: 0.55 },
  backdrop: { zIndex: 80, backgroundColor: 'rgba(17,18,19,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    padding: 22,
    paddingTop: 26,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 24,
  },
  cardIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontFamily: fonts.semibold, fontSize: 19, textAlign: 'center' },
  message: { textAlign: 'center', marginTop: 8, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 22 },
});
