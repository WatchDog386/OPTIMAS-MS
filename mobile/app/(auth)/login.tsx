import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/api/client';
import type { User } from '../../src/api/types';
import { Button, Input, Text } from '../../src/components';
import { isManager, useAuth } from '../../src/store/auth';
import { colors, gradients, radius, space } from '../../src/theme';

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
      <LinearGradient colors={['#13254F', colors.bg]} style={StyleSheet.absoluteFill} start={{ x: 0.2, y: 0 }} end={{ x: 0.5, y: 0.6 }} />
      <View style={styles.glow} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
          <View style={styles.brand}>
            <LinearGradient colors={gradients.brand} style={styles.logo}>
              <Ionicons name="flash" size={30} color={colors.onPrimary} />
            </LinearGradient>
            <Text variant="display">
              Optimas<Text variant="display" color={colors.primary}> MS</Text>
            </Text>
            <Text variant="body" color={colors.textMuted}>
              Field operations, attendance and stock — all in one place.
            </Text>
          </View>

          <View style={styles.form}>
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
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textDim}
                style={styles.eye}
                onPress={() => setShowPassword((v) => !v)}
              />
            </View>
            {error ? (
              <View style={styles.error}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text variant="bodySm" color={colors.danger} style={{ flex: 1 }}>
                  {error}
                </Text>
              </View>
            ) : null}
            <Button label="Sign in" icon="arrow-forward" size="lg" loading={loading} disabled={!identifier || !password} onPress={submit} />
          </View>

          <Text variant="label" color={colors.textDim} align="center">
            Trouble signing in? Contact your supervisor.
          </Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: -120, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: colors.primary, opacity: 0.08 },
  body: { flex: 1, padding: space.xl, justifyContent: 'space-between' },
  brand: { marginTop: space.xxxl, gap: space.md },
  logo: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  form: { gap: space.lg },
  eye: { position: 'absolute', right: space.lg, bottom: 16 },
  error: { flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: colors.dangerSoft, padding: space.md, borderRadius: radius.md },
});
