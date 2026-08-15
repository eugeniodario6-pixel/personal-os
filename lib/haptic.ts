export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (typeof window === 'undefined') return;
  const patterns: Record<string, number[]> = {
    light:  [10],
    medium: [20],
    heavy:  [30],
  };
  try { navigator.vibrate?.(patterns[style]); } catch {}
}
