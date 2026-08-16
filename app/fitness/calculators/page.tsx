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

const MONO = "'IBM Plex Mono', monospace";
const lbl = {
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  color: '#888',
  margin: 0,
};
const border2 = '2px solid #444';

const inputStyle = {
  width: '100%',
  fontFamily: MONO,
  fontSize: '0.875rem',
  background: '#000',
  color: '#fff',
  border: border2,
  padding: '0.5rem 0.75rem',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const selectStyle = { ...inputStyle };

const btnPrimary = {
  width: '100%',
  padding: '0.6rem 1rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  background: '#fff',
  color: '#000',
  border: border2,
  cursor: 'pointer',
  fontFamily: MONO,
};

const btnSecondary = {
  ...btnPrimary,
  background: '#000',
  color: '#888',
  border: '2px solid #333',
};

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
    <div style={{ borderBottom: '1px solid #111', padding: '0.875rem 1rem' }}>
      <p style={{ ...lbl, marginBottom: '0.5rem' }}>{label}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{set.calories}</p>
          <p style={{ ...lbl, marginTop: '0.2rem' }}>kcal</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#4af' }}>{set.carbsG}g</p>
          <p style={{ ...lbl, marginTop: '0.2rem' }}>carbs</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fa4' }}>{set.fatG}g</p>
          <p style={{ ...lbl, marginTop: '0.2rem' }}>fat</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#4f8' }}>{set.proteinG}g</p>
          <p style={{ ...lbl, marginTop: '0.2rem' }}>protein</p>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ padding: '1rem', borderBottom: border2, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Unit toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {(['metric', 'imperial'] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              style={{ ...btnPrimary, background: unit === u ? '#fff' : '#000', color: unit === u ? '#000' : '#555', border: `2px solid ${unit === u ? '#fff' : '#333'}` }}>
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Sex */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {(['male', 'female'] as const).map(s => (
            <button key={s} onClick={() => setSex(s)}
              style={{ ...btnPrimary, background: sex === s ? '#fff' : '#000', color: sex === s ? '#000' : '#555', border: `2px solid ${sex === s ? '#fff' : '#333'}` }}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Age */}
        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>AGE</p>
          <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="30" min="10" max="120" style={inputStyle} />
        </div>

        {/* Weight */}
        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>WEIGHT ({unit === 'metric' ? 'KG' : 'LBS'})</p>
          {unit === 'metric'
            ? <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="75" style={inputStyle} />
            : <input type="number" value={weightLbs} onChange={e => setWeightLbs(e.target.value)} placeholder="165" style={inputStyle} />
          }
        </div>

        {/* Height */}
        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>HEIGHT ({unit === 'metric' ? 'CM' : 'FT / IN'})</p>
          {unit === 'metric'
            ? <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" style={inputStyle} />
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input type="number" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5 ft" style={inputStyle} />
                <input type="number" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="10 in" style={inputStyle} />
              </div>
          }
        </div>

        {/* Activity */}
        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>ACTIVITY LEVEL</p>
          <select value={activity} onChange={e => setActivity(e.target.value as ActivityLevel)} style={selectStyle}>
            <option value="sedentary">SEDENTARY — LITTLE / NO EXERCISE</option>
            <option value="light">LIGHT — 1–3 DAYS/WEEK</option>
            <option value="moderate">MODERATE — 3–5 DAYS/WEEK</option>
            <option value="active">ACTIVE — 6–7 DAYS/WEEK</option>
            <option value="very_active">VERY ACTIVE — HARD EXERCISE + PHYSICAL JOB</option>
          </select>
        </div>

        {/* Goal */}
        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>GOAL</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {(['lose', 'maintain', 'gain'] as const).map(g => (
              <button key={g} onClick={() => setGoal(g)}
                style={{ ...btnPrimary, background: goal === g ? '#fff' : '#000', color: goal === g ? '#000' : '#555', border: `2px solid ${goal === g ? '#fff' : '#333'}`, padding: '0.5rem' }}>
                {g.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {error && <p style={{ margin: 0, fontSize: '0.7rem', color: '#f44', letterSpacing: '0.05em' }}>{error}</p>}
        <button onClick={calculate} style={btnPrimary}>CALCULATE</button>
      </div>

      {result && (
        <div>
          {/* Summary */}
          <div style={{ padding: '0.875rem 1rem', borderBottom: border2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{result.bmr}</p>
              <p style={{ ...lbl, marginTop: '0.2rem' }}>BMR</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{result.tdee}</p>
              <p style={{ ...lbl, marginTop: '0.2rem' }}>TDEE</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{result.targetCalories}</p>
              <p style={{ ...lbl, marginTop: '0.2rem' }}>TARGET</p>
            </div>
          </div>

          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}><span style={lbl}>MACRO PRESETS</span></div>
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
    underweight: '#4af',
    normal: '#4f8',
    overweight: '#fa4',
    obese: '#f44',
  };

  return (
    <div>
      <div style={{ padding: '1rem', borderBottom: border2, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {(['metric', 'imperial'] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              style={{ ...btnPrimary, background: unit === u ? '#fff' : '#000', color: unit === u ? '#000' : '#555', border: `2px solid ${unit === u ? '#fff' : '#333'}` }}>
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>WEIGHT ({unit === 'metric' ? 'KG' : 'LBS'})</p>
          {unit === 'metric'
            ? <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="75" style={inputStyle} />
            : <input type="number" value={weightLbs} onChange={e => setWeightLbs(e.target.value)} placeholder="165" style={inputStyle} />
          }
        </div>

        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>HEIGHT ({unit === 'metric' ? 'CM' : 'FT / IN'})</p>
          {unit === 'metric'
            ? <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" style={inputStyle} />
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input type="number" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5 ft" style={inputStyle} />
                <input type="number" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="10 in" style={inputStyle} />
              </div>
          }
        </div>

        {error && <p style={{ margin: 0, fontSize: '0.7rem', color: '#f44', letterSpacing: '0.05em' }}>{error}</p>}
        <button onClick={calculate} style={btnPrimary}>CALCULATE</button>
      </div>

      {result && (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', borderBottom: border2 }}>
          <p style={{ margin: 0, fontSize: '3rem', fontWeight: 700, color: categoryColor[result.category] }}>{result.bmi}</p>
          <p style={{ ...lbl, marginTop: '0.5rem', color: categoryColor[result.category] }}>{result.category.toUpperCase()}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', marginTop: '1.5rem' }}>
            {(['underweight', 'normal', 'overweight', 'obese'] as const).map(cat => (
              <div key={cat} style={{ padding: '0.5rem 0.25rem', background: result.category === cat ? categoryColor[cat] : '#111' }}>
                <p style={{ margin: 0, fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em', color: result.category === cat ? '#000' : '#555' }}>
                  {cat.toUpperCase()}
                </p>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', marginTop: '0.25rem' }}>
            <p style={{ ...lbl, textAlign: 'center' }}>{'<'}18.5</p>
            <p style={{ ...lbl, textAlign: 'center' }}>18.5–24.9</p>
            <p style={{ ...lbl, textAlign: 'center' }}>25–29.9</p>
            <p style={{ ...lbl, textAlign: 'center' }}>≥30</p>
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
      <div style={{ padding: '1rem', borderBottom: border2, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {(['kg', 'lbs'] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              style={{ ...btnPrimary, background: unit === u ? '#fff' : '#000', color: unit === u ? '#000' : '#555', border: `2px solid ${unit === u ? '#fff' : '#333'}` }}>
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>WEIGHT LIFTED ({unit.toUpperCase()})</p>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'kg' ? '100' : '225'} style={inputStyle} />
        </div>

        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>REPS PERFORMED</p>
          <input type="number" value={reps} onChange={e => setReps(e.target.value)} placeholder="5" min="1" max="30" style={inputStyle} />
        </div>

        {error && <p style={{ margin: 0, fontSize: '0.7rem', color: '#f44', letterSpacing: '0.05em' }}>{error}</p>}
        <button onClick={calculate} style={btnPrimary}>CALCULATE</button>
      </div>

      {result && (
        <div>
          <div style={{ padding: '2rem 1rem', textAlign: 'center', borderBottom: border2 }}>
            <p style={{ ...lbl, marginBottom: '0.5rem' }}>ESTIMATED 1RM</p>
            <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: '#fff' }}>{fmt(result.oneRM)}</p>
          </div>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}><span style={lbl}>TRAINING LOADS</span></div>
          {([['90%', result.percentages.p90], ['85%', result.percentages.p85], ['80%', result.percentages.p80], ['75%', result.percentages.p75], ['70%', result.percentages.p70]] as [string, number][]).map(([pct, val]) => (
            <div key={pct} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
              <span style={{ ...lbl, color: '#555' }}>{pct} OF 1RM</span>
              <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>{fmt(val)}</span>
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
    essential: '#4af',
    athlete: '#4f8',
    fitness: '#8f4',
    average: '#fa4',
    obese: '#f44',
  };

  return (
    <div>
      <div style={{ padding: '1rem', borderBottom: border2, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p style={{ ...lbl, color: '#555', margin: 0 }}>US NAVY CIRCUMFERENCE METHOD — ALL MEASUREMENTS IN CM</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {(['male', 'female'] as const).map(s => (
            <button key={s} onClick={() => setSex(s)}
              style={{ ...btnPrimary, background: sex === s ? '#fff' : '#000', color: sex === s ? '#000' : '#555', border: `2px solid ${sex === s ? '#fff' : '#333'}` }}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.25rem' }}>HEIGHT (CM)</p>
            <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" style={inputStyle} />
          </div>
          <div>
            <p style={{ ...lbl, marginBottom: '0.25rem' }}>WEIGHT (KG)</p>
            <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="75" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: sex === 'female' ? 'repeat(3, 1fr)' : '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <p style={{ ...lbl, marginBottom: '0.25rem' }}>WAIST (CM)</p>
            <input type="number" value={waistCm} onChange={e => setWaistCm(e.target.value)} placeholder="85" style={inputStyle} />
          </div>
          <div>
            <p style={{ ...lbl, marginBottom: '0.25rem' }}>NECK (CM)</p>
            <input type="number" value={neckCm} onChange={e => setNeckCm(e.target.value)} placeholder="38" style={inputStyle} />
          </div>
          {sex === 'female' && (
            <div>
              <p style={{ ...lbl, marginBottom: '0.25rem' }}>HIPS (CM)</p>
              <input type="number" value={hipsCm} onChange={e => setHipsCm(e.target.value)} placeholder="95" style={inputStyle} />
            </div>
          )}
        </div>

        {error && <p style={{ margin: 0, fontSize: '0.7rem', color: '#f44', letterSpacing: '0.05em' }}>{error}</p>}
        <button onClick={calculate} style={btnPrimary}>CALCULATE</button>
      </div>

      {result && (
        <div>
          <div style={{ padding: '2rem 1rem', textAlign: 'center', borderBottom: border2 }}>
            <p style={{ margin: 0, fontSize: '3rem', fontWeight: 700, color: categoryColor[result.category] }}>{result.bodyFatPct}%</p>
            <p style={{ ...lbl, marginTop: '0.5rem', color: categoryColor[result.category] }}>{result.category.toUpperCase()}</p>
          </div>
          <div style={{ borderBottom: border2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #111' }}>
              <span style={lbl}>LEAN MASS</span>
              <span style={{ fontWeight: 700, color: '#4f8', fontSize: '0.875rem' }}>{result.leanMassKg} kg</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem' }}>
              <span style={lbl}>FAT MASS</span>
              <span style={{ fontWeight: 700, color: '#fa4', fontSize: '0.875rem' }}>{result.fatMassKg} kg</span>
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
    <div style={{ fontFamily: MONO }}>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: border2, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p style={{ ...lbl, marginBottom: '0.25rem' }}>FITNESS</p>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>CALCULATORS</h1>
        </div>
        <button onClick={() => router.push('/fitness')}
          style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.5rem 0.75rem', border: border2, background: '#000', color: '#fff', cursor: 'pointer', fontFamily: MONO }}>
          ← BACK
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: border2, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, minWidth: 'max-content', padding: '0.6rem 0.75rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'center', border: 'none', background: '#000', cursor: 'pointer', color: tab === t.key ? '#fff' : '#444', borderBottom: `2px solid ${tab === t.key ? '#fff' : '#444'}`, fontFamily: MONO }}>
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
