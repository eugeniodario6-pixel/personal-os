import { NextRequest, NextResponse } from 'next/server';

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const clientId = process.env.FATSECRET_CLIENT_ID || '91f84c88db6949f6b9f59c7a426721e6';
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET || 'bf8f48b599aa4a68974c280c58fb121b';
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });

  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

// Parse macros from FatSecret description string:
// "Per 100g - Calories: 165kcal | Fat: 3.57g | Carbs: 0.00g | Protein: 31.02g"
function parseDescription(desc: string) {
  const cal     = parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1] ?? '0');
  const fat     = parseFloat(desc.match(/Fat:\s*([\d.]+)/i)?.[1] ?? '0');
  const carbs   = parseFloat(desc.match(/Carbs:\s*([\d.]+)/i)?.[1] ?? '0');
  const protein = parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1] ?? '0');

  // Extract serving size from "Per Xg" or "Per X oz" etc.
  const perMatch = desc.match(/Per\s+([\d.]+)\s*(\w+)/i);
  const servingSize = perMatch ? parseFloat(perMatch[1]) : 100;
  const servingUnit = perMatch ? perMatch[2].toLowerCase() : 'g';

  return { cal, fat, carbs, protein, servingSize, servingUnit };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query) return NextResponse.json({ foods: [] });

  try {
    const token = await getToken();

    const params = new URLSearchParams({
      method: 'foods.search',
      search_expression: query,
      format: 'json',
      max_results: '20',
    });

    const res = await fetch(`${API_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const data = await res.json();

    const raw: any[] = data?.foods?.food ?? [];

    const foods = raw
      .map((f: any) => {
        const desc = f.food_description ?? '';
        const { cal, fat, carbs, protein, servingSize, servingUnit } = parseDescription(desc);
        if (!cal) return null;

        return {
          id: f.food_id,
          name: f.food_name ?? '',
          brand: f.brand_name ?? '',
          isGeneric: f.food_type === 'Generic',
          calories: Math.round(cal),
          protein: Math.round(protein * 10) / 10,
          carbs: Math.round(carbs * 10) / 10,
          fat: Math.round(fat * 10) / 10,
          serving_size: servingSize,
          serving_unit: servingUnit,
        };
      })
      .filter(Boolean)
      // Generics first
      .sort((a: any, b: any) => (a.isGeneric === b.isGeneric ? 0 : a.isGeneric ? -1 : 1))
      // Deduplicate by name
      .filter((item: any, idx: number, arr: any[]) =>
        arr.findIndex((x: any) => x.name.toLowerCase() === item.name.toLowerCase()) === idx
      )
      .slice(0, 12);

    return NextResponse.json({ foods });
  } catch (err: any) {
    console.error('[food-search]', err.message);
    return NextResponse.json({ error: err.message, foods: [], debug: err.message }, { status: 500 });
  }
}
