// Food quality scoring for Personal OS
// Score 0-100 based on food characteristics

export interface FoodQualityBreakdown {
  score: number;
  proteinDensityScore: number; // 0-40
  macroBalanceScore: number;   // 0-30
  wholeFoodScore: number;      // 0-30
  primaryDriver: string;       // e.g. "Low protein density" | "High fat ratio" | "Whole food" | "Processed ingredients"
}

export function scoreFoodQuality(food: {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: number;
}): FoodQualityBreakdown {
  // Protein density score (0-40): protein / calories * 400, capped at 40
  const proteinDensityScore = Math.round(Math.min(40, (food.protein / Math.max(food.calories, 1)) * 400));

  // Macro balance score (0-30): penalise if >50% cals from fat, or >60% from carbs with <15% from protein
  const calFromProtein = (food.protein * 4) / Math.max(food.calories, 1);
  const calFromFat = (food.fat * 9) / Math.max(food.calories, 1);
  const calFromCarbs = (food.carbs * 4) / Math.max(food.calories, 1);
  let macroBalanceScore = 30;
  let highFat = false;
  let highCarbLowPro = false;
  if (calFromFat > 0.5) { macroBalanceScore -= 15; highFat = true; }
  if (calFromCarbs > 0.6 && calFromProtein < 0.15) { macroBalanceScore -= 20; highCarbLowPro = true; }
  macroBalanceScore = Math.max(0, macroBalanceScore);

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
  let wholeFoodScore = 15; // neutral
  let isProcessed = false;
  let isWhole = false;
  if (wholeKeywords.some(k => nameLower.includes(k))) { wholeFoodScore = 30; isWhole = true; }
  if (processedKeywords.some(k => nameLower.includes(k))) { wholeFoodScore = 0; isProcessed = true; }

  const score = Math.round(proteinDensityScore + macroBalanceScore + wholeFoodScore);

  // Determine primary driver (biggest opportunity or strength)
  let primaryDriver: string;
  const gaps = [
    { label: 'Low protein density', loss: 40 - proteinDensityScore },
    { label: 'High fat ratio', loss: highFat ? 15 : 0 },
    { label: 'High carbs, low protein', loss: highCarbLowPro ? 20 : 0 },
    { label: 'Processed ingredients', loss: isProcessed ? 30 : 0 },
  ].sort((a, b) => b.loss - a.loss);

  if (isWhole && score >= 75) {
    primaryDriver = 'Whole food — great choice';
  } else if (gaps[0].loss > 0) {
    primaryDriver = `Dragged down by ${gaps[0].label.toLowerCase()}`;
  } else {
    primaryDriver = 'Well-balanced food';
  }

  return { score, proteinDensityScore, macroBalanceScore, wholeFoodScore, primaryDriver };
}

export function qualityLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Whole',     color: '#DAFF01' };
  if (score >= 50) return { label: 'Good',      color: 'rgba(255,255,255,0.7)' };
  if (score >= 25) return { label: 'Mixed',     color: 'rgba(255,165,0,0.8)' };
  return               { label: 'Processed', color: 'rgba(255,80,80,0.8)' };
}
