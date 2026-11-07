import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts, type, useInverse, type TypeVariant } from '../theme';

interface Props extends TextProps {
  variant?: TypeVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Keep the exact colour even on dark surfaces (e.g. ink text on a white chip inside a dark card). */
  fixedColor?: boolean;
}

/** On navy hero surfaces, the standard text colours map to their on-dark equivalents. */
const inverseMap: Record<string, string> = {
  [colors.text]: colors.onHero,
  [colors.textMuted]: colors.onHeroMuted,
  [colors.textDim]: colors.onHeroDim,
  [colors.primary]: colors.onHero,
};

/**
 * Co-op lettering, measured against the Co-op app: every size 20% smaller than the sizes written in the
 * screens, and one weight lighter for small text (headings of 15 and up keep SemiBold; Bold becomes
 * SemiBold). Applied here, once, so every screen follows.
 */
/** Headings (17 and up in the screens) shrink by 20%; card titles, body text and labels by 26%. */
const scaleFor = (size: number) => (size >= 17 ? 0.8 : 0.74);
const LIGHTER: Record<string, string> = { [fonts.extrabold]: fonts.bold, [fonts.bold]: fonts.semibold };

function coopStyle(style: TextStyle): TextStyle {
  const out = { ...style };
  const k = scaleFor(typeof out.fontSize === 'number' ? out.fontSize : 14);
  if (typeof out.fontSize === 'number') out.fontSize = Math.round(out.fontSize * k * 2) / 2;
  if (typeof out.lineHeight === 'number') out.lineHeight = Math.round(out.lineHeight * k * 2) / 2;
  if (typeof out.letterSpacing === 'number') out.letterSpacing = out.letterSpacing * k;
  if (out.fontFamily && LIGHTER[out.fontFamily]) out.fontFamily = LIGHTER[out.fontFamily];
  else if (out.fontFamily === fonts.semibold && (out.fontSize ?? 14) < 12.5) out.fontFamily = fonts.medium;
  return out;
}

export function Text({ variant = 'body', color = colors.text, align, fixedColor, style, ...rest }: Props) {
  const inverse = useInverse();
  const resolved = inverse && !fixedColor ? (inverseMap[color] ?? color) : color;
  const flat = StyleSheet.flatten([type[variant], { color: resolved, textAlign: align }, style]) as TextStyle;
  return <RNText {...rest} style={coopStyle(flat)} />;
}
