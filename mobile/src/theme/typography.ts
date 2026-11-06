import type { TextStyle } from 'react-native';

/** Open Sans — the lettering of the Co-op Bank app. */
export const fonts = {
  regular: 'OpenSans_400Regular',
  medium: 'OpenSans_500Medium',
  semibold: 'OpenSans_600SemiBold',
  bold: 'OpenSans_700Bold',
  extrabold: 'OpenSans_800ExtraBold',
} as const;

/** Co-op app proportions: bold 17 headings ("Quick Actions"), 14 body, 13 labels under icons. */
export const type = {
  // One scale everywhere (as on the dashboard): page headings match the "Hello …" greeting, SemiBold 17
  display: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  h1: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23 },
  h2: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  title: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17 },
  label: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 16 },
  overline: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  stat: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
