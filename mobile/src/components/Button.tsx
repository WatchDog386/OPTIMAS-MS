import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadow, space } from '../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: ViewStyle;
}

const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.surfaceAlt, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.primary },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, size = 'md', style }: Props) {
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.lg,
        { backgroundColor: p.bg, borderColor: p.border ?? 'transparent' },
        variant === 'primary' && !inactive && shadow.glow,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        inactive && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 22 : 18} color={p.fg} /> : null}
          <Text variant="title" color={p.fg} style={size === 'lg' ? { fontSize: 17 } : undefined}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, borderWidth: 1 },
  lg: { height: 58 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
