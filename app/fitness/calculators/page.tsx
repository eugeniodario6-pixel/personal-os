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
    <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 16px' }}>
      <p className="label" style={{ marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 510, color: 'var(--text)' }}>{set.calories}</p>
          <p className="label" style={{ marginTop: '0.2rem' }}>kcal</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 510, color: 'var(--color-pulse-green)' }}>{set.carbsG}g</p>
          <p className="label" style={{ marginTop: '0.2rem' }}>carbs</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 510, color: 'var(--accent)' }}>{set.fatG}g</p>
          <p className="label" style={{ marginTop: '0.2rem' }}>fat</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 510, color: 'var(--color-pulse-green)' }}>{set.proteinG}g</p>
          <p className="label" style={{ marginTop: '0.2rem' }}>protein</p>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Unit toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['metric', 'imperial'] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className={`btn ${unit === u ? 'btn-primary' : 'btn-ghost'}`}>
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Sex */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['male', 'female'] as const).map(s => (
            <button key={s} onClick={() => setSex(s)}
              className={`btn ${sex === s ? 'btn-primary' : 'btn-ghost'}`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Age */}
        <div>
          <p className="label" style={{ marginBottom: 4 }}>AGE</p>
          <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="30" min="10" max="120" />
        </div>

        {/* Weight */}
        <div>
          <p className="label" style={{ marginBottom: 4 }}>WEIGHT ({unit === 'metric' ? 'KG' : 'LBS'})</p>
          {unit === 'metric'
            ? <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="75" />
            : <input type="number" value={weightLbs} onChange={e => setWeightLbs(e.target.value)} placeholder="165" />
          }
        </div>

        {/* Height */}
        <div>
          <p className="label" style={{ marginBottom: 4 }}>HEIGHT ({unit === 'metric' ? 'CM' : 'FT / IN'})</p>
          {unit === 'metric'
            ? <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" />
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input type="number" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5 ft" />
                <input type="number" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="10 in" />
              </div>
          }
        </div>

        {/* Activity */}
        <div>
          <p className="label" style={{ marginBottom: 4 }}>ACTIVITY LEVEL</p>
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
          <p className="label" style={{ marginBottom: 4 }}>GOAL</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(['lose', 'maintain', 'gain'] as const).map(g => (
              <button key={g} onClick={() => setGoal(g)}
                className={`btn ${goal === g ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: 8 }}>
                {g.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {error && <p style={{ margin: 0, fontSize: 11, color: 'var(--color-coral-red)', letterSpacing: '-0.011em' }}>{error}</p>}
        <button onClick={calculate} className="btn btn-primary btn-block">CALCULATE</button>
      </div>

      {result && (
        <div>
          {/* Summary */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 510, color: 'var(--text)' }}>{result.bmr}</p>
              <p className="label" style={{ marginTop: '0.2rem' }}>BMR</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 510, color: 'var(--text)' }}>{result.tdee}</p>
              <p className="label" style={{ marginTop: '0.2rem' }}>TDEE</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 510, color: 'var(--text)' }}>{result.targetCalories}</p>
              <p className="label" style={{ marginTop: '0.2rem' }}>TARGET</p>
            </div>
          </div>

          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><span className="label">MACRO PRESETS</span></div>
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
    underweight: 'var(--color-pulse-green)',
    normal:      'var(--color-pulse-green)',
    overweight:  'var(--accent)',
    obese:       'var(--color-coral-red)',
  };

  return (
    <div>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['metric', 'imperial'] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className={`btn ${unit === u ? 'btn-primary' : 'btn-ghost'}`}>
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        <div>
          <p className="label" style={{ marginBottom: 4 }}>WEIGHT ({unit === 'metric' ? 'KG' : 'LBS'})</p>
          {unit === 'metric'
            ? <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="75" />
            : <input type="number" value={weightLbs} onChange={e => setWeightLbs(e.target.value)} placeholder="165" />
          }
        </div>

        <div>
          <p className="label" style={{ marginBottom: 4 }}>HEIGHT ({unit === 'metric' ? 'CM' : 'FT / IN'})</p>
          {unit === 'metric'
            ? <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" />
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input type="number" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5 ft" />
                <input type="number" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="10 in" />
              </div>
          }
        </div>

        {error && <p style={{ margin: 0, fontSize: 11, color: 'var(--color-coral-red)', letterSpacing: '-0.011em' }}>{error}</p>}
        <button onClick={calculate} className="btn btn-primary btn-block">CALCULATE</button>
      </div>

      {result && (
        <div style={{ padding: '32px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
          <p style={{ margin: 0, fontSize: 48, fontWeight: 510, color: categoryColor[result.category] }}>{result.bmi}</p>
          <p className="label" style={{ marginTop: 8, color: categoryColor[result.category] }}>{result.category.toUpperCase()}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: '1.5rem' }}>
            {(['underweight', 'normal', 'overweight', 'obese'] as const).map(cat => (
              <div key={cat} style={{ padding: '8px 4px', background: result.category === cat ? categoryColor[cat] : 'var(--surface)' }}>
                <p style={{ margin: 0, fontSize: '0.55rem', fontWeight: 510, letterSpacing: '0.01em', color: result.category === cat ? 'var(--bg)' : 'var(--text-ghost)' }}>
                  {cat.toUpperCase()}
                </p>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 4 }}>
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
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['kg', 'lbs'] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className={`btn ${unit === u ? 'btn-primary' : 'btn-ghost'}`}>
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        <div>
          <p className="label" style={{ marginBottom: 4 }}>WEIGHT LIFTED ({unit.toUpperCase()})</p>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={unit === 'kg' ? '100' : '225'} />
        </div>

        <div>
          <p className="label" style={{ marginBottom: 4 }}>REPS PERFORMED</p>
          <input type="number" value={reps} onChange={e => setReps(e.target.value)} placeholder="5" min="1" max="30" />
        </div>

        {error && <p style={{ margin: 0, fontSize: 11, color: 'var(--color-coral-red)', letterSpacing: '-0.011em' }}>{error}</p>}
        <button onClick={calculate} className="btn btn-primary btn-block">CALCULATE</button>
      </div>

      {result && (
        <div>
          <div style={{ padding: '32px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
            <p className="label" style={{ marginBottom: 8 }}>ESTIMATED 1RM</p>
            <p style={{ margin: 0, fontSize: 40, fontWeight: 510, color: 'var(--text)' }}>{fmt(result.oneRM)}</p>
          </div>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><span className="label">TRAINING LOADS</span></div>
          {([['90%', result.percentages.p90], ['85%', result.percentages.p85], ['80%', result.percentages.p80], ['75%', result.percentages.p75], ['70%', result.percentages.p70]] as [string, number][]).map(([pct, val]) => (
            <div key={pct} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span className="label" style={{ color: 'var(--text-ghost)' }}>{pct} OF 1RM</span>
              <span style={{ fontWeight: 510, color: 'var(--text)', fontSize: 14 }}>{fmt(val)}</span>
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
    essential: 'var(--color-pulse-green)',
    athlete:   'var(--color-pulse-green)',
    fitness:   'var(--accent)',
    average:   'var(--accent)',
    obese:     'var(--color-coral-red)',
  };

  return (
    <div>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p className="label" style={{ color: 'var(--text-ghost)', margin: 0 }}>US NAVY CIRCUMFERENCE METHOD — ALL MEASUREMENTS IN CM</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['male', 'female'] as const).map(s => (
            <button key={s} onClick={() => setSex(s)}
              className={`btn ${sex === s ? 'btn-primary' : 'btn-ghost'}`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <p className="label" style={{ marginBottom: 4 }}>HEIGHT (CM)</p>
            <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" />
          </div>
          <div>
            <p className="label" style={{ marginBottom: 4 }}>WEIGHT (KG)</p>
            <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="75" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: sex === 'female' ? 'repeat(3, 1fr)' : '1fr 1fr', gap: 8 }}>
          <div>
            <p className="label" style={{ marginBottom: 4 }}>WAIST (CM)</p>
            <input type="number" value={waistCm} onChange={e => setWaistCm(e.target.value)} placeholder="85" />
          </div>
          <div>
            <p className="label" style={{ marginBottom: 4 }}>NECK (CM)</p>
            <input type="number" value={neckCm} onChange={e => setNeckCm(e.target.value)} placeholder="38" />
          </div>
          {sex === 'female' && (
            <div>
              <p className="label" style={{ marginBottom: 4 }}>HIPS (CM)</p>
              <input type="number" value={hipsCm} onChange={e => setHipsCm(e.target.value)} placeholder="95" />
            </div>
          )}
        </div>

        {error && <p style={{ margin: 0, fontSize: 11, color: 'var(--color-coral-red)', letterSpacing: '-0.011em' }}>{error}</p>}
        <button onClick={calculate} className="btn btn-primary btn-block">CALCULATE</button>
      </div>

      {result && (
        <div>
          <div style={{ padding: '32px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
            <p style={{ margin: 0, fontSize: 48, fontWeight: 510, color: categoryColor[result.category] }}>{result.bodyFatPct}%</p>
            <p className="label" style={{ marginTop: 8, color: categoryColor[result.category] }}>{result.category.toUpperCase()}</p>
          </div>
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span className="label">LEAN MASS</span>
              <span style={{ fontWeight: 510, color: 'var(--color-pulse-green)', fontSize: 14 }}>{result.leanMassKg} kg</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
              <span className="label">FAT MASS</span>
              <span style={{ fontWeight: 510, color: 'var(--accent)', fontSize: 14 }}>{result.fatMassKg} kg</span>
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
    <div style={{ paddingTop: '4rem', paddingBottom: '5rem' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p className="label" style={{ marginBottom: 4 }}>FITNESS</p>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1.13, color: 'var(--text)' }}>Calculators</h1>
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
