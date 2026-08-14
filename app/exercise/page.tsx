'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getTodayPlan, WEEKLY_PLAN } from '@/lib/exercises'

interface ExerciseLog {
  exercise_key: string
  completed: boolean
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 20,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  color: 'var(--muted)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

function getDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export default function ExercisePage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const todayPlan = getTodayPlan()
  const todayDate = getDateString()

  useEffect(() => {
    async function fetchLog() {
      try {
        const res = await fetch('/api/exercise?date=today')
        const data = await res.json() as ExerciseLog[]
        const done = new Set(
          data.filter((e) => e.completed).map((e) => e.exercise_key)
        )
        setCompleted(done)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    void fetchLog()
  }, [])

  async function toggleExercise(key: string) {
    const nowDone = !completed.has(key)
    setCompleted((prev) => {
      const next = new Set(prev)
      if (nowDone) next.add(key)
      else next.delete(key)
      return next
    })
    try {
      await fetch('/api/exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayDate,
          exercise_key: key,
          completed: nowDone,
        }),
      })
    } catch {
      // revert on error
      setCompleted((prev) => {
        const next = new Set(prev)
        if (nowDone) next.delete(key)
        else next.add(key)
        return next
      })
    }
  }

  const doneCount = todayPlan.exercises.filter((e) => completed.has(e.key)).length
  const totalCount = todayPlan.exercises.length
  const allDone = totalCount > 0 && doneCount === totalCount

  const todayDayName = todayPlan.day

  return (
    <main style={{ padding: '24px 24px 80px', maxWidth: 390, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <span style={labelStyle}>exercise</span>
        <Link href="/" style={{ fontSize: 20, color: 'var(--muted)', lineHeight: 1 }}>
          ←
        </Link>
      </div>

      {/* Session card */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>{todayPlan.session}</div>
        {todayPlan.exercises.length === 0 ? (
          <div
            style={{
              padding: '40px 0',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 15,
            }}
          >
            rest day
          </div>
        ) : (
          todayPlan.exercises.map((ex, i) => {
            const isDone = completed.has(ex.key)
            return (
              <div
                key={ex.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 0',
                  borderBottom:
                    i < todayPlan.exercises.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                {/* Checkbox */}
                <button
                  onClick={() => void toggleExercise(ex.key)}
                  disabled={loading}
                  style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: isDone ? 'var(--text)' : 'transparent',
                    color: isDone ? 'var(--bg)' : 'transparent',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'background 0.1s',
                  }}
                  aria-label={isDone ? `Unmark ${ex.name}` : `Mark ${ex.name} done`}
                >
                  ✓
                </button>
                <span style={{ fontSize: 15, flex: 1 }}>{ex.name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>
                  {ex.sets}×{ex.reps}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Progress row */}
      {totalCount > 0 && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            marginBottom: 12,
            paddingLeft: 4,
          }}
        >
          {allDone ? (
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              session complete
            </span>
          ) : (
            `${doneCount} of ${totalCount} complete`
          )}
        </div>
      )}

      {/* Week strip */}
      <div style={{ ...card, marginTop: 12 }}>
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {WEEKLY_PLAN.map((dayPlan) => {
            const isToday = dayPlan.day === todayDayName
            return (
              <div
                key={dayPlan.day}
                style={{
                  width: 36,
                  height: 28,
                  border: `1px solid ${isToday ? 'var(--text)' : 'var(--border)'}`,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: isToday ? 600 : 400,
                  color: isToday ? 'var(--text)' : 'var(--muted)',
                }}
              >
                {dayPlan.label}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
