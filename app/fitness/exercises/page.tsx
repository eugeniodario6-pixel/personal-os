'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getExercises, type Exercise } from '@/lib/db';

// Phase-specific types preserve their phase colors via phase-* classes;
// other colors mapped to tokens.
const TYPE_COLOR: Record<string, string> = {
  Strength:    'rgba(228,242,34,0.4)',
  Power:       'var(--accent)',
  Conditioning:'var(--color-coral-red)',
  Agility:     'var(--color-pulse-green)',
  Mobility:    'var(--color-pulse-green)',
  Flexibility: 'var(--text-3)',
  Bodyweight:  'var(--text)',
  Skill:       'var(--accent)',
};

const TYPES = ['All', 'Strength', 'Power', 'Conditioning', 'Agility', 'Mobility', 'Flexibility', 'Bodyweight', 'Skill'];

export default function ExercisesPage() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExercises().then(data => { setExercises(data); setLoading(false); });
  }, []);

  const filtered = filter === 'All' ? exercises : exercises.filter(e => e.type === filter);

  if (selected) return (
    <div style={{ minHeight: "100dvh", background: "#000", paddingTop: "4.5rem", paddingBottom: "130px" }}>
      {/* Exercise detail header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' as const }}>
            <span
              className="badge badge-fill"
              style={{ color: TYPE_COLOR[selected.type] ?? 'var(--text-4)' }}
            >
              <span>{selected.type.toUpperCase()}</span>
            </span>
            {selected.is_main_lift && (
              <span className="badge phase-build">MAIN LIFT</span>
            )}
          </div>
          <h1 className="page-title">{selected.name.toUpperCase()}</h1>
        </div>
        <button onClick={() => setSelected(null)} className="btn btn-primary btn-sm" style={{ marginLeft: 16, flexShrink: 0 }}>
          ← BACK
        </button>
      </div>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {[
          ['TARGET', selected.primary_target],
          ['EQUIPMENT', selected.equipment],
          ['PATTERN', selected.movement_pattern],
          ['UNIT', selected.unit],
        ].map(([k, v]) => (
          <div key={k} className="stat-cell" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="label" style={{ marginBottom: '0.25rem' }}>{k}</p>
            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 510, color: 'var(--text)' }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Default prescription */}
      {selected.default_prescription && (
        <div className="section" style={{ background: 'var(--color-obsidian)' }}>
          <p className="label" style={{ marginBottom: 5 }}>DEFAULT PRESCRIPTION</p>
          <p style={{ margin: 0, fontSize: '0.8rem' }} className="phase-build">{selected.default_prescription}</p>
        </div>
      )}

      {/* Cues */}
      {selected.cues && (
        <div className="section">
          <div className="card-dark" style={{ borderLeft: '2px solid var(--accent)' }}>
            <p className="label" style={{ marginBottom: '0.4rem', color: 'var(--accent)' }}>CUES</p>
            <p className="body" style={{ margin: 0 }}>{selected.cues}</p>
          </div>
        </div>
      )}

      {/* How-to */}
      {selected.how_to && (
        <div className="section">
          <p className="label" style={{ marginBottom: 8 }}>HOW TO</p>
          <p className="body" style={{ margin: 0, lineHeight: 1.7 }}>{selected.how_to}</p>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#000", paddingTop: "4.5rem", paddingBottom: "130px" }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="label" style={{ marginBottom: 5 }}>FITNESS</p>
          <h1 className="page-title">EXERCISE LIBRARY</h1>
          <p className="body-sm" style={{ marginTop: 3 }}>
            {exercises.length} EXERCISES
          </p>
        </div>
        <button onClick={() => router.push('/fitness/plan')} className="btn btn-primary btn-sm">
          ← PLAN
        </button>
      </div>

      {/* Type filter tab bar */}
      <div className="tab-bar">
        {TYPES.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`tab ${filter === t ? 'active' : ''}`}
            style={filter === t && TYPE_COLOR[t] ? {
              color: TYPE_COLOR[t],
              borderBottomColor: TYPE_COLOR[t],
            } : undefined}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      {loading ? (
        <div className="section">
          <p style={{ fontSize: 13, color: 'var(--text-4)', letterSpacing: '-0.011em' }}>Loading…</p>
        </div>
      ) : (
        filtered.map(ex => (
          <div key={ex.id} className="row" onClick={() => setSelected(ex)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontWeight: 510, color: 'var(--text)', fontSize: '0.8rem' }}>{ex.name}</span>
                {ex.is_main_lift && (
                  <span className="badge phase-build">MAIN</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <span className="label" style={{ color: TYPE_COLOR[ex.type] ?? 'var(--text-3)' }}>{ex.type}</span>
                <span className="label">{ex.primary_target}</span>
              </div>
            </div>
            <span className="text-ghost">→</span>
          </div>
        ))
      )}
    </div>
  );
}
