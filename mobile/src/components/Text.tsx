import { Text as RNText, type TextProps } from 'react-native';
import { colors, type, useInverse, type TypeVariant } from '../theme';

interface Props extends TextProps {
  variant?: TypeVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

/** On navy hero surfaces, the standard text colours map to their on-dark equivalents. */
const inverseMap: Record<string, string> = {
  [colors.text]: colors.onHero,
  [colors.textMuted]: colors.onHeroMuted,
  [colors.textDim]: colors.onHeroDim,
  [colors.primary]: colors.brand,
};

export function Text({ variant = 'body', color = colors.text, align, style, ...rest }: Props) {
  const inverse = useInverse();
  const resolved = inverse ? (inverseMap[color] ?? color) : color;
  return <RNText {...rest} style={[type[variant], { color: resolved, textAlign: align }, style]} />;
}
