import type { TextStyle } from 'react-native';

/** Figtree — open, rounded lettering close to the Safaricom app (same as the Business-SME app). */
export const fonts = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
  /** Condensed poster face for editorial headlines (sign-in slides). */
  display: 'BebasNeue_400Regular',
} as const;

/** Phone proportions from the Business-SME app. */
export const type = {
  display: { fontFamily: fonts.semibold, fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  title: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20 },
  body: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21 },
  bodySm: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  stat: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
