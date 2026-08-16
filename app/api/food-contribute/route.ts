import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = 'https://tcheylkmqjprpwvtbexw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjaGV5bGttcWpwcnB3dnRiZXh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjcyMzc4NSwiZXhwIjoyMTAyMjk5Nzg1fQ.dqcc7ELqs56oxMHDOv5-5nlDu_yZB5Y6eB9wvupeiSo';

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, calories, protein, carbs, fat, fiber, serving_size, serving_unit, food_group } = body;

    if (!name?.trim() || !calories) {
      return NextResponse.json({ error: 'name and calories are required' }, { status: 400 });
    }

    const cleanName = name.trim();

    // Deduplicate — skip if name already exists (case-insensitive)
    const checkUrl = `${SUPABASE_URL}/rest/v1/sa_foods?select=id&name=ilike.${encodeURIComponent(cleanName)}&limit=1`;
    const checkRes = await fetch(checkUrl, { headers });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      if (existing.length > 0) {
        return NextResponse.json({ status: 'exists', id: existing[0].id });
      }
    }

    // Insert new food
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/sa_foods`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: cleanName,
        calories: parseFloat(calories) || 0,
        protein_g: parseFloat(protein) || 0,
        carbs_g: parseFloat(carbs) || 0,
        fat_g: parseFloat(fat) || 0,
        fiber_g: parseFloat(fiber) || 0,
        serving_size: parseFloat(serving_size) || 100,
        serving_unit: serving_unit || 'g',
        food_group: food_group || 'Other',
      }),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('[food-contribute]', err);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    return NextResponse.json({ status: 'created' });
  } catch (err: any) {
    console.error('[food-contribute]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
