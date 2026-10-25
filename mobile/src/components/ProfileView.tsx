import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useAuth } from '../store/auth';
import { unregisterPush } from '../utils/push';
import { confirmAction } from '../utils/confirm';
import { colors, space } from '../theme';
import { humanize } from '../utils/format';
import { Avatar } from './Avatar';
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
        <Avatar name={user.name} size={72} />
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

const styles = StyleSheet.create({ card: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl } });
