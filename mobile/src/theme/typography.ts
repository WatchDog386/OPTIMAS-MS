import type { TextStyle } from 'react-native';

/** Figtree — open, rounded lettering close to the Safaricom app (same as the Business-SME app). */
export const fonts = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
} as const;

/** Phone proportions from the Business-SME app. */
export const type = {
  // One scale everywhere (as on the dashboard): page headings match the "Hello …" greeting, SemiBold 17
  display: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  h1: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  h2: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21 },
  title: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  stat: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
