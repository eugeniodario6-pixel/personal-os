'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  calcMacros,
  calcBMI,
  calcOneRepMax,
  calcBodyFat,
  lbsToKg,
  feetInchesToCm,
  type MacroResult,
  type BMIResult,
  type OneRepMaxResult,
  type BodyFatResult,
  type Sex,
  type ActivityLevel,
  type Goal,
} from '@/lib/fitness-calculators';

type CalcTab = 'macros' | 'bmi' | 'onerm' | 'bodyfat';

// ─── Macro Calculator ────────────────────────────────────────────────────────

function MacroCalc() {
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [weightKg, setWeightKg] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<Goal>('maintain');
  const [result, setResult] = useState<MacroResult | null>(null);
  const [error, setError] = useState('');

  const calculate = () => {
    setError('');
    const ageN = parseInt(age);
    const kg = unit === 'metric' ? parseFloat(weightKg) : lbsToKg(parseFloat(weightLbs));
    const cm = unit === 'metric' ? parseFloat(heightCm) : feetInchesToCm(parseInt(heightFt) || 0, parseInt(heightIn) || 0);

    if (!ageN || !kg || !cm || ageN < 10 || ageN > 120 || kg < 20 || cm < 100) {
      setError('PLEASE FILL IN ALL FIELDS WITH VALID VALUES.');
      return;
    }

    setResult(calcMacros({ sex, age: ageN, heightCm: cm, weightKg: kg, activity, goal }));
  };

  const MacroRow = ({ label, set }: { label: string; set: ReturnType<typeof calcMacros>['standard'] }) => (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '0.875rem 1rem' }}>
      <p className="label" style={{ marginBottom: '0.5rem' }}>{label}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{set.calories}</p>
          <p className="label" style={{ marginTop: '0.2rem' }}>kcal</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--positive)' }}>{set.carbsG}g</p>
          <p className="label" style={{ marginTop: '0.2rem' }}>carbs</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>{set.fatG}g</p>
          <p className="label" style={{ marginTop: '0.2rem' }}>fat</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--positive)' }}>{set.proteinG}g</p>
          <p className="label" style={{ marginTop: '0.2rem' }}>protein</p>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ padding: '1rem', borderBottom: '2px solid var(--border-strong)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Unit toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {(['metric', 'imperial'] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className={`btn ${unit === u ? 'btn-primary' : 'btn-ghost'}`}>
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Sex */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {(['male', 'female'] as const).map(s => (
            <button key={s} onClick={() => setSex(s)}
              className={`btn ${sex === s ? 'btn-primary' : 'btn-ghost'}`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Age */}
        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>AGE</p>
          <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="30" min="10" max="120" />
        </div>

        {/* Weight */}
        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>WEIGHT ({unit === 'metric' ? 'KG' : 'LBS'})</p>
          {unit === 'metric'
            ? <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="75" />
            : <input type="number" value={weightLbs} onChange={e => setWeightLbs(e.target.value)} placeholder="165" />
          }
        </div>

        {/* Height */}
        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>HEIGHT ({unit === 'metric' ? 'CM' : 'FT / IN'})</p>
          {unit === 'metric'
            ? <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" />
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input type="number" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5 ft" />
                <input type="number" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="10 in" />
              </div>
          }
        </div>

        {/* Activity */}
        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>ACTIVITY LEVEL</p>
          <select value={activity} onChange={e => setActivity(e.target.value as ActivityLevel)}>
            <option value="sedentary">SEDENTARY — LITTLE / NO EXERCISE</option>
            <option value="light">LIGHT — 1–3 DAYS/WEEK</option>
            <option value="moderate">MODERATE — 3–5 DAYS/WEEK</option>
            <option value="active">ACTIVE — 6–7 DAYS/WEEK</option>
            <option value="very_active">VERY ACTIVE — HARD EXERCISE + PHYSICAL JOB</option>
          </select>
        </div>

        {/* Goal */}
        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>GOAL</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {(['lose', 'maintain', 'gain'] as const).map(g => (
              <button key={g} onClick={() => setGoal(g)}
                className={`btn ${goal === g ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.5rem' }}>
                {g.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {error && <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--negative)', letterSpacing: '0.05em' }}>{error}</p>}
        <button onClick={calculate} className="btn btn-primary btn-block">CALCULATE</button>
      </div>

      {result && (
        <div>
          {/* Summary */}
          <div style={{ padding: '0.875rem 1rem', borderBottom: '2px solid var(--border-strong)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>{result.bmr}</p>
              <p className="label" style={{ marginTop: '0.2rem' }}>BMR</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>{result.tdee}</p>
              <p className="label" style={{ marginTop: '0.2rem' }}>TDEE</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{result.targetCalories}</p>
              <p className="label" style={{ marginTop: '0.2rem' }}>TARGET</p>
            </div>
          </div>

          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}><span className="label">MACRO PRESETS</span></div>
          <MacroRow label="TAILORED" set={result.tailored} />
          <MacroRow label="STANDARD — 50 / 30 / 20" set={result.standard} />
          <MacroRow label="LOW CARB — 40 / 30 / 30" set={result.lowCarb} />
          <MacroRow label="HIGH PROTEIN — 44 / 30 / 26" set={result.highProtein} />
        </div>
      )}
    </div>
  );
}

// ─── BMI Calculator ───────────────────────────────────────────────────────────

function BMICalc() {
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [weightKg, setWeightKg] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [result, setResult] = useState<BMIResult | null>(null);
  const [error, setError] = useState('');

  const calculate = () => {
    setError('');
    const kg = unit === 'metric' ? parseFloat(weightKg) : lbsToKg(parseFloat(weightLbs));
    const cm = unit === 'metric' ? parseFloat(heightCm) : feetInchesToCm(parseInt(heightFt) || 0, parseInt(heightIn) || 0);
    if (!kg || !cm || kg < 20 || cm < 100) { setError('PLEASE ENTER VALID HEIGHT AND WEIGHT.'); return; }
    setResult(calcBMI(kg, cm));
  };

  const categoryColor: Record<string, string> = {
    underweight: 'var(--positive)',
    normal:      'var(--positive)',
    overweight:  'var(--accent)',
    obese:       'var(--negative)',
  };

  return (
    <div>
      <div style={{ padding: '1rem', borderBottom: '2px solid var(--border-strong)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {(['metric', 'imperial'] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className={`btn ${unit === u ? 'btn-primary' : 'btn-ghost'}`}>
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>WEIGHT ({unit === 'metric' ? 'KG' : 'LBS'})</p>
          {unit === 'metric'
            ? <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="75" />
            : <input type="number" value={weightLbs} onChange={e => setWeightLbs(e.target.value)} placeholder="165" />
          }
        </div>

        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>HEIGHT ({unit === 'metric' ? 'CM' : 'FT / IN'})</p>
          {unit === 'metric'
            ? <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" />
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input type="number" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5 ft" />
                <input type="number" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="10 in" />
              </div>
          }
        </div>

        {error && <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--negative)', letterSpacing: '0.05em' }}>{error}</p>}
        <button onClick={calculate} className="btn btn-primary btn-block">CALCULATE</button>
      </div>

      {result && (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', borderBottom: '2px solid var(--border-strong)' }}>
          <p style={{ margin: 0, fontSize: '3rem', fontWeight: 700, color: categoryColor[result.category] }}>{result.bmi}</p>
          <p className="label" style={{ marginTop: '0.5rem', color: categoryColor[result.category] }}>{result.category.toUpperCase()}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', marginTop: '1.5rem' }}>
            {(['underweight', 'normal', 'overweight', 'obese'] as const).map(cat => (
              <div key={cat} style={{ padding: '0.5rem 0.25rem', background: result.category === cat ? categoryColor[cat] : 'var(--surface)' }}>
                <p style={{ margin: 0, fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em', color: result.category === cat ? 'var(--bg)' : 'var(--text-ghost)' }}>
                  {cat.toUpperCase()}
                </p>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', marginTop: '0.25rem' }}>
            <p className="label" style={{ textAlign: 'center' }}>{'<'}18.5</p>
            <p className="label" style={{ textAlign: 'center' }}>18.5–24.9</p>
            <p className="label" style={{ textAlign: 'center' }}>25–29.9</p>
            <p className="label" style={{ textAlign: 'center' }}>≥30</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── One-Rep Max ──────────────────────────────────────────────────────────────

function OneRMCalc() {
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [result, setResult] = useState<OneRepMaxResult | null>(null);
  const [error, setError] = useState('');

  const calculate = () => {
    setError('');
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (!w || !r || w <= 0 || r < 1) { setError('ENTER VALID WEIGHT AND REPS (≥1).'); return; }
    const kg = unit === 'lbs' ? lbsToKg(w) : w;
    setResult(calcOneRepMax(kg, r));
  };

  const fmt = (kg: number) => unit === 'lbs' ? `${Math.round(kg * 2.20462)} lbs` : `${kg} kg`;

  return (
    <div>
      <div style={{ padding: '1rem', borderBottom: '2px solid var(--border-strong)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {(['kg', 'lbs'] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className={`btn ${unit === u ? 'btn-primary' : 'btn-ghost'}`}>
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>WEIGHT LIFTED ({unit.toUpperCase()})</p>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'kg' ? '100' : '225'} />
        </div>

        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>REPS PERFORMED</p>
          <input type="number" value={reps} onChange={e => setReps(e.target.value)} placeholder="5" min="1" max="30" />
        </div>

        {error && <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--negative)', letterSpacing: '0.05em' }}>{error}</p>}
        <button onClick={calculate} className="btn btn-primary btn-block">CALCULATE</button>
      </div>

      {result && (
        <div>
          <div style={{ padding: '2rem 1rem', textAlign: 'center', borderBottom: '2px solid var(--border-strong)' }}>
            <p className="label" style={{ marginBottom: '0.5rem' }}>ESTIMATED 1RM</p>
            <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: 'var(--text)' }}>{fmt(result.oneRM)}</p>
          </div>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}><span className="label">TRAINING LOADS</span></div>
          {([['90%', result.percentages.p90], ['85%', result.percentages.p85], ['80%', result.percentages.p80], ['75%', result.percentages.p75], ['70%', result.percentages.p70]] as [string, number][]).map(([pct, val]) => (
            <div key={pct} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <span className="label" style={{ color: 'var(--text-ghost)' }}>{pct} OF 1RM</span>
              <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.875rem' }}>{fmt(val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Body Fat ─────────────────────────────────────────────────────────────────

function BodyFatCalc() {
  const [sex, setSex] = useState<Sex>('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [neckCm, setNeckCm] = useState('');
  const [hipsCm, setHipsCm] = useState('');
  const [result, setResult] = useState<BodyFatResult | null>(null);
  const [error, setError] = useState('');

  const calculate = () => {
    setError('');
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    const waist = parseFloat(waistCm);
    const neck = parseFloat(neckCm);
    const hips = parseFloat(hipsCm);

    if (!h || !w || !waist || !neck || h < 100 || w < 20) { setError('PLEASE FILL ALL FIELDS.'); return; }
    if (sex === 'female' && !hips) { setError('HIPS MEASUREMENT REQUIRED FOR FEMALE.'); return; }

    setResult(calcBodyFat(
      { sex, heightCm: h, waistCm: waist, neckCm: neck, hipsCm: sex === 'female' ? hips : undefined },
      w,
    ));
  };

  const categoryColor: Record<string, string> = {
    essential: 'var(--positive)',
    athlete:   'var(--positive)',
    fitness:   'var(--accent)',
    average:   'var(--accent)',
    obese:     'var(--negative)',
  };

  return (
    <div>
      <div style={{ padding: '1rem', borderBottom: '2px solid var(--border-strong)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p className="label" style={{ color: 'var(--text-ghost)', margin: 0 }}>US NAVY CIRCUMFERENCE METHOD — ALL MEASUREMENTS IN CM</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {(['male', 'female'] as const).map(s => (
            <button key={s} onClick={() => setSex(s)}
              className={`btn ${sex === s ? 'btn-primary' : 'btn-ghost'}`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.25rem' }}>HEIGHT (CM)</p>
            <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" />
          </div>
          <div>
            <p className="label" style={{ marginBottom: '0.25rem' }}>WEIGHT (KG)</p>
            <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="75" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: sex === 'female' ? 'repeat(3, 1fr)' : '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <p className="label" style={{ marginBottom: '0.25rem' }}>WAIST (CM)</p>
            <input type="number" value={waistCm} onChange={e => setWaistCm(e.target.value)} placeholder="85" />
          </div>
          <div>
            <p className="label" style={{ marginBottom: '0.25rem' }}>NECK (CM)</p>
            <input type="number" value={neckCm} onChange={e => setNeckCm(e.target.value)} placeholder="38" />
          </div>
          {sex === 'female' && (
            <div>
              <p className="label" style={{ marginBottom: '0.25rem' }}>HIPS (CM)</p>
              <input type="number" value={hipsCm} onChange={e => setHipsCm(e.target.value)} placeholder="95" />
            </div>
          )}
        </div>

        {error && <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--negative)', letterSpacing: '0.05em' }}>{error}</p>}
        <button onClick={calculate} className="btn btn-primary btn-block">CALCULATE</button>
      </div>

      {result && (
        <div>
          <div style={{ padding: '2rem 1rem', textAlign: 'center', borderBottom: '2px solid var(--border-strong)' }}>
            <p style={{ margin: 0, fontSize: '3rem', fontWeight: 700, color: categoryColor[result.category] }}>{result.bodyFatPct}%</p>
            <p className="label" style={{ marginTop: '0.5rem', color: categoryColor[result.category] }}>{result.category.toUpperCase()}</p>
          </div>
          <div style={{ borderBottom: '2px solid var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <span className="label">LEAN MASS</span>
              <span style={{ fontWeight: 700, color: 'var(--positive)', fontSize: '0.875rem' }}>{result.leanMassKg} kg</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem' }}>
              <span className="label">FAT MASS</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.875rem' }}>{result.fatMassKg} kg</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { key: CalcTab; label: string }[] = [
  { key: 'macros', label: 'MACROS' },
  { key: 'bmi', label: 'BMI' },
  { key: 'onerm', label: '1RM' },
  { key: 'bodyfat', label: 'BODY FAT' },
];

export default function CalculatorsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<CalcTab>('macros');

  return (
    <div style={{ fontFamily: 'var(--font-mono)' }}>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '2px solid var(--border-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p className="label" style={{ marginBottom: '0.25rem' }}>FITNESS</p>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>CALCULATORS</h1>
        </div>
        <button onClick={() => router.push('/fitness')}
          className="btn btn-outline btn-sm">
          ← BACK
        </button>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`tab ${tab === t.key ? 'active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Calculator content */}
      {tab === 'macros' && <MacroCalc />}
      {tab === 'bmi' && <BMICalc />}
      {tab === 'onerm' && <OneRMCalc />}
      {tab === 'bodyfat' && <BodyFatCalc />}
    </div>
  );
}
