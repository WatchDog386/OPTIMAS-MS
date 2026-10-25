import type { TextStyle } from 'react-native';

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  stat: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
