import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/api/client';
import type { User } from '../../src/api/types';
import { Button, GlassBackground, InstallPill, Input, Text } from '../../src/components';
import { afterLogin, useAuth } from '../../src/store/auth';
import { colors, fonts, gradients, radius, space } from '../../src/theme';

/** Rotating headline slides (editorial onboarding layout). */
const SLIDES = [
  { tag: 'For technicians', title: 'Check in.\nGet to work.', kicker: 'Live selfie · GPS · shift timer', body: 'Start your day with a dress-code photo, then follow your jobs with before-and-after proof.', icon: 'scan' as const },
  { tag: 'For supervisors', title: 'Every router\naccounted for', kicker: 'Jobs · stock · attendance', body: 'Assign work, verify proof photos and see where every serialised device is right now.', icon: 'wifi' as const },
  { tag: 'For customers', title: 'Track your\ntechnician', kicker: 'Requests · visits · support', body: 'Report a fault, follow the visit live and see what was installed at your premises.', icon: 'home' as const },
];

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 4500);
    return () => clearInterval(t);
  }, []);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api<{ token: string; user: User }>('/auth/login', { body: { identifier, password } });
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

  return (
    <View style={styles.root}>
      <GlassBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
          {/* Diagonal hero */}
          <View style={styles.hero}>
            <LinearGradient colors={['#2C2D30', '#121314']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.diamondDark} />
            <View style={styles.diamondOutline} />
            <SafeAreaView edges={['top']} style={styles.heroInner}>
              <View style={styles.brand}>
                <LinearGradient colors={gradients.lime} style={styles.logo}>
                  <Ionicons name="flash" size={20} color={colors.onHighlight} />
                </LinearGradient>
                <Text variant="title" color={colors.white} fixedColor style={{ fontFamily: fonts.bold }}>
                  Optimas <Text variant="title" color={colors.highlight} fixedColor style={{ fontFamily: fonts.bold }}>MS</Text>
                </Text>
              </View>
              <View style={styles.heroIcon}>
                <Ionicons name={s.icon} size={52} color={colors.white} />
              </View>
            </SafeAreaView>
          </View>

          <SafeAreaView edges={['bottom']} style={styles.body}>
            {/* Slide copy */}
            <View style={styles.tag}>
              <Text variant="label" color={colors.white} fixedColor style={styles.tagText}>
                {s.tag}
              </Text>
            </View>
            <Text variant="display" style={styles.headline}>
              {s.title}
            </Text>
            <View style={styles.kicker}>
              <View style={styles.triangle} />
              <Text variant="bodySm" style={{ fontFamily: fonts.semibold }}>
                {s.kicker}
              </Text>
            </View>
            <Text variant="bodySm" color={colors.textMuted} style={{ marginTop: -4 }}>
              {s.body}
            </Text>
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <Pressable key={i} onPress={() => setSlide(i)} hitSlop={8} accessibilityLabel={`Slide ${i + 1}`}>
                  <View style={[styles.dot, i === slide && styles.dotActive]} />
                </Pressable>
              ))}
            </View>

            {/* Sign-in form */}
            <Input
              label="Staff number, account number or email"
              icon="id-card-outline"
              placeholder="e.g. OPT-TEC-001"
              autoCapitalize="characters"
              autoCorrect={false}
              value={identifier}
              onChangeText={setIdentifier}
              returnKeyType="next"
            />
            <View>
              <Input
                label="Password"
                icon="lock-closed-outline"
                placeholder="Your password"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
                returnKeyType="go"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eye} hitSlop={10} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textDim} />
              </Pressable>
            </View>

            {error ? (
              <View style={styles.error}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text variant="bodySm" color={colors.danger} style={{ flex: 1 }}>
                  {error}
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Button label="Sign in" caps size="lg" trailingIcon="arrow-forward-circle-outline" loading={loading} disabled={!identifier || !password} onPress={submit} style={{ flex: 1.4 }} />
              <Button label="Help" caps size="lg" variant="secondary" onPress={help} style={{ flex: 1 }} />
            </View>

            <InstallPill />
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBottom },
  hero: { height: 230, overflow: 'hidden' },
  // Big rotated squares make the diagonal edge, like the reference's cut image
  diamondDark: { position: 'absolute', width: 460, height: 460, top: -250, right: -170, borderRadius: 56, transform: [{ rotate: '45deg' }] },
  diamondOutline: { position: 'absolute', width: 380, height: 380, top: -170, right: -40, borderRadius: 52, borderWidth: 1.5, borderColor: 'rgba(28,29,31,0.08)', transform: [{ rotate: '45deg' }] },
  heroInner: { flex: 1, paddingHorizontal: space.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  logo: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroIcon: { position: 'absolute', right: 64, top: 64 },
  body: { flex: 1, paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.charcoal, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  tagText: { fontFamily: fonts.bold, letterSpacing: 0.8, textTransform: 'uppercase', fontSize: 11 },
  headline: { fontFamily: fonts.extrabold, fontSize: 27, lineHeight: 30, letterSpacing: -0.5, textTransform: 'uppercase' },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  triangle: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.charcoal,
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(28,29,31,0.2)' },
  dotActive: { width: 26, backgroundColor: colors.charcoal },
  eye: { position: 'absolute', right: space.lg, bottom: 14 },
  error: { flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: colors.dangerSoft, padding: space.md, borderRadius: radius.md },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});
