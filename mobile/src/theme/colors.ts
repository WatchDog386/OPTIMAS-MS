/**
 * Optimas MS — light theme.
 * White canvas, near-black ink for actions and pills, coral-red brand accent,
 * and charcoal "hero" cards (inspired by bold editorial course-app layouts).
 */
export const colors = {
  // Canvas & surfaces
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F3F4',
  surfaceHigh: '#E9E9EB',
  border: '#ECECEE',
  borderStrong: '#D4D4D8',

  // Interactive primary (ink black)
  primary: '#111111',
  primaryPressed: '#000000',
  onPrimary: '#FFFFFF',
  primarySoft: '#F0F0F1',

  // Brand accent (coral red)
  brand: '#F2453D',
  onBrand: '#FFFFFF',
  brandSoft: '#FDECEA',

  accent: '#FF7A45',
  accentSoft: '#FFF1EA',

  // Text
  text: '#111111',
  textMuted: '#5F6068',
  textDim: '#9A9BA3',

  // Semantic
  success: '#16A34A',
  successSoft: '#E8F7EE',
  warning: '#C2410C',
  warningSoft: '#FFF2E8',
  danger: '#D92D20',
  dangerSoft: '#FDECEA',
  info: '#2563EB',
  infoSoft: '#EAF0FE',

  // Charcoal hero surfaces
  hero: '#161616',
  onHero: '#FFFFFF',
  onHeroMuted: '#B5B5BB',
  onHeroDim: '#7C7C84',
  heroInset: 'rgba(255,255,255,0.10)',
  heroBorder: 'rgba(255,255,255,0.08)',

  overlay: 'rgba(10, 10, 10, 0.66)',
  scrim: 'rgba(0,0,0,0.45)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const gradients = {
  hero: ['#262626', '#0F0F0F'] as const,
  brand: ['#FF6A4D', '#E8322A'] as const,
};
