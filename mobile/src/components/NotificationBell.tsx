import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApi } from '../hooks/useApi';
import { colors } from '../theme';
import { Text } from './Text';

/** Header bell with unread count; refreshes whenever the screen regains focus. */
export function NotificationBell() {
  const { data } = useApi<{ unread: number }>('/notifications/unread-count');
  const unread = data?.unread ?? 0;
  return (
    <Pressable onPress={() => router.push('/notifications')} style={styles.btn} hitSlop={8} accessibilityLabel={`Notifications, ${unread} unread`}>
      <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={22} color={colors.text} />
      {unread ? (
        <View style={styles.badge}>
          <Text variant="label" color={colors.white} style={{ fontSize: 10, lineHeight: 12 }}>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceAlt,
  },
});
