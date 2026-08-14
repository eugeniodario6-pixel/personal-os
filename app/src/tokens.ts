export const Colors = {
  bg: '#000000',
  surface: '#0D0D0D',
  border: '#1A1A1A',
  accent: '#C8FF00',           // chartreuse — ETA number only
  textPrimary: '#F0F0F0',
  textMuted: '#555555',
  // Pillar colour — Nutrition
  nutritionAccent: '#FF6B35',
} as const;

export const Fonts = {
  mono: 'IBMPlexMono_400Regular',
  monoBold: 'IBMPlexMono_600SemiBold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansBold: 'Inter_700Bold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
