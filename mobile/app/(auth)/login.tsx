import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/api/client';
import type { User } from '../../src/api/types';
import { Button, Input, Text } from '../../src/components';
import { isManager, useAuth } from '../../src/store/auth';
import { colors, gradients, radius, space, SurfaceContext } from '../../src/theme';

const HIGHLIGHTS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'scan-outline', label: 'Check-in' },
  { icon: 'briefcase-outline', label: 'Jobs' },
  { icon: 'wifi-outline', label: 'Devices' },
];

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api<{ token: string; user: User }>('/auth/login', { body: { identifier, password } });
      await useAuth.getState().setSession(token, user);
      router.replace(isManager(user.role) ? '/overview' : '/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
          {/* Brand header */}
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <SurfaceContext.Provider value={{ inverse: true }}>
              <SafeAreaView edges={['top']} style={{ gap: space.lg }}>
                <View style={styles.logoRow}>
                  <LinearGradient colors={gradients.brand} style={styles.logo}>
                    <Ionicons name="flash" size={24} color={colors.onBrand} />
                  </LinearGradient>
                  <Text variant="h2">
                    Optimas <Text variant="h2" color={colors.lime}>MS</Text>
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text variant="h1">Field operations, simplified.</Text>
                  <Text variant="body" color={colors.textMuted}>
                    Attendance, jobs and stock for the Optimas team.
                  </Text>
                </View>
                <View style={styles.chips}>
                  {HIGHLIGHTS.map((h) => (
                    <View key={h.label} style={styles.chip}>
                      <Ionicons name={h.icon} size={14} color={colors.lime} />
                      <Text variant="label">{h.label}</Text>
                    </View>
                  ))}
                </View>
              </SafeAreaView>
            </SurfaceContext.Provider>
          </LinearGradient>

          {/* Form */}
          <SafeAreaView edges={['bottom']} style={styles.form}>
            <View style={{ gap: 4 }}>
              <Text variant="h1">Welcome back</Text>
              <Text variant="bodySm" color={colors.textMuted}>
                Sign in with your staff number or work email.
              </Text>
            </View>

            <Input
              label="Staff number or email"
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
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eye}
                hitSlop={10}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
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

            <Button label="Sign in" size="lg" loading={loading} disabled={!identifier || !password} onPress={submit} />

            <View style={styles.help}>
              <Ionicons name="help-circle-outline" size={16} color={colors.textDim} />
              <Text variant="label" color={colors.textDim}>
                Forgot your password? Ask your supervisor to reset it.
              </Text>
            </View>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.xl, paddingBottom: space.xxl + space.lg, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  logo: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.heroInset },
  form: { flex: 1, padding: space.xl, paddingTop: space.xxl, gap: space.lg },
  eye: { position: 'absolute', right: space.lg, bottom: 17 },
  error: { flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: colors.dangerSoft, padding: space.md, borderRadius: radius.md },
  help: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: space.sm },
});
