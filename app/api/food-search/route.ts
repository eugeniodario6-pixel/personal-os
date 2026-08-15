import { NextRequest, NextResponse } from 'next/server';

const FATSECRET_KEY = process.env.FATSECRET_KEY!;
const FATSECRET_SECRET = process.env.FATSECRET_SECRET!;
const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

async function getAccessToken(): Promise<string> {
  const creds = Buffer.from(`${FATSECRET_KEY}:${FATSECRET_SECRET}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });
  const data = await res.json();
  return data.access_token;
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ foods: [] });
  }

  try {
    const token = await getAccessToken();

    const params = new URLSearchParams({
      method: 'foods.search',
      search_expression: query,
      format: 'json',
      max_results: '10',
      page_number: '0',
    });

    const res = await fetch(`${API_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    const items = data?.foods?.food ?? [];

    const foods = items.map((f: Record<string, string>) => {
      // FatSecret returns nutrition in description like "Per 100g - Calories: 250kcal | Fat: 10g | Carbs: 30g | Protein: 20g"
      const desc: string = f.food_description ?? '';
      const cal = parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1] ?? '0');
      const fat = parseFloat(desc.match(/Fat:\s*([\d.]+)/i)?.[1] ?? '0');
      const carbs = parseFloat(desc.match(/Carbs:\s*([\d.]+)/i)?.[1] ?? '0');
      const protein = parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1] ?? '0');

      return {
        external_id: f.food_id,
        name: f.food_name,
        brand: f.brand_name ?? null,
        serving_size: 100,
        serving_unit: 'g',
        calories: cal,
        protein,
        carbs,
        fat,
      };
    });

    return NextResponse.json({ foods });
  } catch (err) {
    console.error('FatSecret error:', err);
    return NextResponse.json({ foods: [], error: 'Search failed' }, { status: 500 });
  }
}
