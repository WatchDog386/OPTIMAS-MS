export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 16, xxl: 24, xxxl: 36 } as const;
export const radius = { sm: 10, md: 14, lg: 18, xl: 26, pill: 999 } as const;

/** Soft, slightly green-tinted shadows (Business-SME "soft" / "lift"). */
export const shadow = {
  card: { shadowColor: '#14281E', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  raised: { shadowColor: '#14281E', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  glow: { shadowColor: '#087F5B', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  bar: { shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 14 },
} as const;
