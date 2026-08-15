import { NextRequest, NextResponse } from 'next/server';

// FatSecret OAuth2 client credentials flow
async function getFatSecretToken(): Promise<string> {
  const clientId = process.env.FATSECRET_CLIENT_ID!;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET!;

  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials&scope=basic',
  });

  if (!res.ok) throw new Error('FatSecret auth failed');
  const data = await res.json();
  return data.access_token as string;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const token = await getFatSecretToken();

    const res = await fetch(
      `https://platform.fatsecret.com/rest/server.api?method=foods.search&search_expression=${encodeURIComponent(query)}&format=json&max_results=20&language=en&region=ZA`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!res.ok) throw new Error('FatSecret search failed');
    const data = await res.json();

    const foods = data?.foods?.food;
    if (!foods) return NextResponse.json({ results: [] });

    const list = Array.isArray(foods) ? foods : [foods];

    const results = list
      .map((f: {
        food_name: string;
        brand_name?: string;
        food_description?: string;
      }) => {
        // food_description format: "Per 100g - Calories: 250kcal | Fat: 10g | Carbs: 20g | Protein: 25g"
        const desc = f.food_description ?? '';
        const cal = parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1] ?? '0');
        const fat = parseFloat(desc.match(/Fat:\s*([\d.]+)/i)?.[1] ?? '0');
        const carbs = parseFloat(desc.match(/Carbs:\s*([\d.]+)/i)?.[1] ?? '0');
        const protein = parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1] ?? '0');

        return {
          name: f.food_name,
          brand: f.brand_name ?? '',
          cal100: Math.round(cal),
          protein100: Math.round(protein * 10) / 10,
          carbs100: Math.round(carbs * 10) / 10,
          fat100: Math.round(fat * 10) / 10,
        };
      })
      .filter(f => f.cal100 > 0);

    return NextResponse.json({ results });
  } catch (err) {
    console.error('FatSecret error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
