import type { TextStyle } from 'react-native';

/**
 * The Business-SME (sme.optimas) lettering: Figtree on phones, Inter on a laptop or desktop. Loaded in
 * app/_layout.tsx under these names.
 */
export const fonts = {
  regular: 'AppSans_400Regular',
  medium: 'AppSans_500Medium',
  semibold: 'AppSans_600SemiBold',
  bold: 'AppSans_700Bold',
  extrabold: 'AppSans_800ExtraBold',
} as const;

/** Sizes as written in the screens; the Text component turns them into SME's phone sizes (14 → 12, 17 → 14.5 …). */
export const type = {
  // One scale everywhere (as on the dashboard): page headings match the "Hello …" greeting, SemiBold 17
  display: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  h1: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23 },
  h2: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  title: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19 },
  label: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 16 },
  overline: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  stat: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
