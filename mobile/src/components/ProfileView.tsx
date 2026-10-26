import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useAuth } from '../store/auth';
import { unregisterPush } from '../utils/push';
import { confirmAction } from '../utils/confirm';
import { colors, space } from '../theme';
import { humanize } from '../utils/format';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

/** Shared profile header + sign-out used by both technician and manager apps. */
export function ProfileView({ children }: { children?: ReactNode }) {
  const user = useAuth((s) => s.user)!;
  const signOut = async () => {
    if (!(await confirmAction('Sign out', 'Are you sure you want to sign out?', 'Sign out'))) return;
    await unregisterPush();
    await useAuth.getState().logout();
    router.replace('/login');
  };

  return (
    <>
      <Card variant="hero" style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="person" size={44} color={colors.onHighlight} />
        </View>
        <Text variant="h2" align="center">
          {user.name}
        </Text>
        <Text variant="bodySm" color={colors.textMuted}>
          {user.staffNo}
          {user.region ? ` · ${user.region}` : ''}
        </Text>
        <Badge label={humanize(user.role)} tone="brand" />
      </Card>
      {children}
      <Button label="Sign out" icon="log-out-outline" variant="danger" onPress={signOut} />
      <Text variant="label" color={colors.textDim} align="center">
        Optimas MS v1.0.0
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  icon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' }, card: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl } });
