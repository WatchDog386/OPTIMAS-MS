import { useEffect, useRef } from 'react';
import { Animated, BackHandler, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFeedback, type Toast, type ToastKind } from '../store/feedback';
import { colors, fonts } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

const NATIVE = Platform.OS !== 'web';
const KIND: Record<ToastKind, { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }> = {
  success: { icon: 'checkmark', bg: colors.success, fg: colors.white },
  error: { icon: 'close', bg: colors.danger, fg: colors.white },
  warning: { icon: 'alert', bg: '#F59E0B', fg: colors.white },
  info: { icon: 'information', bg: colors.highlight, fg: colors.onHighlight },
};

/** Renders toasts (top) and the dialog (centre). Mount once at the root. */
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
    </>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: NATIVE }).start();
  }, [v]);
  const k = KIND[toast.kind];
  return (
    <Animated.View style={{ width: '100%', alignItems: 'center', opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }}>
      <Pressable onPress={() => useFeedback.getState().dismiss(toast.id)} accessibilityRole="alert" style={styles.toast}>
        <View style={[styles.toastIcon, { backgroundColor: k.bg }]}>
          <Ionicons name={k.icon} size={18} color={k.fg} />
        </View>
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
      </Pressable>
    </Animated.View>
  );
}

function DialogView() {
  const dialog = useFeedback((s) => s.dialog)!;
  const close = useFeedback((s) => s.close);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
    // Android back button = cancel
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close(false);
      return true;
    });
    return () => sub.remove();
  }, [v, close]);
  const danger = dialog.tone === 'danger';
  const icon = dialog.icon ?? (danger ? 'alert-circle' : dialog.cancelLabel ? 'help-circle' : 'information-circle');
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: v }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => (dialog.cancelLabel ? close(false) : undefined)} accessibilityLabel="Close" />
      <Animated.View accessibilityViewIsModal style={[styles.card, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
        <View style={[styles.cardIcon, { backgroundColor: danger ? colors.dangerSoft : colors.highlight }]}>
          <Ionicons name={icon} size={26} color={danger ? colors.danger : colors.onHighlight} />
        </View>
        <Text variant="h2" style={styles.title}>
          {dialog.title}
        </Text>
        {dialog.message ? (
          <Text variant="bodySm" color={colors.textMuted} style={styles.message}>
            {dialog.message}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {dialog.cancelLabel ? <Button label={dialog.cancelLabel} variant="secondary" onPress={() => close(false)} style={{ flex: 1 }} /> : null}
          <Button label={dialog.confirmLabel ?? 'OK'} variant={danger ? 'danger' : 'primary'} onPress={() => close(true)} style={{ flex: 1 }} />
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
  },
  toastIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
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
