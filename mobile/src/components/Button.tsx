import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow, space, useInverse } from '../theme';
import { Text } from './Text';
import { NATIVE, haptic, prefersReducedMotion, spring } from '../utils/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

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

/** Material 3 buttons: filled (primary), outlined (secondary), text (ghost), tonal danger, and the green outline pill. */
const light: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.glassStrong, fg: colors.text, border: colors.glassBorder },
  ghost: { bg: 'transparent', fg: colors.primary },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  // The Business-SME pill: green outline and green label ("Manage", "See all")
  outline: { bg: 'transparent', fg: colors.brand, border: colors.brand },
};

/** On navy hero cards the primary action becomes the lime brand button. */
const inverse: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.highlight, fg: colors.onHighlight },
  secondary: { bg: colors.heroInset, fg: colors.onHero, border: colors.heroBorder },
  ghost: { bg: 'transparent', fg: colors.onHero },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  outline: { bg: 'transparent', fg: colors.highlight, border: colors.highlight },
};

export function Button({ label, onPress, variant = 'primary', icon, trailingIcon, caps, loading, disabled, size = 'md', style }: Props) {
  const p = (useInverse() ? inverse : light)[variant];
  const inactive = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;
  const [down, setDown] = useState(false);
  const to = (v: number) => {
    if (!prefersReducedMotion()) Animated.spring(scale, { toValue: v, ...spring.press, useNativeDriver: NATIVE }).start();
  };
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
      onPressIn={() => {
        setDown(true);
        to(0.96);
      }}
      onPressOut={() => {
        setDown(false);
        to(1);
      }}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={[
        styles.base,
        size === 'lg' && styles.lg,
        { backgroundColor: p.bg, borderColor: p.border ?? 'transparent' },
        variant === 'primary' && !inactive && shadow.glow,
        down && { opacity: 0.88 },
        inactive && { opacity: 0.45 },
        style,
        { transform: [{ scale }] },
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
    </AnimatedPressable>
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
