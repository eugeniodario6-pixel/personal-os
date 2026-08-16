'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getExercises, type Exercise } from '@/lib/db';

const MONO = "'IBM Plex Mono', monospace";
const lbl = { fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: '#555', margin: 0 };
const B2 = '2px solid #222';
const B1 = '1px solid #161616';
const BG = '#000';
const SURFACE = '#070707';

const TYPE_COLOR: Record<string, string> = {
  Strength: '#e8ff00', Power: '#f70', Conditioning: '#f44',
  Agility: '#4af', Mobility: '#4f8', Flexibility: '#88f',
  Bodyweight: '#fff', Skill: '#fa8',
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
    <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>
      {/* Exercise detail */}
      <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.15em', padding: '0.2rem 0.5rem', background: TYPE_COLOR[selected.type] ?? '#555', color: '#000' }}>
              {selected.type.toUpperCase()}
            </span>
            {selected.is_main_lift && (
              <span style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.15em', padding: '0.2rem 0.5rem', border: '1px solid #e8ff00', color: '#e8ff00' }}>
                MAIN LIFT
              </span>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{selected.name.toUpperCase()}</h1>
        </div>
        <button onClick={() => setSelected(null)}
          style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.875rem', border: B2, background: '#fff', color: '#000', cursor: 'pointer', fontFamily: MONO, marginLeft: '1rem', flexShrink: 0 }}>
          ← BACK
        </button>
      </div>

      {/* Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', borderBottom: B2 }}>
        {[
          ['TARGET', selected.primary_target],
          ['EQUIPMENT', selected.equipment],
          ['PATTERN', selected.movement_pattern],
          ['UNIT', selected.unit],
        ].map(([k, v]) => (
          <div key={k} style={{ padding: '0.75rem 1.25rem', borderBottom: B1, borderRight: B1 }}>
            <p style={{ ...lbl, marginBottom: '0.2rem', color: '#333' }}>{k}</p>
            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Default prescription */}
      {selected.default_prescription && (
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: B2, background: SURFACE }}>
          <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>DEFAULT PRESCRIPTION</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#e8ff00', fontFamily: MONO }}>{selected.default_prescription}</p>
        </div>
      )}

      {/* Cues */}
      {selected.cues && (
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: B2 }}>
          <p style={{ ...lbl, marginBottom: '0.4rem', color: '#333' }}>CUES</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#fff', lineHeight: 1.6, fontFamily: MONO }}>{selected.cues}</p>
        </div>
      )}

      {/* How-to */}
      {selected.how_to && (
        <div style={{ padding: '0.875rem 1.25rem' }}>
          <p style={{ ...lbl, marginBottom: '0.4rem', color: '#333' }}>HOW TO</p>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#888', lineHeight: 1.7, fontFamily: MONO }}>{selected.how_to}</p>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ fontFamily: MONO, paddingTop: '4rem', background: BG, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: B2, background: SURFACE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ ...lbl, marginBottom: '0.3rem', color: '#333' }}>FITNESS</p>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
            EXERCISE LIBRARY
          </h1>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.65rem', color: '#333', fontFamily: MONO }}>
            {exercises.length} EXERCISES
          </p>
        </div>
        <button onClick={() => router.push('/fitness/plan')}
          style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.5rem 0.875rem', border: B2, background: '#fff', color: '#000', cursor: 'pointer', fontFamily: MONO }}>
          ← PLAN
        </button>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', overflowX: 'auto' as const, borderBottom: B2, background: SURFACE }}>
        {TYPES.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            style={{
              flexShrink: 0, padding: '0.6rem 0.875rem', fontSize: '0.55rem', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase' as const,
              border: 'none', background: BG, cursor: 'pointer', fontFamily: MONO,
              color: filter === t ? (TYPE_COLOR[t] ?? '#fff') : '#333',
              borderBottom: `2px solid ${filter === t ? (TYPE_COLOR[t] ?? '#fff') : 'transparent'}`,
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      {loading ? (
        <div style={{ padding: '2rem 1.25rem', color: '#333', fontSize: '0.75rem' }}>LOADING...</div>
      ) : (
        filtered.map(ex => (
          <button key={ex.id} onClick={() => setSelected(ex)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', padding: '0.875rem 1.25rem', background: BG,
              border: 'none', borderBottom: B1, cursor: 'pointer', textAlign: 'left' as const, fontFamily: MONO,
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.8rem' }}>{ex.name}</span>
                {ex.is_main_lift && (
                  <span style={{ fontSize: '0.45rem', fontWeight: 700, letterSpacing: '0.12em', color: '#e8ff00', border: '1px solid #e8ff00', padding: '0.1rem 0.3rem', flexShrink: 0 }}>
                    MAIN
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <span style={{ ...lbl, color: TYPE_COLOR[ex.type] ?? '#555', fontSize: '0.5rem' }}>{ex.type}</span>
                <span style={{ ...lbl, color: '#2a2a2a', fontSize: '0.5rem' }}>{ex.primary_target}</span>
              </div>
            </div>
            <span style={{ color: '#333' }}>→</span>
          </button>
        ))
      )}
    </div>
  );
}
