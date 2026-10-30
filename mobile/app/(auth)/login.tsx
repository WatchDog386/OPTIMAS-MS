import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/api/client';
import type { User } from '../../src/api/types';
import { Button, GlassBackground, InstallButton, Input, Reveal, SignInLoader, Text } from '../../src/components';
import { afterLogin, useAuth } from '../../src/store/auth';
import { colors, fonts, radius, space } from '../../src/theme';
import { biometricAvailable, loginWithBiometric } from '../../src/utils/biometric';
import { toast } from '../../src/store/feedback';

const MAX_W = 480;
/** Corner radius shared by the fields and the Sign in button */
const CORNER = 14;
const HERO = require('../../assets/login-fiber.webp');
const HERO_RATIO = 900 / 793; // width / height of assets/login-fiber.webp

/** Sign-in: brand, a short welcome and one frosted card with the form, on the dashboards' own backdrop. */
export default function Login() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.min(winW, MAX_W);
  // Free space between the top bar and the form; the picture is sized to fit it exactly (never larger)
  const [area, setArea] = useState({ w: 0, h: 0 });
  const heroH = Math.max(0, Math.min((area.h - 16) * 0.55, area.w / HERO_RATIO, 160));
  const heroW = heroH * HERO_RATIO;
  const heroIn = useRef(new Animated.Value(0)).current;
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<User | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    void biometricAvailable().then(setBioAvailable);
  }, []);

  const signInWithFingerprint = async () => {
    if (!identifier.trim()) {
      setError('Enter your staff or account number first.');
      return;
    }
    setError(null);
    setBioBusy(true);
    try {
      const user = await loginWithBiometric(identifier.trim());
      setSignedIn(user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Fingerprint sign-in failed');
    } finally {
      setBioBusy(false);
    }
  };

  const downloadAndroid = async () => {
    // Replace this URL with the actual hosted APK download link.
    const url = 'https://your-domain.com/download/Optimas-MS.apk';
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else setError('Download link not configured. Ask your administrator for the APK.');
  };

  // The picture eases in once, as soon as its space is known
  useEffect(() => {
    if (area.h > 0) Animated.timing(heroIn, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [area.h > 0, heroIn]);

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
      setSignedIn(user); // the loader hands over to the dashboard when it is ready
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  const help = () => router.push('/help');
  // The ⊗ starts the sign-in over (a web app cannot close itself)
  const clear = () => {
    setIdentifier('');
    setPassword('');
    setError(null);
  };

  const onChange = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (error) setError(null);
  };

  return (
    <View style={styles.root}>
      <GlassBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { minHeight: winH }]} keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
          <View style={[styles.column, { width: W, paddingTop: insets.top + 16, paddingBottom: insets.bottom + space.lg }]}>
            <View style={styles.topBar}>
              <Text variant="title" color={colors.text} style={styles.brandText}>
                Optimas Networks
              </Text>
              <View style={styles.topRight}>
                <InstallButton />
                {/* Capsule like a mini-app's: ··· opens help, ⊗ clears the form */}
                <View style={styles.capsule}>
                  <Pressable onPress={help} hitSlop={6} style={styles.capsuleHalf} accessibilityRole="button" accessibilityLabel="Help for customers and technicians">
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
                  </Pressable>
                  <View style={styles.capsuleLine} />
                  <Pressable onPress={clear} hitSlop={6} style={styles.capsuleHalf} accessibilityRole="button" accessibilityLabel="Clear the sign-in form">
                    <Ionicons name="close-circle-outline" size={20} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* The Fiber-to-the-Home picture, as is — no frame, no mask; it fills the space above the form */}
            <View style={styles.heroArea} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
              {area.h > 0 ? (
                <Animated.View style={[styles.heroCenter, { opacity: heroIn, transform: [{ translateY: heroIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]} pointerEvents="none">
                  <Image source={HERO} style={{ width: heroW, height: heroH }} resizeMode="contain" accessibilityLabel="Fiber to the home" />
                </Animated.View>
              ) : null}
            </View>

            <View style={styles.main}>
              <Reveal index={0} style={styles.intro}>
                <Text style={styles.headline} accessibilityRole="header">
                  Welcome back
                </Text>
              </Reveal>

              <Reveal index={1} style={styles.card}>
                <Input
                  label="Staff or account number"
                  icon="id-card-outline"
                  placeholder="e.g. FBI-TEC-001"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  value={identifier}
                  onChangeText={onChange(setIdentifier)}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                  returnKeyType="next"
                  fieldStyle={styles.field}
                />
                <View>
                  <Input
                    label="Password"
                    icon="lock-closed-outline"
                    placeholder="Your password"
                    ref={passwordRef}
                    secureTextEntry={!showPassword}
                    autoComplete="current-password"
                    textContentType="password"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={password}
                    onChangeText={onChange(setPassword)}
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

                {bioAvailable ? (
                  <View style={styles.bioRow}>
                    <Pressable
                      onPress={signInWithFingerprint}
                      disabled={bioBusy || !identifier.trim()}
                      accessibilityRole="button"
                      accessibilityLabel="Sign in with your fingerprint"
                      style={[{ ...styles.bioButton, backgroundColor: '#25D366' }, !identifier.trim() && styles.bioButtonOff]}
                    >
                      <Ionicons name={bioBusy ? 'reload-circle' : 'finger-print'} size={22} color={colors.white} />
                      <Text variant="label" style={[styles.bioText, { color: colors.white, fontWeight: '600' }]}>
                        {bioBusy ? 'Touch the sensor…' : 'Sign in with fingerprint'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <Button label="Sign in" size="lg" trailingIcon="arrow-forward-circle-outline" loading={loading} onPress={submit} style={styles.signIn} />

                <Pressable onPress={downloadAndroid} style={styles.download} accessibilityLabel="Download the Optimas MS app for Android">
                  <Ionicons name="download-outline" size={20} color={colors.white} />
                  <Text variant="label" style={{ color: colors.white, fontWeight: '600' }}>
                    Download for Android
                  </Text>
                </Pressable>
              </Reveal>

              <Text variant="label" color={colors.textDim} align="center" style={styles.legal}>
                By signing in you agree to the{' '}
                <Text variant="label" style={styles.legalLink} onPress={() => router.push('/terms')} accessibilityRole="link">
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text variant="label" style={styles.legalLink} onPress={() => router.push('/privacy')} accessibilityRole="link">
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>

            <View style={styles.secure}>
              <Ionicons name="lock-closed" size={11} color={colors.textDim} />
              <Text variant="label" color={colors.textDim} style={{ fontSize: 11 }}>
                Secure sign-in · Optimas Wi-Fi
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {signedIn ? <SignInLoader user={signedIn} onDone={() => router.replace(afterLogin(signedIn) as never)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBottom },
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: { flex: 1, paddingHorizontal: space.lg },
  brandText: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, zIndex: 20 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  capsule: { flexDirection: 'row', alignItems: 'center', height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(28,29,31,0.08)', shadowColor: '#1C1D1F', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  capsuleHalf: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  capsuleLine: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: 'rgba(28,29,31,0.18)' },
  // Content sits in the lower part of the screen, within thumb reach
  // Sits a little higher than the very bottom so the form is easier to reach and read
  main: { gap: 18, paddingTop: 10, paddingBottom: space.lg, marginBottom: 30 },
  intro: { alignItems: 'center', paddingHorizontal: 4 },
  // Same face and size as the dashboard card titles ("Jobs done / This week")
  headline: { fontFamily: fonts.medium, fontSize: 24, lineHeight: 29, letterSpacing: -0.3, color: colors.text, textAlign: 'center' },
  // The picture sits in the free space above the form; it is overlaid so it can never push the form off screen
  heroArea: { flex: 1, minHeight: 170 },
  heroCenter: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  card: { gap: 14 },
  // Soft, slightly rounded corners (not pills) with a fine edge so white fields read on the grey page
  field: { backgroundColor: '#FFFFFF', minHeight: 56, borderRadius: CORNER, shadowColor: '#1C1D1F', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  signIn: { borderRadius: CORNER, marginTop: 4 },
  eye: { position: 'absolute', right: space.lg, bottom: 18 },
  bioRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 10 },
  bioButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: CORNER, paddingHorizontal: space.md, shadowColor: '#1C1D1F', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  bioButtonOff: { opacity: 0.55 },
  bioText: { fontFamily: fonts.semibold, fontSize: 15 },
  download: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: CORNER, backgroundColor: colors.primary, paddingHorizontal: space.md, shadowColor: '#1C1D1F', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  error: { flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: colors.dangerSoft, padding: space.md, borderRadius: radius.md },
  legal: { marginTop: 4, paddingHorizontal: 12, lineHeight: 18 },
  legalLink: { textDecorationLine: 'underline', color: colors.textMuted },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
});
