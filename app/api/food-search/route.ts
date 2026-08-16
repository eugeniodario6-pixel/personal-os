import { NextRequest, NextResponse } from 'next/server';

const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const FATSECRET_SEARCH_URL = 'https://platform.fatsecret.com/rest/server.api';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const clientId = process.env.FATSECRET_CLIENT_ID!;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(FATSECRET_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });

  if (!res.ok) throw new Error(`FatSecret token error: ${res.status}`);
  const data = await res.json();

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

interface FatSecretFood {
  food_name: string;
  brand_name?: string;
  food_type: string;
  servings?: {
    serving: FatSecretServing | FatSecretServing[];
  };
}

interface FatSecretServing {
  serving_description: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
  is_default?: string;
}

function getDefaultServing(food: FatSecretFood): FatSecretServing | null {
  if (!food.servings?.serving) return null;
  const servings = Array.isArray(food.servings.serving)
    ? food.servings.serving
    : [food.servings.serving];
  return servings.find(s => s.is_default === '1') ?? servings[0] ?? null;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query) return NextResponse.json({ foods: [] });

  try {
    const token = await getAccessToken();

    const params = new URLSearchParams({
      method: 'foods.search',
      search_expression: query,
      format: 'json',
      max_results: '20',
      include_food_images: '0',
      include_food_attributes: '0',
    });

    const res = await fetch(`${FATSECRET_SEARCH_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error(`FatSecret search error: ${res.status}`);
    const data = await res.json();

    const rawFoods: FatSecretFood[] = data?.foods?.food ?? [];

    const foods = rawFoods
      .map(f => {
        const serving = getDefaultServing(f);
        const cal = Math.round(parseFloat(serving?.calories ?? '0'));
        const protein = Math.round((parseFloat(serving?.protein ?? '0')) * 10) / 10;
        const carbs = Math.round((parseFloat(serving?.carbohydrate ?? '0')) * 10) / 10;
        const fat = Math.round((parseFloat(serving?.fat ?? '0')) * 10) / 10;
        const servingAmt = parseFloat(serving?.metric_serving_amount ?? '100');
        const servingUnit = serving?.metric_serving_unit ?? 'g';

        return {
          name: f.food_name.slice(0, 80),
          brand: f.brand_name ?? (f.food_type === 'Generic' ? 'Generic' : ''),
          calories: cal,
          protein,
          carbs,
          fat,
          serving_size: servingAmt,
          serving_unit: servingUnit,
        };
      })
      .filter(f => f.name.length > 0 && f.calories > 0)
      .slice(0, 12);

    return NextResponse.json({ foods });
  } catch (err) {
    console.error('[food-search]', err);
    return NextResponse.json({ error: 'Search failed', foods: [] }, { status: 500 });
  }
}
