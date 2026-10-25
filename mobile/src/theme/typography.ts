import type { TextStyle } from 'react-native';

/** Roboto — the native Android typeface, bundled so iOS renders identically. */
export const fonts = {
  regular: 'Roboto_400Regular',
  medium: 'Roboto_500Medium',
  semibold: 'Roboto_600SemiBold',
  bold: 'Roboto_700Bold',
  extrabold: 'Roboto_800ExtraBold',
} as const;

/** Material 3 type scale, mapped to the names the app already uses. */
export const type = {
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 40, letterSpacing: -0.5 }, // display-small
  h1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 }, // headline-medium
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.1 }, // title-large
  title: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, letterSpacing: 0.1 }, // title-medium
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, letterSpacing: 0.15 }, // body-large
  bodySm: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, letterSpacing: 0.2 }, // body-medium
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 }, // label-medium
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' },
  stat: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
