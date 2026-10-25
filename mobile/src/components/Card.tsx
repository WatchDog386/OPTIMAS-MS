import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, shadow, space, SurfaceContext } from '../theme';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /** default: white elevated card · hero: navy brand surface · outline: flat bordered · tonal: soft grey fill */
  variant?: 'default' | 'hero' | 'outline' | 'tonal' | 'brand';
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({ children, onPress, variant = 'default', style, padded = true }: Props) {
  const isHero = variant === 'hero';
  const inner = [
    styles.base,
    padded && styles.padded,
    variant === 'default' && styles.elevated,
    variant === 'outline' && styles.outline,
    variant === 'tonal' && styles.tonal,
    style,
  ];
  const body =
    isHero || variant === 'brand' ? (
      <LinearGradient
        colors={isHero ? gradients.hero : gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[inner, isHero && styles.heroBorder]}
      >
        {isHero ? <SurfaceContext.Provider value={{ inverse: true }}>{children}</SurfaceContext.Provider> : children}
      </LinearGradient>
    ) : (
      <View style={inner}>{children}</View>
    );

  const elevation = variant === 'default' ? shadow.card : isHero ? shadow.raised : undefined;
  if (!onPress) return <View style={elevation}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(15,23,42,0.06)' }}
      style={({ pressed }) => [elevation, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  padded: { padding: space.lg },
  elevated: { borderWidth: 1, borderColor: colors.border },
  outline: { borderWidth: 1, borderColor: colors.border },
  tonal: { backgroundColor: colors.surfaceAlt },
  heroBorder: { borderWidth: 1, borderColor: colors.heroBorder },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
