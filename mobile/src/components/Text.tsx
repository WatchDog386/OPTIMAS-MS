import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts, type, useInverse, type TypeVariant } from '../theme';
import { OPENED_ON_DESKTOP } from '../theme/desktop';

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
 * The Business-SME (sme.optimas) text sizes. Phones use SME's own table (its text is about 15% smaller
 * than the sizes written in the screens: 14 → 12, 16 → 13.5, 17 → 14.5, 20 → 17 …); on a laptop the
 * sizes stay as written and only the smallest text is raised, as SME does. Weights follow SME too: its
 * text is mostly Medium and SemiBold, so Regular becomes Medium and ExtraBold becomes Bold. Applied here,
 * once, so every screen follows.
 */
const PHONE: [number, number][] = [
  [9, 9], [10, 9], [11, 10], [12, 10.5], [13, 11], [14, 12], [15, 13], [16, 13.5], [17, 14.5], [18, 15.5],
  [20, 17], [22, 19], [24, 20.5], [26, 22], [28, 24], [30, 25.5], [32, 27], [34, 29], [44, 37],
];
function smeSize(n: number) {
  if (OPENED_ON_DESKTOP) return n < 11 ? 11 : n < 12 ? 12 : n < 13 ? 13 : n;
  if (n <= PHONE[0][0]) return n;
  for (let i = 1; i < PHONE.length; i++) {
    const [x1, y1] = PHONE[i];
    const [x0, y0] = PHONE[i - 1];
    if (n <= x1) return Math.round((y0 + ((n - x0) * (y1 - y0)) / (x1 - x0)) * 2) / 2;
  }
  return Math.round(n * 0.84 * 2) / 2;
}
const WEIGHT: Record<string, string> = { [fonts.regular]: fonts.medium, [fonts.extrabold]: fonts.bold };

function smeStyle(style: TextStyle): TextStyle {
  const out = { ...style };
  if (typeof out.fontSize === 'number') {
    const k = smeSize(out.fontSize) / out.fontSize;
    out.fontSize = smeSize(out.fontSize);
    if (typeof out.lineHeight === 'number') out.lineHeight = Math.round(out.lineHeight * k * 2) / 2;
    if (typeof out.letterSpacing === 'number') out.letterSpacing = out.letterSpacing * k;
  }
  if (out.fontFamily && WEIGHT[out.fontFamily]) out.fontFamily = WEIGHT[out.fontFamily];
  return out;
}

export function Text({ variant = 'body', color = colors.text, align, fixedColor, style, ...rest }: Props) {
  const inverse = useInverse();
  const resolved = inverse && !fixedColor ? (inverseMap[color] ?? color) : color;
  const flat = StyleSheet.flatten([type[variant], { color: resolved, textAlign: align }, style]) as TextStyle;
  return <RNText {...rest} style={smeStyle(flat)} />;
}
