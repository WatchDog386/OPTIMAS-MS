/**
 * Optimas MS — light theme (Material 3 inspired).
 * White canvas, slate typography, deep navy as the interactive primary,
 * and the electric-lime brand accent reserved for highlights on navy "hero" surfaces.
 */
export const colors = {
  // Canvas & surfaces
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F6FA',
  surfaceHigh: '#EBEFF5',
  border: '#E3E8EF',
  borderStrong: '#CBD3DF',

  // Interactive primary (navy)
  primary: '#13265C',
  primaryPressed: '#0C1A42',
  onPrimary: '#FFFFFF',
  primarySoft: '#E9EEF8',

  // Brand accent (Optimas lime) — use on navy, or as a fill with navy text
  brand: '#B8F53B',
  onBrand: '#0C1A42',
  brandSoft: '#F2FBDF',

  accent: '#0E9F9A',
  accentSoft: '#E3F6F5',

  // Text
  text: '#0F172A',
  textMuted: '#5B6577',
  textDim: '#8E97A8',

  // Semantic
  success: '#15803D',
  successSoft: '#E7F6EC',
  warning: '#B45309',
  warningSoft: '#FEF3E2',
  danger: '#DC2626',
  dangerSoft: '#FDECEC',
  info: '#1D4ED8',
  infoSoft: '#EAF0FE',

  // Navy hero surfaces
  hero: '#13265C',
  onHero: '#FFFFFF',
  onHeroMuted: '#B9C4DE',
  onHeroDim: '#8090B5',
  heroInset: 'rgba(255,255,255,0.08)',
  heroBorder: 'rgba(255,255,255,0.10)',

  overlay: 'rgba(8, 15, 35, 0.66)',
  scrim: 'rgba(0,0,0,0.45)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const gradients = {
  hero: ['#1B3577', '#0F1F4D'] as const,
  brand: ['#C9FF52', '#A3E635'] as const,
};
