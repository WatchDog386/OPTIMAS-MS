import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { colors, fonts, radius, space } from '../theme';
import { OPENED_ON_DESKTOP } from '../theme/desktop';
import { desk } from '../theme/desk';
import { Text } from './Text';

/** Top bar for pushed (stack) screens: back button, title, optional right action. */
export function ScreenHeader({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean }) {
  return (
    <View style={styles.row}>
      {back ? (
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.back, OPENED_ON_DESKTOP && styles.deskBack]} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={OPENED_ON_DESKTOP ? 17 : 22} color={OPENED_ON_DESKTOP ? desk.ink : colors.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="h2" color={OPENED_ON_DESKTOP ? desk.strong : colors.text} fixedColor={OPENED_ON_DESKTOP} numberOfLines={1} style={OPENED_ON_DESKTOP ? { fontFamily: fonts.medium, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 } : { fontFamily: fonts.medium, fontSize: 17, letterSpacing: -0.2 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" color={OPENED_ON_DESKTOP ? desk.muted : colors.textMuted} fixedColor={OPENED_ON_DESKTOP} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  deskBack: { width: 36, height: 36, borderRadius: 4, backgroundColor: desk.panel, borderColor: desk.border, shadowOpacity: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: 46, height: 46, borderRadius: radius.pill, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder, shadowColor: '#1C1D1F', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1, alignItems: 'center', justifyContent: 'center' },
});
