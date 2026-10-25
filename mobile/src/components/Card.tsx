import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, shadow, space } from '../theme';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'hero' | 'outline' | 'brand';
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({ children, onPress, variant = 'default', style, padded = true }: Props) {
  const inner = [styles.base, padded && styles.padded, variant === 'outline' && styles.outline, style];
  const body =
    variant === 'hero' || variant === 'brand' ? (
      <LinearGradient
        colors={variant === 'hero' ? gradients.hero : gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[inner, variant === 'hero' && styles.heroBorder]}
      >
        {children}
      </LinearGradient>
    ) : (
      <View style={inner}>{children}</View>
    );

  if (!onPress) return <View style={variant !== 'outline' ? shadow.card : undefined}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [variant !== 'outline' && shadow.card, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  padded: { padding: space.lg },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  heroBorder: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
});
