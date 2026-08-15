import { NextRequest, NextResponse } from 'next/server';

const FRENCH_CHARS = /[éèêëàâùûüôîïçœæÉÈÊËÀÂÙÛÜÔÎÏÇŒÆ]/;

interface OFFProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query) return NextResponse.json({ foods: [] });

  try {
    // Use the English-language OFF endpoint, fetch 40 so we have buffer after filtering
    const url = `https://world.openfoodfacts.org/cgi/search.pl` +
      `?search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1&action=process&json=1` +
      `&page_size=40` +
      `&fields=product_name,product_name_en,brands,nutriments` +
      `&lc=en&cc=us`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'PersonalOS/1.0 (personal health app)' },
      next: { revalidate: 300 }, // cache 5 min server-side
    });

    if (!res.ok) throw new Error(`OFF returned ${res.status}`);
    const data = await res.json();
    const products: OFFProduct[] = data.products ?? [];

    const foods = products
      .map(p => {
        // Prefer English name if available
        const name = (p.product_name_en?.trim() || p.product_name?.trim() || '').slice(0, 80);
        const cal = Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0);
        const protein = Math.round((p.nutriments?.proteins_100g ?? 0) * 10) / 10;
        const carbs = Math.round((p.nutriments?.carbohydrates_100g ?? 0) * 10) / 10;
        const fat = Math.round((p.nutriments?.fat_100g ?? 0) * 10) / 10;
        const brand = p.brands?.split(',')[0]?.trim() ?? '';
        return { name, brand, calories: cal, protein, carbs, fat };
      })
      .filter(f =>
        f.name.length > 0 &&       // has a name
        f.calories > 0 &&          // has calorie data
        !FRENCH_CHARS.test(f.name) // no French accent characters
      )
      .slice(0, 12);

    return NextResponse.json({ foods });
  } catch (err) {
    console.error('[food-search]', err);
    return NextResponse.json({ error: 'Search failed', foods: [] }, { status: 500 });
  }
}
