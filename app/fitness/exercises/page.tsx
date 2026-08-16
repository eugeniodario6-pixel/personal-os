'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getExercises, type Exercise } from '@/lib/db';

const MONO = "'IBM Plex Mono', monospace";

const TYPE_COLOR: Record<string, string> = {
  Strength: '#e8ff00', Power: '#F5A623', Conditioning: '#f44336',
  Agility: '#4ab8ff', Mobility: '#4ade80', Flexibility: '#88f',
  Bodyweight: '#ffffff', Skill: '#F5A623',
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
    <div className="page" style={{ paddingTop: '4rem' }}>
      {/* Exercise detail header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' as const }}>
            <span
              className="badge badge-fill"
              style={{ color: TYPE_COLOR[selected.type] ?? '#555' }}
            >
              <span>{selected.type.toUpperCase()}</span>
            </span>
            {selected.is_main_lift && (
              <span className="badge" style={{ color: '#e8ff00' }}>MAIN LIFT</span>
            )}
          </div>
          <h1 className="page-title">{selected.name.toUpperCase()}</h1>
        </div>
        <button onClick={() => setSelected(null)} className="btn btn-primary btn-sm" style={{ marginLeft: '1rem', flexShrink: 0 }}>
          ← BACK
        </button>
      </div>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', borderBottom: '2px solid var(--border-2)' }}>
        {[
          ['TARGET', selected.primary_target],
          ['EQUIPMENT', selected.equipment],
          ['PATTERN', selected.movement_pattern],
          ['UNIT', selected.unit],
        ].map(([k, v]) => (
          <div key={k} className="stat-cell" style={{ borderBottom: '1px solid var(--border-1)' }}>
            <p className="label" style={{ marginBottom: '0.25rem' }}>{k}</p>
            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: MONO }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Default prescription */}
      {selected.default_prescription && (
        <div className="section" style={{ background: 'var(--surface-1)' }}>
          <p className="label" style={{ marginBottom: '0.3rem' }}>DEFAULT PRESCRIPTION</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#e8ff00', fontFamily: MONO }}>{selected.default_prescription}</p>
        </div>
      )}

      {/* Cues */}
      {selected.cues && (
        <div className="section">
          <div className="card-dark" style={{ borderLeft: '2px solid var(--amber)' }}>
            <p className="label" style={{ marginBottom: '0.4rem', color: 'var(--amber)' }}>CUES</p>
            <p className="body" style={{ margin: 0, fontFamily: MONO }}>{selected.cues}</p>
          </div>
        </div>
      )}

      {/* How-to */}
      {selected.how_to && (
        <div className="section">
          <p className="label" style={{ marginBottom: '0.5rem' }}>HOW TO</p>
          <p className="body" style={{ margin: 0, fontFamily: MONO, lineHeight: 1.7 }}>{selected.how_to}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="page" style={{ paddingTop: '4rem' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="label" style={{ marginBottom: '0.3rem' }}>FITNESS</p>
          <h1 className="page-title">EXERCISE LIBRARY</h1>
          <p className="body-sm" style={{ marginTop: '0.2rem', fontFamily: MONO }}>
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
          <p className="label">LOADING...</p>
        </div>
      ) : (
        filtered.map(ex => (
          <div key={ex.id} className="row" onClick={() => setSelected(ex)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: MONO }}>{ex.name}</span>
                {ex.is_main_lift && (
                  <span className="badge" style={{ color: '#e8ff00' }}>MAIN</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <span className="label" style={{ color: TYPE_COLOR[ex.type] ?? 'var(--text-tertiary)' }}>{ex.type}</span>
                <span className="label">{ex.primary_target}</span>
              </div>
            </div>
            <span className="text-dim">→</span>
          </div>
        ))
      )}
    </div>
  );
}
