import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, isDark, radius, shadow, space, SurfaceContext } from '../theme';
import { OPENED_ON_DESKTOP } from '../theme/desktop';
import { desk } from '../theme/desk';

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
        <SurfaceContext.Provider value={{ inverse: true }}>{children}</SurfaceContext.Provider>
      </LinearGradient>
    ) : (
      <View style={inner}>{children}</View>
    );

  const elevation = variant === 'default' ? shadow.card : isHero ? shadow.raised : undefined;
  if (!onPress) return <View style={[elevation, { borderRadius: OPENED_ON_DESKTOP ? 4 : radius.xl }]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(15,23,42,0.06)' }}
      style={({ pressed }) => [elevation, { borderRadius: radius.xl }, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // On a laptop: the dashboard card (white, hairline border, 4px corners)
  base: OPENED_ON_DESKTOP ? { backgroundColor: desk.panel, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: desk.border } : { backgroundColor: colors.glass, borderRadius: radius.xl, overflow: 'hidden' },
  padded: { padding: space.lg + 2 },
  elevated: { borderWidth: 1, borderColor: colors.glassBorder },
  outline: { borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: isDark ? colors.glass : 'rgba(255,255,255,0.35)' },
  tonal: { backgroundColor: isDark ? colors.glass : 'rgba(255,255,255,0.4)' },
  heroBorder: { borderWidth: 1, borderColor: colors.heroBorder },
  pressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
});
