import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/api/client';
import type { User } from '../../src/api/types';
import { Button, GlassBackground, InstallButton, Input, SignInLoader, Text } from '../../src/components';
import { afterLogin, useAuth } from '../../src/store/auth';
import { alertDialog } from '../../src/store/feedback';
import { colors, fonts, radius, space } from '../../src/theme';

const MAX_W = 480;
const LOGO = require('../../assets/logo.png');
const LOGO_RATIO = 1023 / 389; // width / height of assets/logo.png

/** Sign-in: brand, a short welcome and one frosted card with the form, on the dashboards' own backdrop. */
export default function Login() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.min(winW, MAX_W);
  // The image gets the height left after the brand bar and the form (~510 px), within limits
  const logoW = Math.round(Math.min(W - space.lg * 2, 340));

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<User | null>(null);

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

  const help = () => {
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
              <View />
              <InstallButton />
            </View>

            {/* The Optimas logo, as is — no frame, no mask */}
            <View style={styles.logoArea}>
              <Image source={LOGO} style={{ width: logoW, height: logoW / LOGO_RATIO }} resizeMode="contain" accessibilityLabel="Optimas Networks" />
            </View>

            <View style={styles.main}>
              <View style={styles.intro}>
                <Text style={styles.headline} accessibilityRole="header">
                  Welcome back
                </Text>
                <Text variant="bodySm" color={colors.textMuted}>
                  Sign in to see today’s jobs, stock and visits.
                </Text>
              </View>

              <View style={styles.card}>
                <Input
                  label="Staff or account number"
                  icon="id-card-outline"
                  placeholder="e.g. OPT-TEC-001"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={identifier}
                  onChangeText={onChange(setIdentifier)}
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

                <Button label="Sign in" size="lg" trailingIcon="arrow-forward-circle-outline" loading={loading} onPress={submit} />
              </View>

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
      {signedIn ? <SignInLoader user={signedIn} onDone={() => router.replace(afterLogin(signedIn) as never)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBottom },
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: { flex: 1, paddingHorizontal: space.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46 },
  // Content sits in the lower part of the screen, within thumb reach
  main: { gap: 18, paddingTop: 10, paddingBottom: space.lg },
  intro: { gap: 8, paddingHorizontal: 4 },
  // Same face and size as the dashboard card titles ("Jobs done / This week")
  headline: { fontFamily: fonts.medium, fontSize: 24, lineHeight: 29, letterSpacing: -0.3, color: colors.text },
  // The logo takes the space above the form and sits in the middle of it
  logoArea: { flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  card: { gap: 14 },
  field: { backgroundColor: '#FFFFFF', minHeight: 56 },
  eye: { position: 'absolute', right: space.lg, bottom: 18 },
  error: { flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: colors.dangerSoft, padding: space.md, borderRadius: radius.md },
  help: { alignSelf: 'center' },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
});
