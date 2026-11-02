/**
 * Optimas MS — "glass" light theme: soft grey frosted backdrop, translucent white cards,
 * ink-black actions and a bright yellow highlight with hatched inactive states.
 * Typography and ink scale are shared with the Optimas Business-SME app:
 * Safaricom green actions, green-grey "ink" typography, grey-green fields,
 * a soft sky glow behind headers, and bank-card style hero cards.
 */
const light = {
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
};

/** The same tokens at night: charcoal canvas, raised dark cards, light ink and green actions. */
const dark: typeof light = {
  ...light,
  bg: '#111214',
  surface: '#1A1B1E',
  surfaceAlt: '#24262A',
  surfaceHigh: '#2C2E33',
  border: '#2C2E33',
  borderStrong: '#3A3D42',

  // Black buttons would vanish on a dark page: actions turn Safaricom green, as in the Business-SME dark mode
  primary: '#2DA043',
  primaryPressed: '#248A38',
  onPrimary: '#FFFFFF',
  primarySoft: 'rgba(255,255,255,0.08)',

  glass: 'rgba(30,31,34,0.72)',
  glassStrong: 'rgba(32,33,36,0.94)',
  glassBorder: 'rgba(255,255,255,0.08)',
  hatch: 'rgba(255,255,255,0.12)',
  bgTop: '#17181B',
  bgBottom: '#0E0F11',

  brandSoft: 'rgba(45,160,67,0.18)',
  accentSoft: 'rgba(58,143,145,0.2)',
  garnetSoft: 'rgba(155,43,61,0.25)',
  navy: '#6F8FE0',
  charcoal: '#E6E9E7',

  text: '#ECEFED',
  textMuted: '#A3ADA8',
  textDim: '#7B8580',

  successSoft: 'rgba(0,161,58,0.18)',
  warningSoft: 'rgba(217,119,6,0.2)',
  dangerSoft: 'rgba(220,38,38,0.2)',
  infoSoft: 'rgba(2,132,199,0.2)',

  hero: '#25262A',
  glowTop: '#141B25',
  glowMid: '#111720',
  overlay: 'rgba(0,0,0,0.72)',
};

export type ThemeMode = 'light' | 'dark';
const THEME_KEY = 'optimas.theme';

/** The look chosen on this phone (light unless Dark mode was switched on). Read once, before any screen draws. */
export const themeMode: ThemeMode = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
})();
export const isDark = themeMode === 'dark';

/**
 * Switches light/dark. Every style in the app is built from these colours when it loads, so the app
 * reloads to redraw itself in the new look (the sign-in and lock are kept).
 */
export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* private mode: stays as it is */
  }
  try {
    // Already unlocked: the reload that follows should not ask for the fingerprint again
    sessionStorage.setItem('optimas.themeReload', String(Date.now()));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.location.reload();
}

export const colors = isDark ? dark : light;

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
