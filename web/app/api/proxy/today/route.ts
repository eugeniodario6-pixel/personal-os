import { NextResponse } from 'next/server'

const UPSTREAM = 'https://api-seven-ebon-33.vercel.app'

export async function GET() {
  try {
    const res = await fetch(`${UPSTREAM}/api/nutrition/today`, {
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch nutrition data', detail: String(error) },
      { status: 500 }
    )
  }
}
