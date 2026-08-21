// Food quality scoring for Personal OS
// Score 0-100 based on food characteristics

export function scoreFoodQuality(food: {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: number;
}): number {
  // Protein density score (0-40): protein / calories * 400, capped at 40
  const proteinDensity = Math.min(40, (food.protein / Math.max(food.calories, 1)) * 400);

  // Macro balance score (0-30): penalise if >50% cals from fat, or >60% from carbs with <15% from protein
  const calFromProtein = (food.protein * 4) / Math.max(food.calories, 1);
  const calFromFat = (food.fat * 9) / Math.max(food.calories, 1);
  const calFromCarbs = (food.carbs * 4) / Math.max(food.calories, 1);
  let macroScore = 30;
  if (calFromFat > 0.5) macroScore -= 15;
  if (calFromCarbs > 0.6 && calFromProtein < 0.15) macroScore -= 20;
  macroScore = Math.max(0, macroScore);

  // Whole food indicator (0-30): check name for processed food keywords
  const processedKeywords = [
    'chips', 'cookie', 'cake', 'candy', 'soda', 'juice', 'fried', 'nugget',
    'processed', 'bar', 'shake', 'supplement', 'powder',
  ];
  const wholeKeywords = [
    'chicken', 'beef', 'steak', 'fish', 'salmon', 'egg', 'rice', 'oat',
    'broccoli', 'spinach', 'apple', 'banana', 'lentil', 'bean', 'potato',
    'sweet potato', 'avocado',
  ];
  const nameLower = food.name.toLowerCase();
  let wholeScore = 15; // neutral
  if (wholeKeywords.some(k => nameLower.includes(k))) wholeScore = 30;
  if (processedKeywords.some(k => nameLower.includes(k))) wholeScore = 0;

  return Math.round(proteinDensity + macroScore + wholeScore);
}

export function qualityLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Whole',     color: '#DAFF01' };
  if (score >= 50) return { label: 'Good',      color: 'rgba(255,255,255,0.7)' };
  if (score >= 25) return { label: 'Mixed',     color: 'rgba(255,165,0,0.8)' };
  return               { label: 'Processed', color: 'rgba(255,80,80,0.8)' };
}
