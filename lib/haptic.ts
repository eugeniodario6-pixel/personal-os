export function haptic(pattern: number | number[] = 10) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

export const hapticLight = () => haptic(8);
export const hapticMedium = () => haptic(15);
export const hapticHeavy = () => haptic([20, 10, 20]);
export const hapticSuccess = () => haptic([10, 50, 10]);
