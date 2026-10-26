import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/api/client';
import type { User } from '../../src/api/types';
import { Button, InstallButton, Input, LoginShowcase, Text } from '../../src/components';
import { afterLogin, useAuth } from '../../src/store/auth';
import { colors, fonts, radius, space } from '../../src/theme';

/** Onboarding slides, one per audience; the showcase above previews that person's dashboard. */
const SLIDES = [
  {
    tag: 'Technicians',
    title: 'Check in.\nGet to work.',
    body: 'A dress-code selfie starts your shift, then work through your jobs with before-and-after proof.',
  },
  {
    tag: 'Supervisors',
    title: 'Every router,\naccounted for.',
    body: 'Assign work, verify proof photos and see where every serialised device is right now.',
  },
  {
    tag: 'Customers',
    title: 'Follow your\ntechnician live.',
    body: 'Report a fault, track the visit as it happens and see what was installed at your premises.',
  },
];

const MAX_W = 480;

export default function Login() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.min(winW, MAX_W);
  const showcaseH = Math.round(Math.max(200, Math.min(winH * 0.33, 300)));

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  // Rotate slides until the person starts typing.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [slide, fade]);

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError('Enter your staff or account number and your password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api<{ token: string; user: User }>('/auth/login', { body: { identifier: identifier.trim(), password } });
      await useAuth.getState().setSession(token, user);
      router.replace(afterLogin(user) as never);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  const help = () => {
    const msg = 'Staff: sign in with your staff number (e.g. OPT-TEC-001).\nCustomers: use your Optimas account number.\n\nForgot your password? Ask your supervisor or call Optimas support.';
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('Signing in', msg);
  };

  const s = SLIDES[slide];
  const rise = fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.bgTop, '#FFFFFF']} locations={[0, 0.7]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { minHeight: winH }]} keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
          <View style={[styles.column, { width: W, paddingTop: insets.top + 12 }]}>
            {/* Brand bar */}
            <View style={styles.topBar}>
              <View style={styles.brand}>
                <View style={styles.logo}>
                  <Ionicons name="flash" size={18} color={colors.highlight} />
                </View>
                <Text variant="title" style={styles.brandText}>
                  Optimas{' '}
                  <Text variant="title" color={colors.textMuted} style={styles.brandText}>
                    MS
                  </Text>
                </Text>
              </View>
              <InstallButton />
            </View>

            {/* Product showcase */}
            <LoginShowcase width={W} height={showcaseH} slide={slide} />

            {/* Copy + form, anchored to the bottom */}
            <View style={[styles.body, { paddingBottom: insets.bottom + space.lg }]}>
              <Animated.View style={{ gap: 10, opacity: fade, transform: [{ translateY: rise }] }}>
                <View style={styles.tag}>
                  <View style={styles.tagDot} />
                  <Text variant="label" style={styles.tagText}>
                    For {s.tag.toLowerCase()}
                  </Text>
                </View>
                <Text style={styles.headline} accessibilityRole="header">
                  {s.title}
                </Text>
                <Text variant="bodySm" color={colors.textMuted} style={{ lineHeight: 19 }}>
                  {s.body}
                </Text>
              </Animated.View>

              <View style={styles.dots}>
                {SLIDES.map((sl, i) => (
                  <Pressable
                    key={sl.tag}
                    onPress={() => {
                      setSlide(i);
                      setPaused(true);
                    }}
                    hitSlop={8}
                    accessibilityLabel={`Slide ${i + 1}`}
                  >
                    <View style={[styles.dot, i === slide && styles.dotActive]} />
                  </Pressable>
                ))}
              </View>

              <Input
                label="Staff number, account number or email"
                icon="id-card-outline"
                placeholder="e.g. OPT-TEC-001"
                autoCapitalize="characters"
                autoCorrect={false}
                value={identifier}
                onFocus={() => setPaused(true)}
                onChangeText={(v) => {
                  setIdentifier(v);
                  if (error) setError(null);
                }}
                returnKeyType="next"
                fieldStyle={styles.field}
              />
              <View>
                <Input
                  label="Password"
                  icon="lock-closed-outline"
                  placeholder="Your password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onFocus={() => setPaused(true)}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (error) setError(null);
                  }}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                  fieldStyle={styles.field}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eye} hitSlop={10} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textDim} />
                </Pressable>
              </View>

              {error ? (
                <View style={styles.error} accessibilityLiveRegion="polite">
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text variant="bodySm" color={colors.danger} style={{ flex: 1 }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <View style={styles.actions}>
                <Button label="Sign in" size="lg" trailingIcon="arrow-forward-circle-outline" loading={loading} onPress={submit} style={{ flex: 1.5 }} />
                <Button label="Help" size="lg" variant="secondary" onPress={help} style={styles.helpBtn} />
              </View>

              <View style={styles.secure}>
                <Ionicons name="lock-closed" size={11} color={colors.textDim} />
                <Text variant="label" color={colors.textDim} style={{ fontSize: 11 }}>
                  Secure sign-in · Optimas Wi-Fi
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, minHeight: 46 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.charcoal, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontFamily: fonts.bold, fontSize: 17 },
  body: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.md, gap: 12 },
  tag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(28,29,31,0.05)' },
  tagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  tagText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.text },
  // Same face as the dashboard card titles ("Jobs done / This week"), one step larger
  headline: { fontFamily: fonts.medium, fontSize: 30, lineHeight: 35, letterSpacing: -0.6, color: colors.text },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(28,29,31,0.18)' },
  dotActive: { width: 24, backgroundColor: colors.charcoal },
  field: { backgroundColor: '#F2F2F2', minHeight: 54 },
  helpBtn: { flex: 1, backgroundColor: '#EBEBEB', borderColor: '#EBEBEB' },
  eye: { position: 'absolute', right: space.lg, bottom: 17 },
  error: { flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: colors.dangerSoft, padding: space.md, borderRadius: radius.md },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 2 },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 2 },
});
