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
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
      {left ??
        (icon ? (
          <View style={[styles.icon, { backgroundColor: `${iconTint}1F` }]}>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md + 2 },
  icon: { width: 42, height: 42, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
});
