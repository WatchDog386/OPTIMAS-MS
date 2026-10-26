import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../src/api/client';
import type { User } from '../src/api/types';
import { Button, Glass, Input, Screen, ScreenHeader, Text } from '../src/components';
import { homeFor, useAuth } from '../src/store/auth';
import { toast } from '../src/store/feedback';
import { colors, fonts } from '../src/theme';

const RULES = [
  { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p: string) => /[A-Za-z]/.test(p), label: 'Contains a letter' },
  { test: (p: string) => /\d/.test(p), label: 'Contains a number' },
];

/** Change password. With ?forced=1 (temporary password) the user cannot leave until it is changed. */
export default function ChangePassword() {
  const { forced } = useLocalSearchParams<{ forced?: string }>();
  const user = useAuth((s) => s.user);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = RULES.every((r) => r.test(next)) && next === confirm && current.length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ user: User }>('/auth/change-password', { body: { currentPassword: current, newPassword: next } });
      await useAuth.getState().updateUser(res.user);
      toast.success('Password changed', 'Use your new password next time you sign in.');
      router.replace(homeFor(res.user.role));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Save new password" icon="checkmark" size="lg" loading={busy} disabled={!valid} onPress={submit} />}>
      <ScreenHeader
        back={!forced}
        title={forced ? 'Set your password' : 'Change password'}
        subtitle={forced ? `Welcome${user ? `, ${user.name.split(' ')[0]}` : ''} — replace the temporary password` : 'Use something only you know'}
      />
      {forced ? (
        <Glass strong style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Ionicons name="shield-checkmark" size={26} color={colors.text} />
          <Text variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
            You signed in with a temporary password from your administrator. Choose your own password to continue.
          </Text>
        </Glass>
      ) : null}
      <Glass strong style={{ gap: 14 }}>
        <Input label={forced ? 'Temporary password' : 'Current password'} icon="key-outline" secureTextEntry value={current} onChangeText={setCurrent} />
        <Input label="New password" icon="lock-closed-outline" secureTextEntry value={next} onChangeText={setNext} />
        <Input label="Repeat new password" icon="lock-closed-outline" secureTextEntry value={confirm} onChangeText={setConfirm} error={confirm && next !== confirm ? 'Passwords do not match' : undefined} />
        <View style={{ gap: 6 }}>
          {RULES.map((r) => {
            const ok = r.test(next);
            return (
              <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={ok ? colors.success : colors.textDim} />
                <Text variant="bodySm" color={ok ? colors.text : colors.textMuted} style={ok ? { fontFamily: fonts.semibold } : undefined}>
                  {r.label}
                </Text>
              </View>
            );
          })}
        </View>
        {error ? (
          <Text variant="bodySm" color={colors.danger}>
            {error}
          </Text>
        ) : null}
      </Glass>
      {forced ? (
        <Button
          label="Sign out instead"
          variant="ghost"
          onPress={async () => {
            await useAuth.getState().logout();
            router.replace('/login');
          }}
        />
      ) : null}
    </Screen>
  );
}
