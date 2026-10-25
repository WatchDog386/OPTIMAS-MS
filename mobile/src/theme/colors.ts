/**
 * Optimas MS palette — deep navy surfaces with an electric-lime brand accent,
 * inspired by the Spiro Swap app's high-contrast, energetic look.
 */
export const colors = {
  bg: '#060B1A',
  surface: '#0E1730',
  surfaceAlt: '#152241',
  surfaceHigh: '#1C2B50',
  border: '#22325A',

  primary: '#B8F53B',
  primaryPressed: '#9FDB24',
  onPrimary: '#071022',
  primarySoft: 'rgba(184, 245, 59, 0.12)',

  accent: '#2DE1C2',
  accentSoft: 'rgba(45, 225, 194, 0.12)',

  text: '#F3F6FF',
  textMuted: '#93A1C2',
  textDim: '#5D6C8F',

  success: '#2EE59D',
  successSoft: 'rgba(46, 229, 157, 0.14)',
  warning: '#FFB547',
  warningSoft: 'rgba(255, 181, 71, 0.14)',
  danger: '#FF5C7A',
  dangerSoft: 'rgba(255, 92, 122, 0.14)',
  info: '#5AA8FF',
  infoSoft: 'rgba(90, 168, 255, 0.14)',

  overlay: 'rgba(3, 6, 15, 0.72)',
  white: '#FFFFFF',
} as const;

export const gradients = {
  hero: ['#1B2D5C', '#0E1730'] as const,
  brand: ['#C9FF52', '#8EE01F'] as const,
  teal: ['#1E5C63', '#0E1730'] as const,
};
