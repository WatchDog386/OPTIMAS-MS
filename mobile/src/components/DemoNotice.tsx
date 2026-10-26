import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DEMO_TOKEN } from '../api/demoToken';
import { useAuth } from '../store/auth';
import { colors, fonts, radius } from '../theme';
import { Text } from './Text';

/** Shown only when signed in with the demo account: says the numbers are samples and offers a way out. */
export function DemoNotice({ style }: { style?: StyleProp<ViewStyle> }) {
  const demo = useAuth((s) => s.token === DEMO_TOKEN);
  if (!demo) return null;
  const exit = async () => {
    await useAuth.getState().logout();
    router.replace('/login');
  };
  return (
    <View style={[styles.box, style]} accessibilityRole="alert">
      <Ionicons name="flask-outline" size={18} color={colors.navy} />
      <Text variant="bodySm" style={{ flex: 1 }}>
        <Text variant="bodySm" style={{ fontFamily: fonts.semibold }}>
          Demo data.
        </Text>{' '}
        Sample staff, jobs and stock so you can see the app full. Nothing is saved.
      </Text>
      <Pressable onPress={exit} hitSlop={8} style={styles.exit} accessibilityRole="button" accessibilityLabel="Exit demo">
        <Text variant="label" color={colors.onPrimary} style={{ fontFamily: fonts.semibold }}>
          Exit
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.highlight, borderRadius: radius.lg, paddingVertical: 10, paddingLeft: 14, paddingRight: 10 },
  exit: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
});
