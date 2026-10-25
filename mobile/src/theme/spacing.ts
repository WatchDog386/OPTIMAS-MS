export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const shadow = {
  card: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  glow: { shadowColor: '#B8F53B', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
} as const;
