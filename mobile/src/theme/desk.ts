import { isDark } from './colors';

/**
 * Desktop colours: the app's own theme (navy side rail, white top bar, light grey page, green actions and
 * links). The layout of the pages follows the pay-kenya-pro dashboard: white cards with hairline borders
 * and 4px corners, titles on the left, underline tabs.
 */
export const desk = {
  nav: '#0E2135',
  navText: '#E2E8F0',
  navMuted: '#8A9AAE',
  navActive: '#4DA3FF',
  navHover: 'rgba(255,255,255,0.06)',
  orgCard: 'rgba(255,255,255,0.08)',
  page: isDark ? '#111214' : '#F7F8FA',
  bar: isDark ? '#17181B' : '#FFFFFF',
  panel: isDark ? '#1A1B1E' : '#FFFFFF',
  mini: isDark ? '#24262A' : '#F3F4F6',
  row: isDark ? '#24262A' : '#F1F3F5',
  border: isDark ? '#2C2E33' : '#E5E7EB',
  ink: isDark ? '#ECEFED' : '#17201C',
  strong: isDark ? '#FFFFFF' : '#111827',
  muted: isDark ? '#A3ADA8' : '#6B7280',
  /** The main action (buttons). */
  green: '#2DA043',
  greenHover: '#248A38',
  /** Links, tabs and highlights. */
  teal: '#2DA043',
  tealSoft: isDark ? 'rgba(45,160,67,0.14)' : '#EAF7ED',
  red: '#DC2626',
};
