import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, space } from '../theme';
import { Text } from './Text';

/** Top bar for pushed (stack) screens: back button, title, optional right action. */
export function ScreenHeader({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean }) {
  return (
    <View style={styles.row}>
      {back ? (
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="h2" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color={colors.textMuted} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: 46, height: 46, borderRadius: radius.pill, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder, shadowColor: '#1C1D1F', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1, alignItems: 'center', justifyContent: 'center' },
});
