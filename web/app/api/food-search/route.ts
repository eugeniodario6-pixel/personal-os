import { NextRequest, NextResponse } from 'next/server';

const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const FATSECRET_API_URL = 'https://platform.fatsecret.com/rest/foods/search/v1';
const CONSUMER_KEY = process.env.FATSECRET_CONSUMER_KEY ?? '839cb091ea234c19986e5da004cb1d2a';
const CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET ?? 'c08bfc1bb65e49c1a2c013501b732761';

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const credentials = Buffer.from(`${CONSUMER_KEY}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(FATSECRET_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });

  if (!res.ok) {
    throw new Error(`Token fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as TokenResponse;
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return tokenCache.token;
}

interface ParsedMacros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

function parseDescription(description: string): ParsedMacros {
  // Format: "Per Xg: Calories: Xkcal | Fat: Xg | Carbs: Xg | Protein: Xg"
  const calMatch = description.match(/Calories:\s*([\d.]+)\s*kcal/i);
  const fatMatch = description.match(/Fat:\s*([\d.]+)\s*g/i);
  const carbMatch = description.match(/Carbs:\s*([\d.]+)\s*g/i);
  const proteinMatch = description.match(/Protein:\s*([\d.]+)\s*g/i);

  return {
    calories: calMatch ? Math.round(parseFloat(calMatch[1])) : 0,
    fat_g: fatMatch ? parseFloat(fatMatch[1]) : 0,
    carbs_g: carbMatch ? parseFloat(carbMatch[1]) : 0,
    protein_g: proteinMatch ? parseFloat(proteinMatch[1]) : 0,
  };
}

interface FatSecretFood {
  food_id: string;
  food_name: string;
  food_description: string;
}

interface FatSecretResponse {
  foods?: {
    food?: FatSecretFood | FatSecretFood[];
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || !q.trim()) {
    return NextResponse.json([]);
  }

  try {
    const token = await getToken();

    const url = new URL(FATSECRET_API_URL);
    url.searchParams.set('search_expression', q);
    url.searchParams.set('format', 'json');
    url.searchParams.set('max_results', '10');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'FatSecret API error' }, { status: 502 });
    }

    const data = (await res.json()) as FatSecretResponse;
    const foods = data?.foods?.food;

    if (!foods) {
      return NextResponse.json([]);
    }

    const foodArray: FatSecretFood[] = Array.isArray(foods) ? foods : [foods];

    const mapped = foodArray.map((f) => {
      const macros = parseDescription(f.food_description ?? '');
      return {
        food_id: f.food_id,
        name: f.food_name,
        serving_description: f.food_description,
        ...macros,
      };
    });

    return NextResponse.json(mapped);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
