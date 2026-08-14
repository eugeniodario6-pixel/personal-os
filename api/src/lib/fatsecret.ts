export interface FatSecretDiary {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;

/**
 * Fetch an OAuth 2.0 client_credentials token from FatSecret.
 * Caches in module scope until 60s before expiry.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();

  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.FATSECRET_CONSUMER_KEY;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing FATSECRET_CONSUMER_KEY or FATSECRET_CLIENT_SECRET env vars'
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'basic',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FatSecret token error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in - 60) * 1000,
  };

  return tokenCache.accessToken;
}

/**
 * Convert a JS Date to FatSecret's "days since Jan 1 1970" integer.
 */
function dateToDaysSinceEpoch(date: Date): number {
  const epoch = new Date(1970, 0, 1); // local Jan 1 1970
  const ms = date.getTime() - epoch.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Fetch the FatSecret food diary for a specific date and return macro totals.
 *
 * Uses food_entries.get with the date param (days since Jan 1 1970).
 * In a single-user personal app, the API key's default profile is used.
 */
export async function getDiaryForDate(
  _userId: string,
  date: Date
): Promise<FatSecretDiary> {
  const token = await getAccessToken();
  const daysSinceEpoch = dateToDaysSinceEpoch(date);

  const params = new URLSearchParams({
    method: 'food_entries.get',
    date: String(daysSinceEpoch),
    format: 'json',
  });

  const res = await fetch(
    `https://platform.fatsecret.com/rest/server.api?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FatSecret diary error ${res.status}: ${text}`);
  }

  const data = await res.json();

  // FatSecret returns { food_entries: { food_entry: [...] } } or {}
  const entries: Array<{
    calories?: string | number;
    protein?: string | number;
    carbohydrate?: string | number;
    fat?: string | number;
  }> = (() => {
    const fe = data?.food_entries;
    if (!fe) return [];
    const entry = fe.food_entry;
    if (!entry) return [];
    return Array.isArray(entry) ? entry : [entry];
  })();

  let calories = 0;
  let protein_g = 0;
  let carbs_g = 0;
  let fat_g = 0;

  for (const entry of entries) {
    calories += parseFloat(String(entry.calories ?? 0)) || 0;
    protein_g += parseFloat(String(entry.protein ?? 0)) || 0;
    carbs_g += parseFloat(String(entry.carbohydrate ?? 0)) || 0;
    fat_g += parseFloat(String(entry.fat ?? 0)) || 0;
  }

  return {
    calories: Math.round(calories),
    protein_g: Math.round(protein_g * 10) / 10,
    carbs_g: Math.round(carbs_g * 10) / 10,
    fat_g: Math.round(fat_g * 10) / 10,
  };
}
