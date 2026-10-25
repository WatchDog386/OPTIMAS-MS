import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius, shadow, space, useInverse } from '../theme';
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
  /** Icon shown after the label (e.g. the circled arrow on "MORE ⊕" style buttons). */
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  /** Uppercase, heavier label for editorial call-to-actions. */
  caps?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Material 3 buttons: filled (primary), outlined (secondary), text (ghost), and tonal danger. */
const light: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.glassStrong, fg: colors.text, border: colors.glassBorder },
  ghost: { bg: 'transparent', fg: colors.primary },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

/** On navy hero cards the primary action becomes the lime brand button. */
const inverse: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.highlight, fg: colors.onHighlight },
  secondary: { bg: colors.heroInset, fg: colors.onHero, border: colors.heroBorder },
  ghost: { bg: 'transparent', fg: colors.onHero },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

export function Button({ label, onPress, variant = 'primary', icon, trailingIcon, caps, loading, disabled, size = 'md', style }: Props) {
  const p = (useInverse() ? inverse : light)[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.lg,
        { backgroundColor: p.bg, borderColor: p.border ?? 'transparent' },
        variant === 'primary' && !inactive && shadow.glow,
        pressed && { opacity: 0.88 },
        inactive && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 20 : 18} color={p.fg} /> : null}
          <Text
            variant="title"
            color={p.fg}
            style={[{ fontSize: size === 'lg' ? 16 : 15 }, caps && { fontFamily: fonts.bold }]}
          >
            {label}
          </Text>
          {trailingIcon ? <Ionicons name={trailingIcon} size={size === 'lg' ? 20 : 18} color={p.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  lg: { height: 52 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
