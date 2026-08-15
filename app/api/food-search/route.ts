import { NextRequest, NextResponse } from 'next/server';

// Whole-food keywords that indicate a generic/unprocessed item
const WHOLE_FOOD_TERMS = [
  'raw', 'cooked', 'boiled', 'grilled', 'roasted', 'steamed', 'baked',
  'fresh', 'whole', 'lean', 'ground', 'generic', 'usda',
];

function isWholeFood(name: string, brands: string): boolean {
  if (brands) return false; // has a brand = processed
  const lower = name.toLowerCase();
  // Single-word foods are usually whole foods (beef, apple, rice)
  if (lower.split(' ').length <= 2) return true;
  return WHOLE_FOOD_TERMS.some(t => lower.includes(t));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query?.trim()) return NextResponse.json({ foods: [] });

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl` +
      `?search_terms=${encodeURIComponent(query.trim())}` +
      `&search_simple=1&action=process&json=1&page_size=20` +
      `&fields=product_name,generic_name,brands,nutriments,serving_size,food_groups_tags` +
      `&lc=en&cc=za&sort_by=unique_scans_n`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'PersonalOS/1.0' },
    });

    const data = await res.json();
    const products = data.products ?? [];

    const foods = products
      .filter((p: any) => {
        const name = p.product_name || p.generic_name;
        const cal = p.nutriments?.['energy-kcal_100g'];
        return name && cal && cal > 0;
      })
      .map((p: any) => {
        const name = (p.product_name || p.generic_name || '').trim();
        const brand = (p.brands || '').split(',')[0].trim();
        const cal   = Math.round(p.nutriments['energy-kcal_100g'] ?? 0);
        const prot  = Math.round((p.nutriments['proteins_100g'] ?? 0) * 10) / 10;
        const carbs = Math.round((p.nutriments['carbohydrates_100g'] ?? 0) * 10) / 10;
        const fat   = Math.round((p.nutriments['fat_100g'] ?? 0) * 10) / 10;
        const whole = isWholeFood(name, brand);
        return {
          name,
          brand,
          isGeneric: whole,
          calories: cal,
          protein: prot,
          carbs,
          fat,
          serving_size: 100,
          serving_unit: 'g',
        };
      })
      // Whole foods first, then by calorie data quality
      .sort((a: any, b: any) => {
        if (a.isGeneric && !b.isGeneric) return -1;
        if (!a.isGeneric && b.isGeneric) return 1;
        return 0;
      })
      // Deduplicate by name
      .filter((item: any, idx: number, arr: any[]) =>
        arr.findIndex(x => x.name.toLowerCase() === item.name.toLowerCase()) === idx
      )
      .slice(0, 10);

    return NextResponse.json({ foods });
  } catch (err: any) {
    console.error('[food-search]', err.message);
    return NextResponse.json({ error: err.message, foods: [] }, { status: 500 });
  }
}
