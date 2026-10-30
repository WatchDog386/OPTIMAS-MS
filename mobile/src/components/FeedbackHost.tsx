import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { useFeedback, type Toast, type ToastKind } from '../store/feedback';
import { colors, fonts } from '../theme';
import { EASE_IN, NATIVE, haptic, prefersReducedMotion, spring } from '../utils/motion';
import { CelebrationHost } from './Celebration';
import { Text } from './Text';

/** The emoji each kind of message shows, like the dialogs. */
const KIND_EMOJI: Record<ToastKind, string> = { success: '✅', error: '😕', warning: '⚠️', info: '💡' };

/** Renders messages and the dialog (both the same dark pop-up card) and the celebration. Mount once at the root. */
export function FeedbackHost() {
  const toasts = useFeedback((s) => s.toasts);
  const dialog = useFeedback((s) => s.dialog);
  // One message at a time: the newest
  const toast = dialog ? undefined : toasts[0];
  return (
    <>
      {toast ? <ToastCard key={toast.id} toast={toast} /> : null}
      {dialog ? <DialogView /> : null}
      <CelebrationHost />
    </>
  );
}

/**
 * A message is the same dark card as the dialogs: title, a big emoji, the text and an OK button. It
 * springs in, closes by itself after a few seconds, and closes at once on OK or a tap outside.
 */
function ToastCard({ toast }: { toast: Toast }) {
  const reduced = prefersReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const icon = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const dismiss = useFeedback((s) => s.dismiss);
  const remove = useFeedback((s) => s.remove);

  useEffect(() => {
    if (toast.kind === 'success') haptic.success();
    else if (toast.kind === 'error') haptic.error();
    else if (toast.kind === 'warning') haptic.warning();
    if (reduced) return;
    Animated.spring(v, { toValue: 1, ...spring.pop, useNativeDriver: NATIVE }).start();
    Animated.spring(icon, { toValue: 1, ...spring.pop, delay: 110, useNativeDriver: NATIVE } as Animated.SpringAnimationConfig).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast.leaving) return;
    if (reduced) return void remove(toast.id);
    Animated.timing(v, { toValue: 0, duration: 170, easing: EASE_IN, useNativeDriver: NATIVE }).start(() => remove(toast.id));
  }, [toast.leaving, v, remove, toast.id, reduced]);

  const close = () => dismiss(toast.id);
  const blur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as unknown as ViewStyle) : null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, styles.toastLayer, blur, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      <Animated.View
        accessibilityRole="alert"
        style={[styles.card, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }]}
      >
        <Text variant="h2" color="#FFFFFF" fixedColor style={styles.title}>
          {toast.title}
        </Text>
        <Animated.Text style={[styles.emoji, { transform: [{ scale: icon.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]} accessibilityElementsHidden importantForAccessibility="no">
          {KIND_EMOJI[toast.kind]}
        </Animated.Text>
        {toast.message ? (
          <Text variant="body" color="rgba(255,255,255,0.78)" fixedColor style={styles.message}>
            {toast.message}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable onPress={close} accessibilityRole="button" style={({ pressed }) => [styles.btn, { backgroundColor: toast.kind === 'error' ? colors.danger : DIALOG_GREEN }, pressed && styles.pressed]}>
            <Text variant="title" color="#FFFFFF" fixedColor style={styles.btnText}>
              OK
            </Text>
          </Pressable>
        </View>
      </Animated.View>
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
  const [text, setText] = useState('');
  const needsText = !!dialog.input?.required && !text.trim();

  const finish = (ok: boolean) => {
    if (leaving.current || (ok && needsText)) return;
    leaving.current = true;
    if (reduced) return close(ok, text);
    Animated.timing(v, { toValue: 0, duration: 170, easing: EASE_IN, useNativeDriver: NATIVE }).start(() => close(ok, text));
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
  // A friendly face for the question, like a banking app's pop-ups
  const emoji = dialog.emoji ?? (danger ? '⚠️' : dialog.input ? '✍️' : dialog.cancelLabel ? '🤔' : '👍');
  const blur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as unknown as ViewStyle) : null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, blur, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => (dialog.cancelLabel ? finish(false) : undefined)} accessibilityLabel="Close" />
      <Animated.View
        accessibilityViewIsModal
        style={[styles.card, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }]}
      >
        <Text variant="h2" color="#FFFFFF" fixedColor style={styles.title}>
          {dialog.title}
        </Text>
        <Animated.Text style={[styles.emoji, { transform: [{ scale: icon.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]} accessibilityElementsHidden importantForAccessibility="no">
          {emoji}
        </Animated.Text>
        {dialog.message ? (
          <Text variant="body" color="rgba(255,255,255,0.78)" fixedColor style={styles.message}>
            {dialog.message}
          </Text>
        ) : null}
        {dialog.input ? (
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={dialog.input.placeholder}
            placeholderTextColor="rgba(255,255,255,0.45)"
            autoFocus
            multiline={!dialog.input.secret}
            secureTextEntry={!!dialog.input.secret}
            autoCapitalize={dialog.input.secret ? 'none' : 'sentences'}
            maxLength={500}
            style={[styles.input, dialog.input.secret && styles.secret]}
            accessibilityLabel={dialog.input.placeholder ?? 'Text'}
          />
        ) : null}
        <View style={styles.actions}>
          {dialog.cancelLabel ? (
            <Pressable onPress={() => finish(false)} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && styles.pressed]}>
              <Text variant="title" color="#FFFFFF" fixedColor style={styles.btnText}>
                {dialog.cancelLabel}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => finish(true)}
            disabled={needsText}
            accessibilityRole="button"
            accessibilityState={{ disabled: needsText }}
            style={({ pressed }) => [styles.btn, { backgroundColor: danger ? colors.danger : DIALOG_GREEN }, needsText && { opacity: 0.45 }, pressed && styles.pressed]}
          >
            <Text variant="title" color="#FFFFFF" fixedColor style={styles.btnText}>
              {dialog.confirmLabel ?? 'OK'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** Pop-up colours: a dark card with lime-green actions. */
const DIALOG_BG = '#1E1F21';
const DIALOG_GREEN = '#7CB82F';

const styles = StyleSheet.create({
  toastLayer: { zIndex: 75 },
  backdrop: { zIndex: 80, backgroundColor: 'rgba(17,18,19,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 22,
    borderRadius: 18,
    backgroundColor: DIALOG_BG,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 24,
  },
  emoji: { fontSize: 64, lineHeight: 76, textAlign: 'center', marginVertical: 14 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  message: { textAlign: 'center', marginTop: 4, lineHeight: 24, fontSize: 16 },
  btn: { flex: 1, height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  btnOutline: { borderWidth: 1.5, borderColor: DIALOG_GREEN, backgroundColor: 'transparent' },
  btnText: { fontFamily: fonts.bold, fontSize: 16 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  secret: { minHeight: 48 },
  input: { alignSelf: 'stretch', minHeight: 72, maxHeight: 140, marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#2A2B2E', paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: '#FFFFFF', textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 22 },
});
