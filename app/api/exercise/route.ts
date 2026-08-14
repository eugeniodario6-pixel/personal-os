import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const date = dateParam === 'today' || !dateParam ? getToday() : dateParam

    const client = createServerClient()
    const { data, error } = await client
      .from('exercise_log')
      .select('*')
      .eq('date', date)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('GET /api/exercise error:', err)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      date: string
      exercise_key: string
      completed: boolean
    }

    const client = createServerClient()
    const { error } = await client
      .from('exercise_log')
      .upsert(
        {
          date: body.date,
          exercise_key: body.exercise_key,
          completed: body.completed,
        },
        { onConflict: 'date,exercise_key' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/exercise error:', err)
    return NextResponse.json({ error: 'Failed to update exercise' }, { status: 500 })
  }
}
