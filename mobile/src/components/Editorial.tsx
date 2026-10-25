import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, radius, space, useInverse } from '../theme';
import { Text } from './Text';

/** Small square-cornered label chip ("ADOBE PREMIERE" style). */
export function Tag({ label, tone = 'grey' }: { label: string; tone?: 'grey' | 'white' | 'brand' }) {
  const inverse = useInverse();
  const bg = tone === 'brand' ? colors.brand : tone === 'white' || inverse ? colors.white : colors.surfaceAlt;
  const fg = tone === 'brand' ? colors.white : colors.primary;
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text variant="label" color={fg} fixedColor style={styles.tagText}>
        {label}
      </Text>
    </View>
  );
}

/** Heavy uppercase headline used on editorial cards. */
export function Headline({ children, size = 30, color }: { children: ReactNode; size?: number; color?: string }) {
  return (
    <Text variant="h1" color={color} style={{ fontFamily: fonts.extrabold, fontSize: size, lineHeight: size * 1.05, letterSpacing: -0.6, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}

/** Red "▸ text" kicker line. */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <View style={styles.kicker}>
      <View style={styles.triangle} />
      <Text variant="title" style={{ fontFamily: fonts.bold, flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/**
 * A large rotated brand-gradient square, clipped by its parent, that paints the
 * signature diagonal red corner. Place inside a container with overflow: 'hidden'.
 */
export function DiagonalAccent({
  size = 340,
  top = -190,
  right = -120,
  left,
  bottom,
  outline = true,
  style,
}: {
  size?: number;
  top?: number;
  right?: number;
  left?: number;
  bottom?: number;
  outline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const custom = left !== undefined || bottom !== undefined;
  const pos = custom ? { left, bottom, right: left === undefined ? right : undefined } : { top, right };
  return (
    <>
      {outline ? (
        <View
          pointerEvents="none"
          style={[styles.outline, { width: size * 0.9, height: size * 0.9 }, custom ? { bottom: (bottom ?? 0) - 10, ...(left !== undefined ? { left: left - 40 } : { right: right - 40 }) } : { top: top + 30, right: right + 70 }]}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.diamond, { width: size, height: size }, pos, style]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: 4 },
  tagText: { fontFamily: fonts.bold, letterSpacing: 0.6, textTransform: 'uppercase', fontSize: 11 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  triangle: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.brand,
  },
  diamond: { position: 'absolute', borderRadius: radius.xl + 12, transform: [{ rotate: '45deg' }] },
  outline: { position: 'absolute', borderRadius: radius.xl + 12, borderWidth: 1.5, borderColor: `${colors.brand}33`, transform: [{ rotate: '45deg' }] },
});
