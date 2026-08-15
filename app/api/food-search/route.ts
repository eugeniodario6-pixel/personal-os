import { NextRequest, NextResponse } from 'next/server';

let cachedToken: { token: string; expires: number } | null = null;

async function getFatSecretToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }
  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.FATSECRET_CLIENT_ID!,
      client_secret: process.env.FATSECRET_CLIENT_SECRET!,
      scope: 'basic',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get FatSecret token');
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query?.trim()) return NextResponse.json({ foods: [] });

  try {
    const token = await getFatSecretToken();

    // URL-based integration, OAuth 2.0 — foods search v1
    const url = `https://platform.fatsecret.com/rest/foods/search/v1?search_expression=${encodeURIComponent(query)}&format=json&max_results=10`;

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    const raw = data?.foods?.food ?? [];
    const items = Array.isArray(raw) ? raw : [raw];

    const foods = items.map((f: any) => {
      const desc: string = f.food_description ?? '';
      const cal   = parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1] ?? '0');
      const fat   = parseFloat(desc.match(/Fat:\s*([\d.]+)/i)?.[1] ?? '0');
      const carbs = parseFloat(desc.match(/Carbs:\s*([\d.]+)/i)?.[1] ?? '0');
      const prot  = parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1] ?? '0');
      const per   = desc.match(/Per\s+([\d.]+)\s*(\w+)/i);
      const servingSize = per ? parseFloat(per[1]) : 100;
      const servingUnit = per ? per[2].toLowerCase() : 'g';

      return {
        id: f.food_id,
        name: f.food_name,
        brand: f.brand_name ?? '',
        type: f.food_type ?? 'Generic',
        calories: Math.round(cal),
        protein: Math.round(prot * 10) / 10,
        carbs:   Math.round(carbs * 10) / 10,
        fat:     Math.round(fat * 10) / 10,
        serving_size: servingSize,
        serving_unit: servingUnit,
      };
    });

    return NextResponse.json({ foods });
  } catch (err: any) {
    console.error('FatSecret error:', err.message);
    return NextResponse.json({ error: 'Search failed', foods: [] }, { status: 500 });
  }
}
