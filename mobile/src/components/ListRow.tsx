import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space } from '../theme';
import { Text } from './Text';

interface Props {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconTint?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}

export function ListRow({ title, subtitle, icon, iconTint = colors.primary, left, right, onPress, chevron = !!onPress }: Props) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      android_ripple={{ color: 'rgba(15,23,42,0.06)' }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.glassStrong }]}
    >
      {left ??
        (icon ? (
          <View style={[styles.icon, { backgroundColor: `${iconTint}14` }]}>
            <Ionicons name={icon} size={20} color={iconTint} />
          </View>
        ) : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color={colors.textMuted} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.textDim} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.glass,
    borderRadius: radius.xl - 4,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: space.md + 2,
    overflow: 'hidden',
  },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
