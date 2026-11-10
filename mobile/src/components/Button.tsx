import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, isDark, radius, space, useInverse } from '../theme';
import { Text } from './Text';
import { OPENED_ON_DESKTOP } from '../theme/desktop';
import { desk } from '../theme/desk';
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
  /** Label and icon colour, for a button on its own colour (e.g. white on WhatsApp green). */
  textColor?: string;
}

/**
 * The overview page's buttons everywhere: the main action is the "Manage" pill (dark with a lime label in
 * light mode, outlined with a lime label in dark mode); the second action is the same pill in neutral
 * colours; text links and danger stay as they were.
 */
const PILL_LIME = '#8DC63F';
const light: Record<Variant, { bg: string; fg: string; border?: string }> = isDark
  ? {
      primary: { bg: 'transparent', fg: PILL_LIME, border: 'rgba(255,255,255,0.38)' },
      secondary: { bg: '#1E1E1E', fg: '#FFFFFF', border: 'rgba(255,255,255,0.16)' },
      ghost: { bg: 'transparent', fg: PILL_LIME },
      danger: { bg: colors.dangerSoft, fg: colors.danger },
      outline: { bg: 'transparent', fg: PILL_LIME, border: 'rgba(255,255,255,0.38)' },
    }
  : {
      primary: { bg: '#1A1C1B', fg: PILL_LIME, border: '#1A1C1B' },
      secondary: { bg: '#FFFFFF', fg: colors.text, border: '#CBD5D0' },
      ghost: { bg: 'transparent', fg: colors.primary },
      danger: { bg: colors.dangerSoft, fg: colors.danger },
      outline: { bg: '#1A1C1B', fg: PILL_LIME, border: '#1A1C1B' },
    };

/** On a laptop: the dashboard's flat buttons (green main action, light grey second, white outline). */
const deskButtons: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: desk.green, fg: '#FFFFFF', border: desk.green },
  secondary: { bg: desk.row, fg: desk.ink, border: desk.row },
  ghost: { bg: 'transparent', fg: desk.teal },
  danger: { bg: isDark ? 'rgba(204,59,53,0.16)' : '#FDECEB', fg: desk.red, border: isDark ? 'rgba(204,59,53,0.16)' : '#FDECEB' },
  outline: { bg: desk.panel, fg: desk.ink, border: desk.border },
};

/** On navy hero cards the primary action becomes the lime brand button. */
const inverse: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.highlight, fg: colors.onHighlight },
  secondary: { bg: colors.heroInset, fg: colors.onHero, border: colors.heroBorder },
  ghost: { bg: 'transparent', fg: colors.onHero },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  outline: { bg: 'transparent', fg: colors.highlight, border: colors.highlight },
};

export function Button({ label, onPress, variant = 'primary', icon, trailingIcon, caps, loading, disabled, size = 'md', style, textColor }: Props) {
  const inv = useInverse();
  const base = (OPENED_ON_DESKTOP && !inv ? deskButtons : inv ? inverse : light)[variant];
  const p = textColor ? { ...base, fg: textColor } : base;
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
        OPENED_ON_DESKTOP && styles.desk,
        OPENED_ON_DESKTOP && size === 'lg' && { height: 40 },
        { backgroundColor: p.bg, borderColor: p.border ?? 'transparent' },
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
            fixedColor
            style={[{ fontFamily: OPENED_ON_DESKTOP ? fonts.medium : fonts.semibold, fontSize: OPENED_ON_DESKTOP ? 14 : size === 'lg' ? 16 : 15 }, caps && { fontFamily: fonts.bold }]}
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
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  lg: { height: 52 },
  desk: { height: 36, borderRadius: 4, borderWidth: 1, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
