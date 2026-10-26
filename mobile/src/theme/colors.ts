/**
 * Optimas MS — "glass" light theme: soft grey frosted backdrop, translucent white cards,
 * ink-black actions and a bright yellow highlight with hatched inactive states.
 * Typography and ink scale are shared with the Optimas Business-SME app:
 * Safaricom green actions, green-grey "ink" typography, grey-green fields,
 * a soft sky glow behind headers, and bank-card style hero cards.
 */
export const colors = {
  // Canvas & surfaces
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F0', // field / grey-green chips & icon circles
  surfaceHigh: '#E3E9E6',
  border: '#E3E9E6',
  borderStrong: '#CBD5D0',

  // Interactive primary (ink)
  primary: '#1C1D1F',
  primaryPressed: '#000000',
  onPrimary: '#FFFFFF',
  primarySoft: 'rgba(28,29,31,0.06)',

  // Highlight (yellow) — active pills, progress fills, check badges
  highlight: '#ECF23A',
  onHighlight: '#1C1D1F',

  // Glass
  glass: 'rgba(255,255,255,0.58)',
  glassStrong: 'rgba(255,255,255,0.86)',
  glassBorder: 'rgba(255,255,255,0.9)',
  hatch: 'rgba(28,29,31,0.13)',
  bgTop: '#F3F3F3',
  bgBottom: '#DEDEDE',

  // Brand accents
  brand: '#2DA043',
  /** Optimas logo navy */
  navy: '#002170',
  onBrand: '#FFFFFF',
  brandSoft: '#EAF7ED',
  lime: '#C6EA5A',
  charcoal: '#1C1F1B',

  accent: '#3A8F91', // teal (card theme)
  accentSoft: '#E8F3F3',
  garnet: '#9B2B3D',
  garnetSoft: '#F7E3E6',

  // Text (ink scale)
  text: '#17201C',
  textMuted: '#5E6B65',
  textDim: '#8A9690',

  // Semantic
  success: '#00A13A',
  successSoft: '#D1FAE5',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#0284C7',
  infoSoft: '#E0F2FE',

  // Hero (charcoal) surfaces
  hero: '#1F2022',
  onHero: '#FFFFFF',
  onHeroMuted: 'rgba(255,255,255,0.72)',
  onHeroDim: 'rgba(255,255,255,0.5)',
  heroInset: 'rgba(255,255,255,0.14)',
  heroBorder: 'rgba(255,255,255,0.12)',

  // Page glow (sky)
  glowTop: '#D7E7FF',
  glowMid: '#E8F1FF',

  overlay: 'rgba(10, 16, 13, 0.66)',
  scrim: 'rgba(0,0,0,0.45)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

/** Bank-card themes, as on the Business-SME dashboard. */
export const cardThemes = {
  teal: { colors: ['#3A8F91', '#469D9F', '#56ACAD'] as const, glow: '#1F5F61', pillInk: '#2F7F81' },
  charcoal: { colors: ['#1F1F21', '#29292C', '#333337'] as const, glow: '#8A8A90', pillInk: '#1F1F21' },
  garnet: { colors: ['#7A1828', '#8A2032', '#9B2B3D'] as const, glow: '#3A0712', pillInk: '#7A1828' },
  amethyst: { colors: ['#4C2C8E', '#5934A0', '#6840B1'] as const, glow: '#22104F', pillInk: '#4C2C8E' },
} as const;
export type CardTheme = (typeof cardThemes)[keyof typeof cardThemes];

export const gradients = {
  hero: ['#2C2D30', '#17181A'] as const,
  brand: ['#45B65C', '#2DA043'] as const,
  lime: ['#F2F65A', '#E2EA2C'] as const,
  glowTop: ['#D7E7FF', '#E8F1FF', 'rgba(255,255,255,0)'] as const,
  glowBottom: ['rgba(255,255,255,0)', '#E8F1FF', '#D7E7FF'] as const,
};
