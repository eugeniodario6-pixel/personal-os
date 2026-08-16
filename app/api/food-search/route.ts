import { NextRequest, NextResponse } from 'next/server';

// ─── Supabase local food DB (primary) ────────────────────────────────────────
const SUPABASE_URL = 'https://tcheylkmqjprpwvtbexw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjaGV5bGttcWpwcnB3dnRiZXh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjcyMzc4NSwiZXhwIjoyMTAyMjk5Nzg1fQ.dqcc7ELqs56oxMHDOv5-5nlDu_yZB5Y6eB9wvupeiSo';

// ─── USDA FoodData Central (fallback) ────────────────────────────────────────
const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';
const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

const NID = { calories: 1008, protein: 1003, carbs: 1005, fat: 1004 };

function getNutrient(nutrients: any[], id: number): number {
  return nutrients.find((n: any) => n.nutrientId === id)?.value ?? 0;
}

// ─── Search local Supabase DB ─────────────────────────────────────────────────
async function searchLocal(query: string) {
  const encoded = encodeURIComponent(`%${query}%`);
  const url = `${SUPABASE_URL}/rest/v1/sa_foods?select=id,food_group,name,calories,protein_g,carbs_g,fat_g,fiber_g,serving_size,serving_unit&name=ilike.${encoded}&limit=12`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) return [];
  const data: any[] = await res.json();

  return data.map(f => ({
    id: String(f.id),
    name: f.name,
    brand: '',
    category: f.food_group || '',
    isGeneric: true,
    isLocal: true,
    calories: Math.round(f.calories ?? 0),
    protein: Math.round((f.protein_g ?? 0) * 10) / 10,
    carbs: Math.round((f.carbs_g ?? 0) * 10) / 10,
    fat: Math.round((f.fat_g ?? 0) * 10) / 10,
    fiber: Math.round((f.fiber_g ?? 0) * 10) / 10,
    serving_size: f.serving_size ?? 100,
    serving_unit: f.serving_unit ?? 'g',
    source: 'local',
  }));
}

// ─── Search USDA fallback ─────────────────────────────────────────────────────
async function searchUSDA(query: string) {
  const params = new URLSearchParams({
    api_key: USDA_API_KEY,
    query,
    pageSize: '10',
    dataType: 'Foundation,SR Legacy',
  });

  const res = await fetch(`${USDA_URL}?${params}`);
  if (!res.ok) return [];
  const data = await res.json();

  return (data?.foods ?? [])
    .map((f: any) => {
      const nutrients: any[] = f.foodNutrients ?? [];
      const cal = Math.round(getNutrient(nutrients, NID.calories));
      if (!cal) return null;
      return {
        id: String(f.fdcId),
        name: f.description ?? '',
        brand: '',
        category: '',
        isGeneric: true,
        isLocal: false,
        calories: cal,
        protein: Math.round(getNutrient(nutrients, NID.protein) * 10) / 10,
        carbs: Math.round(getNutrient(nutrients, NID.carbs) * 10) / 10,
        fat: Math.round(getNutrient(nutrients, NID.fat) * 10) / 10,
        fiber: 0,
        serving_size: 100,
        serving_unit: 'g',
        source: 'usda',
      };
    })
    .filter(Boolean)
    .filter((item: any, idx: number, arr: any[]) =>
      arr.findIndex((x: any) => x.name.toLowerCase() === item.name.toLowerCase()) === idx
    )
    .slice(0, 8);
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query) return NextResponse.json({ foods: [] });

  try {
    // Always hit local DB first
    const local = await searchLocal(query);

    // If local has enough results, skip USDA
    let usda: any[] = [];
    if (local.length < 4) {
      usda = await searchUSDA(query);
      // Filter out USDA items that duplicate local results
      const localNames = new Set(local.map((f: any) => f.name.toLowerCase()));
      usda = usda.filter((f: any) => !localNames.has(f.name.toLowerCase()));
    }

    const foods = [...local, ...usda].slice(0, 12);
    return NextResponse.json({ foods });
  } catch (err: any) {
    console.error('[food-search]', err.message);
    return NextResponse.json({ error: err.message, foods: [] }, { status: 500 });
  }
}
