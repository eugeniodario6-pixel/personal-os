import { NextRequest, NextResponse } from 'next/server';

// ─── Supabase local food DB (primary) ────────────────────────────────────────
const SUPABASE_URL = 'https://tcheylkmqjprpwvtbexw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjaGV5bGttcWpwcnB3dnRiZXh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjcyMzc4NSwiZXhwIjoyMTAyMjk5Nzg1fQ.dqcc7ELqs56oxMHDOv5-5nlDu_yZB5Y6eB9wvupeiSo';


// ─── Search local Supabase DB ─────────────────────────────────────────────────
async function searchLocal(query: string) {
  const encoded = encodeURIComponent(`%${query}%`);
  const url = `${SUPABASE_URL}/rest/v1/sa_foods?select=id,food_group,name,calories,protein_g,carbs_g,fat_g,fiber_g,serving_size,serving_unit&name=ilike.${encoded}&limit=50&order=name.asc`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) return [];
  const data: any[] = await res.json();

  // Sort: group raw + cooked variants together by base name
  data.sort((a: any, b: any) => {
    const baseName = (s: string) => s.replace(/\s*\(.*\)\s*/g, '').trim().toLowerCase();
    const base = baseName(a.name).localeCompare(baseName(b.name));
    if (base !== 0) return base;
    // Within same base: raw before cooked
    const isRaw = (s: string) => s.toLowerCase().includes('raw');
    if (isRaw(a.name) && !isRaw(b.name)) return -1;
    if (!isRaw(a.name) && isRaw(b.name)) return 1;
    return a.name.localeCompare(b.name);
  });

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

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query) return NextResponse.json({ foods: [] });

  try {
    const foods = await searchLocal(query);
    return NextResponse.json({ foods });
  } catch (err: any) {
    console.error('[food-search]', err.message);
    return NextResponse.json({ error: err.message, foods: [] }, { status: 500 });
  }
}
