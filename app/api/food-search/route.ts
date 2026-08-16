import { NextRequest, NextResponse } from 'next/server';

// USDA FoodData Central — free, no IP restrictions
// DEMO_KEY: 30 req/min, 50 req/day — request own key at https://fdc.nal.usda.gov/api-key-signup
const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';
const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// Nutrient IDs we care about
const NID = {
  calories: 1008, // Energy (kcal)
  protein:  1003, // Protein
  carbs:    1005, // Carbohydrate, by difference
  fat:      1004, // Total lipid (fat)
};

function getNutrient(nutrients: any[], id: number): number {
  return nutrients.find((n: any) => n.nutrientId === id)?.value ?? 0;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query) return NextResponse.json({ foods: [] });

  try {
    const params = new URLSearchParams({
      api_key: USDA_API_KEY,
      query,
      pageSize: '50',
      // Foundation & SR Legacy = generic whole foods only; Branded excluded
      dataType: 'Foundation,SR Legacy',
    });

    const res = await fetch(`${USDA_URL}?${params}`);
    if (!res.ok) throw new Error(`USDA API error: ${res.status}`);
    const data = await res.json();

    const raw: any[] = data?.foods ?? [];

    const foods = raw
      .map((f: any) => {
        const nutrients: any[] = f.foodNutrients ?? [];
        const cal     = Math.round(getNutrient(nutrients, NID.calories));
        const protein = Math.round(getNutrient(nutrients, NID.protein) * 10) / 10;
        const carbs   = Math.round(getNutrient(nutrients, NID.carbs) * 10) / 10;
        const fat     = Math.round(getNutrient(nutrients, NID.fat) * 10) / 10;

        if (!cal) return null;

        const isGeneric = f.dataType === 'Foundation' || f.dataType === 'SR Legacy';
        const brand = f.brandOwner || f.brandName || '';

        return {
          id: String(f.fdcId),
          name: f.description ?? '',
          brand: isGeneric ? '' : brand,
          isGeneric,
          calories: cal,
          protein,
          carbs,
          fat,
          serving_size: 100,
          serving_unit: 'g',
        };
      })
      .filter(Boolean)
      // Deduplicate by name (case-insensitive)
      .filter((item: any, idx: number, arr: any[]) =>
        arr.findIndex((x: any) => x.name.toLowerCase() === item.name.toLowerCase()) === idx
      )
      .slice(0, 12);

    return NextResponse.json({ foods });
  } catch (err: any) {
    console.error('[food-search]', err.message);
    return NextResponse.json({ error: err.message, foods: [] }, { status: 500 });
  }
}
