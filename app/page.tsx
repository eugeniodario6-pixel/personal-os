'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getTodayPlan } from '@/lib/exercises'

interface Meal {
  id: string
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  date: string
}

interface ExerciseLog {
  exercise_key: string
  completed: boolean
}

const TARGET = {
  calories: 1800,
  protein_g: 185,
  carbs_g: 45,
  fat_g: 98,
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 20,
}

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  color: 'var(--muted)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const rowBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 0',
}

export default function TodayPage() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set())

  const todayPlan = getTodayPlan()

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme')
    setTheme(current === 'light' ? 'light' : 'dark')
  }, [])

  useEffect(() => {
    async function fetchData() {
      try {
        const [mealsRes, exerciseRes] = await Promise.all([
          fetch('/api/meals?date=today'),
          fetch('/api/exercise?date=today'),
        ])
        const mealsData = await mealsRes.json() as Meal[]
        const exerciseData = await exerciseRes.json() as ExerciseLog[]
        setMeals(Array.isArray(mealsData) ? mealsData : [])
        const done = new Set(
          exerciseData.filter((e) => e.completed).map((e) => e.exercise_key)
        )
        setCompletedKeys(done)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    void fetchData()
  }, [])

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein_g: acc.protein_g + (m.protein_g ?? 0),
      carbs_g: acc.carbs_g + (m.carbs_g ?? 0),
      fat_g: acc.fat_g + (m.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )

  const remaining = TARGET.calories - totals.calories
  const calorieProgress = Math.min(100, (totals.calories / TARGET.calories) * 100)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  const previewExercises = todayPlan.exercises.slice(0, 3)
  const doneCount = todayPlan.exercises.filter((e) => completedKeys.has(e.key)).length
  const totalCount = todayPlan.exercises.length

  return (
    <main
      style={{
        padding: '24px 24px 80px',
        maxWidth: 390,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <span style={label}>today</span>
        <button
          onClick={toggleTheme}
          style={{
            width: 32,
            height: 32,
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '○' : '●'}
        </button>
      </div>

      {/* Calorie block */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ ...label, marginBottom: 8 }}>calories</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 48, fontWeight: 600, lineHeight: 1 }}>
            {loading ? '—' : totals.calories}
          </span>
          <span style={{ fontSize: 20, fontWeight: 300, color: 'var(--muted)' }}>
            / {TARGET.calories}
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: 2,
            background: 'var(--border)',
            borderRadius: 1,
            marginTop: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${calorieProgress}%`,
              height: '100%',
              background: 'var(--text)',
              borderRadius: 1,
              transition: 'width 0.3s',
            }}
          />
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 300,
            color: 'var(--muted)',
            marginTop: 6,
          }}
        >
          {loading
            ? ''
            : remaining >= 0
            ? `${remaining} remaining`
            : `${Math.abs(remaining)} over target`}
        </div>
      </div>

      {/* Macros card */}
      <div style={{ ...card, marginBottom: 12 }}>
        {(
          [
            { key: 'protein_g', label: 'protein', target: TARGET.protein_g },
            { key: 'carbs_g', label: 'carbs', target: TARGET.carbs_g },
            { key: 'fat_g', label: 'fat', target: TARGET.fat_g },
          ] as const
        ).map((macro, i, arr) => (
          <div
            key={macro.key}
            style={{
              ...rowBase,
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={label}>{macro.label}</span>
            <span style={{ fontSize: 15 }}>
              {loading ? '—' : Math.round(totals[macro.key])}g / {macro.target}g
            </span>
          </div>
        ))}
      </div>

      {/* Meals card */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div
          style={{
            ...rowBase,
            paddingTop: 0,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={label}>meals</span>
          <Link
            href="/meals"
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.04em',
            }}
          >
            add
          </Link>
        </div>
        {loading ? (
          <div
            style={{
              padding: '20px 0',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 15,
            }}
          >
            loading
          </div>
        ) : meals.length === 0 ? (
          <div
            style={{
              padding: '20px 0',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 15,
            }}
          >
            no meals logged
          </div>
        ) : (
          meals.map((meal, i) => (
            <div
              key={meal.id}
              style={{
                ...rowBase,
                borderBottom: i < meals.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{ fontSize: 15 }}>{meal.name}</span>
              <span style={{ fontSize: 15, color: 'var(--muted)' }}>{meal.calories}</span>
            </div>
          ))
        )}
      </div>

      {/* Exercise card */}
      <div style={{ ...card, marginTop: 12 }}>
        <div
          style={{
            ...rowBase,
            paddingTop: 0,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={label}>exercise</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{todayPlan.session}</span>
        </div>
        {todayPlan.exercises.length === 0 ? (
          <div
            style={{
              padding: '20px 0',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 15,
            }}
          >
            rest day
          </div>
        ) : (
          <>
            {previewExercises.map((ex, i) => (
              <div
                key={ex.key}
                style={{
                  ...rowBase,
                  borderBottom:
                    i < previewExercises.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span style={{ fontSize: 15 }}>{ex.name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>
                  {ex.sets}×{ex.reps}
                </span>
              </div>
            ))}
            <div
              style={{
                paddingTop: 14,
                borderTop: '1px solid var(--border)',
              }}
            >
              <Link
                href="/exercise"
                style={{ fontSize: 12, color: 'var(--muted)' }}
              >
                {doneCount} / {totalCount} done
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
