import { NextRequest, NextResponse } from 'next/server'

interface FatSecretFood {
  food_id: string
  food_name: string
  food_description: string
}

interface FatSecretResponse {
  foods?: {
    food?: FatSecretFood | FatSecretFood[]
  }
}

interface FoodResult {
  food_id: string
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_description: string
}

// Module-level token cache
let cachedToken: string | null = null
let tokenExpiry = 0

async function getFatSecretToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken
  }

  const key = process.env.FATSECRET_CONSUMER_KEY ?? ''
  const secret = process.env.FATSECRET_CLIENT_SECRET ?? ''
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64')

  const response = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  })

  if (!response.ok) {
    throw new Error(`Token fetch failed: ${response.status}`)
  }

  const data = await response.json() as { access_token: string; expires_in: number }
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

function parseFood(food: FatSecretFood): FoodResult {
  const desc = food.food_description ?? ''
  const match = desc.match(/Calories:\s*([\d.]+)kcal.*?Fat:\s*([\d.]+)g.*?Carbs:\s*([\d.]+)g.*?Protein:\s*([\d.]+)g/i)

  return {
    food_id: food.food_id,
    name: food.food_name,
    calories: match ? Math.round(parseFloat(match[1])) : 0,
    fat_g: match ? Math.round(parseFloat(match[2]) * 10) / 10 : 0,
    carbs_g: match ? Math.round(parseFloat(match[3]) * 10) / 10 : 0,
    protein_g: match ? Math.round(parseFloat(match[4]) * 10) / 10 : 0,
    serving_description: desc.split('|')[0].trim(),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''

    if (q.trim().length < 2) {
      return NextResponse.json([])
    }

    const token = await getFatSecretToken()

    const searchUrl = `https://platform.fatsecret.com/rest/foods/search/v1?search_expression=${encodeURIComponent(q)}&format=json&max_results=8`
    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      console.error('FatSecret search failed:', response.status)
      return NextResponse.json([])
    }

    const data = await response.json() as FatSecretResponse
    const foodsRaw = data.foods?.food

    if (!foodsRaw) {
      return NextResponse.json([])
    }

    const foods: FatSecretFood[] = Array.isArray(foodsRaw) ? foodsRaw : [foodsRaw]
    const results: FoodResult[] = foods.map(parseFood)

    return NextResponse.json(results)
  } catch (err) {
    console.error('food-search error:', err)
    return NextResponse.json([])
  }
}
