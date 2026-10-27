import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/api/client';
import type { User } from '../../src/api/types';
import { Button, GlassBackground, InstallButton, Input, Reveal, SignInLoader, Text } from '../../src/components';
import { afterLogin, useAuth } from '../../src/store/auth';
import { alertDialog } from '../../src/store/feedback';
import { colors, fonts, radius, space } from '../../src/theme';
import { NATIVE, spring } from '../../src/utils/motion';

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
  const [menu, setMenu] = useState(false);

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

  // Sample data for looking around without an account; the API client answers it locally and saves nothing
  const startDemo = async () => {
    const [{ demoAdmin }, { DEMO_TOKEN }] = await Promise.all([import('../../src/demo/data'), import('../../src/api/demoToken')]);
    await useAuth.getState().setSession(DEMO_TOKEN, demoAdmin);
    setSignedIn(demoAdmin);
  };

  const openSite = () => {
    setMenu(false);
    void Linking.openURL('https://optimaswifi.co.ke');
  };

  const help = () => {
    setMenu(false);
    const msg = 'Staff: sign in with your staff number (e.g. OPT-TEC-001).\nCustomers: use your Optimas account number.\n\nForgot your password? Ask your supervisor or call Optimas support.';
    void alertDialog({ title: 'Signing in', message: msg, icon: 'help-buoy-outline', confirmLabel: 'Got it' });
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
                <Pressable onPress={() => setMenu((m) => !m)} style={styles.helpBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Help and website" accessibilityState={{ expanded: menu }}>
                  <Ionicons name="help" size={20} color={colors.text} />
                </Pressable>
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
                  placeholder="e.g. OPT-TEC-001"
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

                <Button label="Sign in" size="lg" trailingIcon="arrow-forward-circle-outline" loading={loading} onPress={submit} style={styles.signIn} />
              </Reveal>

              <Pressable onPress={startDemo} hitSlop={8} style={styles.help} accessibilityRole="button" accessibilityLabel="Explore with demo data">
                <Text variant="bodySm" style={{ fontFamily: fonts.semibold, textDecorationLine: 'underline' }} color={colors.navy}>
                  Explore with demo data
                </Text>
              </Pressable>

              <Pressable onPress={help} hitSlop={8} style={styles.help} accessibilityRole="button">
                <Text variant="bodySm" color={colors.textMuted}>
                  Trouble signing in?{' '}
                  <Text variant="bodySm" style={{ fontFamily: fonts.semibold, textDecorationLine: 'underline' }}>
                    Get help
                  </Text>
                </Text>
              </Pressable>
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
      <HelpMenu open={menu} top={insets.top + 16 + 46 + 4} onClose={() => setMenu(false)} onHelp={help} onSite={openSite} />
      {signedIn ? <SignInLoader user={signedIn} onDone={() => router.replace(afterLogin(signedIn) as never)} /> : null}
    </View>
  );
}

/** The two things the "?" button offers: sign-in help, or the company website. Springs open from the button. */
function HelpMenu({ open, top, onClose, onHelp, onSite }: { open: boolean; top: number; onClose: () => void; onHelp: () => void; onSite: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open) return void v.setValue(0);
    Animated.spring(v, { toValue: 1, ...spring.pop, useNativeDriver: NATIVE }).start();
  }, [open, v]);
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close menu">
        <View style={{ position: 'absolute', top, right: space.lg }}>
          <Animated.View
            accessibilityRole="menu"
            style={[styles.menu, { opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }), transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}
          >
            <Pressable onPress={onHelp} style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.surfaceAlt }]} accessibilityRole="menuitem">
              <Ionicons name="help-buoy-outline" size={20} color={colors.text} />
              <Text variant="title" style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
                Get help
              </Text>
            </Pressable>
            <View style={styles.menuLine} />
            <Pressable onPress={onSite} style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.surfaceAlt }]} accessibilityRole="menuitem">
              <Ionicons name="globe-outline" size={20} color={colors.text} />
              <Text variant="title" style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
                Visit optimaswifi.co.ke
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBottom },
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: { flex: 1, paddingHorizontal: space.lg },
  brandText: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, zIndex: 20 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  helpBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder, shadowColor: '#1C1D1F', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  menu: { minWidth: 236, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(28,29,31,0.06)', shadowColor: '#1C1D1F', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuLine: { height: 1, marginHorizontal: 14, backgroundColor: colors.border },
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
  error: { flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: colors.dangerSoft, padding: space.md, borderRadius: radius.md },
  help: { alignSelf: 'center' },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
});
