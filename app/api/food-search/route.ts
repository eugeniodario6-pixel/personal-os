import { NextRequest, NextResponse } from 'next/server';

let cachedToken: { token: string; expires: number } | null = null;

async function getFatSecretToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }

  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(`Missing credentials: ID=${!!clientId} SECRET=${!!clientSecret}`);
  }

  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'basic',
    }).toString(),
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`Token parse error: ${text.slice(0, 200)}`); }
  if (!data.access_token) throw new Error(`No token: ${JSON.stringify(data)}`);

  cachedToken = {
    token: data.access_token,
    expires: Date.now() + ((data.expires_in ?? 86400) - 60) * 1000,
  };
  return cachedToken.token;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  // Debug endpoint
  if (query === '__debug') {
    try {
      const token = await getFatSecretToken();
      // Quick test search
      const testRes = await fetch(
        `https://platform.fatsecret.com/rest/foods/search/v1?search_expression=apple&format=json&max_results=2`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const testData = await testRes.json();
      return NextResponse.json({
        hasId: !!process.env.FATSECRET_CLIENT_ID,
        hasSecret: !!process.env.FATSECRET_CLIENT_SECRET,
        tokenOk: true,
        searchStatus: testRes.status,
        rawResponse: JSON.stringify(testData).slice(0, 500),
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message, hasId: !!process.env.FATSECRET_CLIENT_ID, hasSecret: !!process.env.FATSECRET_CLIENT_SECRET });
    }
  }

  if (!query?.trim()) return NextResponse.json({ foods: [] });

  try {
    const token = await getFatSecretToken();

    const url = `https://platform.fatsecret.com/rest/foods/search/v1?search_expression=${encodeURIComponent(query.trim())}&format=json&max_results=10`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error(`Parse error: ${text.slice(0, 300)}`); }

    if (data.error) throw new Error(`FatSecret error: ${JSON.stringify(data.error)}`);

    const raw = data?.foods?.food ?? [];
    const items = Array.isArray(raw) ? raw : [raw];

    const foods = items
      .filter((f: any) => f.food_name)
      .map((f: any) => {
        const desc: string = f.food_description ?? '';
        const cal   = parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1] ?? '0');
        const fat   = parseFloat(desc.match(/Fat:\s*([\d.]+)/i)?.[1] ?? '0');
        const carbs = parseFloat(desc.match(/Carbs:\s*([\d.]+)/i)?.[1] ?? '0');
        const prot  = parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1] ?? '0');
        const per   = desc.match(/Per\s+([\d.]+)\s*(\w+)/i);
        const servingSize = per ? parseFloat(per[1]) : 100;
        const servingUnit = per ? per[2].toLowerCase() : 'g';
        const isGeneric = f.food_type === 'Generic';
        return {
          id: f.food_id,
          name: f.food_name,
          brand: f.brand_name ?? '',
          type: f.food_type ?? 'Generic',
          isGeneric,
          calories: Math.round(cal),
          protein: Math.round(prot * 10) / 10,
          carbs:   Math.round(carbs * 10) / 10,
          fat:     Math.round(fat * 10) / 10,
          serving_size: servingSize,
          serving_unit: servingUnit,
        };
      })
      // Whole foods first, branded second
      .sort((a: any, b: any) => {
        if (a.isGeneric && !b.isGeneric) return -1;
        if (!a.isGeneric && b.isGeneric) return 1;
        return 0;
      })
      .slice(0, 10);

    return NextResponse.json({ foods });
  } catch (err: any) {
    console.error('[food-search]', err.message);
    return NextResponse.json({ error: err.message, foods: [] }, { status: 500 });
  }
}
