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
  // Cards: solid white on the plain page (as on Profile)
  glass: '#FFFFFF',
  glassStrong: '#FFFFFF',
  glassBorder: 'rgba(15,23,42,0.06)',
  hatch: 'rgba(28,29,31,0.13)',
  // The page: Optimas-SME's plain light grey, everywhere
  bgTop: '#F8FAFC',
  bgBottom: '#F8FAFC',

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
/**
 * The Co-op Bank look: a savannah photo under a dark veil, smoky see-through panels, lime-green active
 * tabs and links, and deep-green cards.
 */
const dark: typeof light = {
  ...light,
  // Optimas-SME's dark page and cards, everywhere (as on Profile)
  bg: '#121212',
  surface: '#1E1E1E',
  surfaceAlt: '#303538',
  surfaceHigh: '#3A3F42',
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.24)',

  // Actions are Co-op green with white lettering
  primary: '#5E9F2A',
  primaryPressed: '#4E8A22',
  onPrimary: '#FFFFFF',
  primarySoft: 'rgba(255,255,255,0.08)',

  // Active tabs and chips: the lime "Accounts" pill
  highlight: '#7CB83A',
  onHighlight: '#FFFFFF',

  glass: '#1E1E1E',
  glassStrong: '#1E1E1E',
  glassBorder: 'rgba(255,255,255,0.06)',
  hatch: 'rgba(255,255,255,0.12)',
  bgTop: '#121212',
  bgBottom: '#121212',

  brand: '#8DC63F',
  brandSoft: 'rgba(124,184,58,0.18)',
  accentSoft: 'rgba(58,143,145,0.2)',
  garnetSoft: 'rgba(155,43,61,0.25)',
  navy: '#7FA2F0',
  // Dark cards with white lettering (the attention banner): deep Co-op green
  charcoal: '#0F3524',

  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.72)',
  textDim: 'rgba(255,255,255,0.5)',

  successSoft: 'rgba(0,161,58,0.2)',
  warningSoft: 'rgba(217,119,6,0.22)',
  dangerSoft: 'rgba(220,38,38,0.22)',
  infoSoft: 'rgba(2,132,199,0.22)',

  hero: '#0E4A33',
  glowTop: '#121212',
  glowMid: '#121212',
  overlay: 'rgba(0,0,0,0.72)',
};

export type ThemeMode = 'light' | 'dark';
const THEME_KEY = 'optimas.theme';

/** The look chosen on this phone (light unless Dark mode was switched on). Read once, before any screen draws. */
export const themeMode: ThemeMode = (() => {
  try {
    // The Co-op look (dark, over the savannah photo) unless Light mode was chosen on this phone
    return typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
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
  // Deep-green bank card in the Co-op look
  hero: (isDark ? ['#11603F', '#0A3B27'] : ['#2C2D30', '#17181A']) as readonly [string, string],
  brand: ['#45B65C', '#2DA043'] as const,
  lime: ['#F2F65A', '#E2EA2C'] as const,
  glowTop: ['#D7E7FF', '#E8F1FF', 'rgba(255,255,255,0)'] as const,
  glowBottom: ['rgba(255,255,255,0)', '#E8F1FF', '#D7E7FF'] as const,
};
