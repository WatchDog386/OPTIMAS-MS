import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, space } from '../theme';
import { initials } from '../utils/format';
import { NotificationBell } from './NotificationBell';
import { Text } from './Text';

/** Dashboard top bar: glossy green avatar, centred title, bell (Business-SME header). */
export function DashboardHeader({ name, title, profileHref }: { name: string; title: string; profileHref: '/profile' | '/more' }) {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.push(profileHref)} accessibilityLabel="Profile" style={({ pressed }) => pressed && { transform: [{ scale: 0.95 }] }}>
        <LinearGradient colors={['#9BE15D', '#4CAF2E', '#2E7D1A', '#174D0C']} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.8, y: 1 }} style={styles.avatar}>
          <View style={styles.gloss} />
          <Text variant="h2" color={colors.white} fixedColor style={styles.initials}>
            {initials(name)}
          </Text>
        </LinearGradient>
      </Pressable>
      <Text variant="title" align="center" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.actions}>
        <NotificationBell />
      </View>
    </View>
  );
}

/** Small brand footer under dashboards. */
export function BrandFooter() {
  return (
    <View style={styles.footer}>
      <Ionicons name="shield-checkmark-outline" size={15} color={colors.textDim} />
      <Text variant="label" color={colors.textDim} style={{ fontSize: 11 }}>
        © {new Date().getFullYear()} Optimas Technologies Ltd.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  gloss: { position: 'absolute', top: 2, left: 6, right: 6, height: '50%', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.28)' },
  initials: { fontFamily: fonts.extrabold, fontSize: 17, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  title: { flex: 1, fontFamily: fonts.medium, fontSize: 16 },
  actions: { flexDirection: 'row', gap: space.sm },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space.sm },
});
