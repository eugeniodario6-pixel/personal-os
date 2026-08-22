'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMealLogs, addFoodItem, addMealLog, deleteMealLog,
  getProfile, getRecentFoods,
  computeDailyScore, getDailyScore,
  todayISO,
  type FoodItem, type MealLog, type DailyScore, type Profile,
} from '@/lib/db';
import { ScoreRing } from '@/components/ScoreRing';
import { haptic } from '@/lib/haptic';
import { toast } from '@/components/Toast';
import { scoreFoodQuality, qualityLabel, type FoodQualityBreakdown } from '@/lib/foodQuality';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MealLogWithFood extends MealLog { food: FoodItem | null; }
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface FoodResult {
  id: string; name: string; brand: string; isGeneric: boolean;
  calories: number; protein: number; carbs: number; fat: number;
  serving_size: number; serving_unit: string;
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks',
};

function currentMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 19) return 'dinner';
  return 'snack';
}

async function searchFood(query: string): Promise<FoodResult[]> {
  const res = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return data.foods ?? [];
}

function calcTotals(logs: MealLogWithFood[]) {
  return logs.reduce((acc, l) => {
    if (!l.food) return acc;
    const r = l.quantity / l.food.serving_size;
    return {
      calories: acc.calories + l.food.calories * r,
      protein:  acc.protein  + l.food.protein  * r,
      carbs:    acc.carbs    + l.food.carbs    * r,
      fat:      acc.fat      + l.food.fat      * r,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ─── Macro Chart ──────────────────────────────────────────────────────────────
function MacroChart({ logs, profile }: { logs: MealLogWithFood[]; profile: Profile | null }) {
  const totals = calcTotals(logs);
  const ct  = profile?.calorie_target ?? 2000;
  const pt  = profile?.macro_targets?.protein ?? 150;
  const cbt = profile?.macro_targets?.carbs ?? 200;
  const ft  = profile?.macro_targets?.fat ?? 65;

  const macros = [
    { label: 'CAL',  val: Math.round(totals.calories), target: ct,  unit: 'kcal', pct: Math.min((totals.calories / ct) * 100, 100), over: totals.calories > ct },
    { label: 'PRO',  val: Math.round(totals.protein),  target: pt,  unit: 'g',    pct: Math.min((totals.protein  / pt) * 100, 100), over: totals.protein > pt },
    { label: 'CARB', val: Math.round(totals.carbs),    target: cbt, unit: 'g',    pct: Math.min((totals.carbs / cbt)   * 100, 100), over: totals.carbs > cbt },
    { label: 'FAT',  val: Math.round(totals.fat),      target: ft,  unit: 'g',    pct: Math.min((totals.fat / ft)     * 100, 100), over: totals.fat > ft },
  ];

  return (
    <div style={{
      margin: '20px 20px 0',
      background: 'var(--surface)',
      borderRadius: 'var(--r)',
      padding: '16px 20px',
      boxShadow: 'var(--ring)',
    }}>
      {macros.map((m, i) => (
        <div key={m.label} style={{ marginBottom: i < macros.length - 1 ? 14 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: '0.55rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              {m.label}
            </span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em', color: m.over ? 'var(--negative)' : 'var(--text-3)' }}>
              <span style={{ color: m.over ? 'var(--negative)' : 'var(--text)', fontWeight: 510 }}>{m.val}</span>
              <span style={{ color: 'var(--text-5)' }}> / {m.target}{m.unit === 'kcal' ? ' kcal' : 'g'}</span>
            </span>
          </div>
          {/* Bar track */}
          <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${m.pct}%`,
              background: m.over ? 'var(--negative)' : 'var(--text)',
              borderRadius: 2,
              transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Mini score bar ──────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
    </div>
  );
}

// ─── Quality breakdown panel ──────────────────────────────────────────────────
function QualityBreakdown({ breakdown }: { breakdown: FoodQualityBreakdown }) {
  const { proteinDensityScore, macroBalanceScore, wholeFoodScore, primaryDriver } = breakdown;
  const accentColor = '#1F58F2';
  const dimColor = 'rgba(255,255,255,0.35)';

  const rows = [
    { label: 'Protein density', value: proteinDensityScore, max: 40 },
    { label: 'Macro balance',   value: macroBalanceScore,   max: 30 },
    { label: 'Food type',       value: wholeFoodScore,      max: 30,
      suffix: wholeFoodScore === 30 ? '— Whole food ✓' : wholeFoodScore === 0 ? '— Processed ✗' : '— Neutral' },
  ];

  return (
    <div style={{
      margin: '8px 0 4px',
      padding: '10px 12px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 6,
    }}>
      {rows.map(row => {
        const barColor = row.value / row.max >= 0.75 ? accentColor : row.value / row.max >= 0.4 ? dimColor : 'rgba(255,80,80,0.7)';
        return (
          <div key={row.label} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: '0.5rem', color: 'var(--text-5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', width: 90, flexShrink: 0 }}>
                {row.label.toUpperCase()}
              </span>
              <MiniBar value={row.value} max={row.max} color={barColor} />
              <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: barColor, fontWeight: 510, flexShrink: 0, marginLeft: 4 }}>
                {row.value}/{row.max}
              </span>
              {'suffix' in row && row.suffix && (
                <span style={{ fontSize: '0.48rem', color: 'var(--text-5)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{row.suffix}</span>
              )}
            </div>
          </div>
        );
      })}
      <p style={{ margin: '6px 0 0', fontSize: '0.55rem', color: 'var(--text-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em', fontStyle: 'italic' }}>
        {primaryDriver}
      </p>
    </div>
  );
}

// ─── Log entry row ────────────────────────────────────────────────────────────
function LogEntry({ log, onDelete, expanded, onToggleExpand }: {
  log: MealLogWithFood;
  onDelete: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  if (!log.food) return null;
  const r = log.quantity / log.food.serving_size;
  const cal = Math.round(log.food.calories * r);
  const prot = Math.round(log.food.protein * r * 10) / 10;
  const breakdown = scoreFoodQuality(log.food);
  const { label: qLabel, color: qColor } = qualityLabel(breakdown.score);
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-2)', letterSpacing: '-0.011em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {log.food.name}
            </p>
            <button
              onClick={() => { haptic('light'); onToggleExpand(); }}
              style={{
                flexShrink: 0,
                fontSize: '0.5rem',
                fontWeight: 510,
                letterSpacing: '0.06em',
                fontFamily: 'var(--font-mono)',
                color: qColor,
                background: expanded ? `rgba(218,255,1,0.08)` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${qColor}`,
                borderRadius: 3,
                padding: '1px 4px',
                lineHeight: 1.6,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {qLabel.toUpperCase()} {expanded ? '▲' : '▼'}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--text-5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.01em' }}>
            {log.quantity}{log.food.serving_unit} · {prot}g PRO
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 510, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{cal}</span>
          <button onClick={() => { haptic('light'); onDelete(); }} style={{
            background: 'none', border: 'none', color: 'var(--text-5)', cursor: 'pointer',
            fontSize: 14, padding: '4px', lineHeight: 1,
          }}>✕</button>
        </div>
      </div>
      {expanded && <QualityBreakdown breakdown={breakdown} />}
    </div>
  );
}

// ─── Food picker row ──────────────────────────────────────────────────────────
function FoodRow({ food, onSelect }: { food: FoodItem | FoodResult; onSelect: () => void }) {
  return (
    <button onClick={() => { haptic('light'); onSelect(); }} style={{
      display: 'flex', width: '100%', alignItems: 'center',
      padding: '14px 0',
      background: 'transparent', border: 'none',
      borderBottom: '1px solid var(--border)',
      cursor: 'pointer', textAlign: 'left',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: '0.875rem', color: 'var(--text-2)', letterSpacing: '-0.011em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {food.name}
        </p>
        {'brand' in food && (food as FoodResult).brand && (
          <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>{(food as FoodResult).brand}</p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, flexShrink: 0, marginLeft: 12 }}>
        <span style={{ fontSize: '1rem', fontWeight: 510, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{food.calories}</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--text-5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>KCAL</span>
      </div>
    </button>
  );
}

// ─── Log panel ────────────────────────────────────────────────────────────────
function FoodLogPanel({ selected, onLog, onCancel }: {
  selected: FoodResult | FoodItem;
  onLog: (qty: number, mt: MealType) => void;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState('100');
  const [mealType, setMealType] = useState<MealType>(currentMealType());

  const qty = parseFloat(quantity) || 0;
  const ss = (selected as FoodItem).serving_size ?? 100;
  const r = qty / ss;
  const pCal  = Math.round(selected.calories * r);
  const pProt = Math.round(selected.protein  * r * 10) / 10;
  const pCarb = Math.round(selected.carbs    * r * 10) / 10;
  const pFat  = Math.round(selected.fat      * r * 10) / 10;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '20px', margin: '0 20px 16px', boxShadow: 'var(--ring)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 510, color: 'var(--text)', letterSpacing: '-0.011em', flex: 1, marginRight: 12 }}>
          {selected.name}
        </p>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}>✕</button>
      </div>

      {/* Meal type */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {MEAL_ORDER.map(mt => (
          <button key={mt} onClick={() => setMealType(mt)} style={{
            flex: 1, padding: '6px 4px', borderRadius: 'var(--r-sm)',
            border: 'none',
            background: mealType === mt ? 'var(--cta-bg)' : 'var(--surface-2)',
            color: mealType === mt ? 'var(--cta-fg)' : 'var(--text-4)',
            fontSize: '0.6rem', fontWeight: 510, letterSpacing: '0.01em',
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>
            {MEAL_LABELS[mt].slice(0,5).toUpperCase()}
          </button>
        ))}
      </div>

      {/* Qty */}
      <p style={{ margin: '0 0 6px', fontSize: '0.55rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>GRAMS</p>
      <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
        style={{
          width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border-2)',
          borderRadius: 'var(--r-sm)', padding: '0.6rem 0.75rem',
          color: 'var(--text)', fontSize: '1.5rem', fontWeight: 510, fontFamily: 'var(--font-mono)',
          textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: 8,
        }}
        autoFocus
      />

      {/* Quick qty */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['50','100','150','200'].map(q => (
          <button key={q} onClick={() => setQuantity(q)} style={{
            flex: 1, padding: '6px 0', borderRadius: 'var(--r-xs)', border: 'none',
            background: quantity === q ? 'var(--cta-bg)' : 'var(--surface-2)',
            color: quantity === q ? 'var(--cta-fg)' : 'var(--text-4)',
            fontSize: '0.7rem', fontWeight: 510, cursor: 'pointer',
          }}>{q}g</button>
        ))}
      </div>

      {/* Macro preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 16, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: '10px' }}>
        {[['KCAL', pCal],['PRO', `${pProt}g`],['CARB', `${pCarb}g`],['FAT', `${pFat}g`]].map(([l, v]) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 3px', fontSize: '0.45rem', letterSpacing: '0.08em', color: 'var(--text-5)', fontFamily: 'var(--font-mono)' }}>{l}</p>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 510, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{v}</p>
          </div>
        ))}
      </div>

      <button onClick={() => onLog(qty, mealType)} style={{
        width: '100%', background: 'var(--cta-bg)', color: 'var(--cta-fg)',
        border: 'none', borderRadius: 'var(--r)', padding: '0.875rem',
        fontSize: '0.75rem', letterSpacing: '0.08em', fontWeight: 510,
        cursor: 'pointer', fontFamily: 'var(--font)',
      }}>
        LOG TO {MEAL_LABELS[mealType].toUpperCase()} →
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function NutritionContent() {
  const [logs, setLogs]               = useState<MealLogWithFood[]>([]);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [selectedFood, setSelectedFood] = useState<FoodResult | FoodItem | null>(null);
  const [mode, setMode]               = useState<'idle' | 'recents' | 'search'>('idle');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  // Search
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const load = useCallback(async () => {
    const [rawLogs, prof, recents] = await Promise.all([
      getMealLogs(todayISO()), getProfile(), getRecentFoods(20),
    ]);
    setLogs(rawLogs); setProfile(prof); setRecentFoods(recents);
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = MEAL_ORDER.reduce((acc, mt) => {
    acc[mt] = logs.filter(l => l.meal_type === mt);
    return acc;
  }, {} as Record<MealType, MealLogWithFood[]>);

  const reloadAndScore = async () => {
    await load();
    await computeDailyScore(todayISO());
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setSearchError(''); setResults([]);
    try {
      const r = await searchFood(query.trim());
      if (r.length === 0) setSearchError('No results');
      setResults(r);
    } catch { setSearchError('Search failed'); }
    finally { setSearching(false); }
  };

  const handleLog = async (qty: number, mt: MealType) => {
    if (!selectedFood) return;
    haptic('medium');
    const asItem = selectedFood as FoodItem;
    if (typeof asItem.id === 'number' && !('isGeneric' in selectedFood)) {
      await addMealLog({ date: todayISO(), meal_type: mt, food_item_id: asItem.id, quantity: qty, logged_at: new Date().toISOString(), source: 'manual' });
    } else {
      const food = selectedFood as FoodResult;
      const foodId = await addFoodItem({
        external_id: null, name: food.name, brand: food.brand || null, barcode: null,
        serving_unit: food.serving_unit, serving_size: food.serving_size,
        calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, is_favorite: false,
      });
      await addMealLog({ date: todayISO(), meal_type: mt, food_item_id: foodId, quantity: qty, logged_at: new Date().toISOString(), source: 'search' });
    }
    toast(`${selectedFood.name} logged ✓`);
    setSelectedFood(null); setResults([]); setQuery(''); setMode('idle');
    await reloadAndScore();
  };

  const totals = calcTotals(logs);
  const target = profile?.calorie_target ?? 2000;
  const remaining = Math.max(target - Math.round(totals.calories), 0);
  const dateStr = new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();

  // Daily food quality score (weighted avg by calories)
  const logsWithFood = logs.filter(l => l.food);
  let dailyQualityScore = 0;
  let weakestLink: { name: string; score: number } | null = null;
  if (logsWithFood.length > 0) {
    let totalWeightedScore = 0;
    let totalCals = 0;
    let lowestScore = Infinity;
    for (const l of logsWithFood) {
      const food = l.food!;
      const r = l.quantity / food.serving_size;
      const cal = food.calories * r;
      const breakdown = scoreFoodQuality(food);
      totalWeightedScore += breakdown.score * Math.max(cal, 1);
      totalCals += Math.max(cal, 1);
      if (breakdown.score < lowestScore) {
        lowestScore = breakdown.score;
        weakestLink = { name: food.name, score: breakdown.score };
      }
    }
    dailyQualityScore = Math.round(totalWeightedScore / totalCals);
  }
  const { color: qualityColor } = qualityLabel(dailyQualityScore);

  // Eating window: first and last logged_at times
  const logsWithTime = logs.filter(l => l.logged_at);
  let eatingWindow = '';
  if (logsWithTime.length > 0) {
    const times = logsWithTime.map(l => new Date(l.logged_at).getTime()).sort((a, b) => a - b);
    const fmt = (ts: number) => new Date(ts).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
    const first = fmt(times[0]);
    const last = fmt(times[times.length - 1]);
    eatingWindow = times.length > 1 ? `${first} → ${last}` : first;
  }

  // Score
  const calorieTarget = profile?.calorie_target ?? 2000;
  const proteinTarget = profile?.macro_targets?.protein ?? 150;
  let calScore = 0;
  if (totals.calories > 0) {
    if (totals.calories >= calorieTarget * 0.85 && totals.calories <= calorieTarget * 1.1) calScore = 100;
    else if (totals.calories >= calorieTarget * 0.7) calScore = 70;
    else calScore = Math.min(100, (totals.calories / calorieTarget) * 100);
  }
  const nutritionScore = Math.round(calScore * 0.5 + Math.min(100, (totals.protein / proteinTarget) * 100) * 0.5);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '8rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
              EAT · {dateStr}
            </p>
            <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 10vw, 3rem)', fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', lineHeight: 1 }}>
              Fuel
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, paddingTop: 4 }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '0 0 2px', fontSize: '0.55rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>REMAINING</p>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 510, letterSpacing: '-0.022em', color: 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                {remaining > 0 ? remaining.toLocaleString() : '✓'}
              </p>
              {remaining > 0 && (
                <p style={{ margin: 0, fontSize: '0.5rem', color: 'var(--text-5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>KCAL LEFT</p>
              )}
            </div>
            <ScoreRing score={nutritionScore} />
          </div>
        </div>
      </div>

      {/* ── Quality + Eating window strip ── */}
      {logsWithFood.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          margin: '10px 20px 0',
          padding: '10px 16px',
          background: 'var(--surface)',
          borderRadius: 'var(--r)',
          boxShadow: 'var(--ring)',
        }}>
          {/* Quality score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.55rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>QUALITY</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 510, color: qualityColor, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {dailyQualityScore}<span style={{ fontSize: '0.55rem', color: 'var(--text-5)', fontWeight: 400 }}>/100</span>
            </span>
            <span style={{
              fontSize: '0.5rem', fontWeight: 510, letterSpacing: '0.06em',
              fontFamily: 'var(--font-mono)',
              color: qualityColor,
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${qualityColor}`,
              borderRadius: 3,
              padding: '1px 5px',
              lineHeight: 1.6,
              flexShrink: 0,
            }}>
              {qualityLabel(dailyQualityScore).label.toUpperCase()}
            </span>
            {weakestLink && weakestLink.score < dailyQualityScore && (
              <span style={{
                fontSize: '0.45rem', color: 'var(--text-5)', fontFamily: 'var(--font-mono)',
                letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                · ⚠️ {weakestLink.name.split(' ').slice(0,3).join(' ')} ({weakestLink.score}/100)
              </span>
            )}
          </div>
          {/* Eating window */}
          {eatingWindow && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: '0.55rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>WINDOW</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>{eatingWindow}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Macro chart ── */}
      <MacroChart logs={logs} profile={profile} />

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: 10, padding: '16px 20px 0' }}>
        <button onClick={() => { setMode(mode === 'recents' ? 'idle' : 'recents'); setSelectedFood(null); setResults([]); }} style={{
          flex: 1, padding: '0.75rem', borderRadius: 'var(--r)',
          background: mode === 'recents' ? 'var(--cta-bg)' : 'var(--surface)',
          color: mode === 'recents' ? 'var(--cta-fg)' : 'var(--text-3)',
          border: '1px solid var(--border-2)', cursor: 'pointer',
          fontSize: '0.7rem', letterSpacing: '0.06em', fontWeight: 510, fontFamily: 'var(--font)',
          boxShadow: 'var(--ring)',
        }}>
          + LOG
        </button>
        <button onClick={() => { setMode(mode === 'search' ? 'idle' : 'search'); setSelectedFood(null); setResults([]); }} style={{
          flex: 1, padding: '0.75rem', borderRadius: 'var(--r)',
          background: mode === 'search' ? 'var(--cta-bg)' : 'var(--surface)',
          color: mode === 'search' ? 'var(--cta-fg)' : 'var(--text-3)',
          border: '1px solid var(--border-2)', cursor: 'pointer',
          fontSize: '0.7rem', letterSpacing: '0.06em', fontWeight: 510, fontFamily: 'var(--font)',
          boxShadow: 'var(--ring)',
        }}>
          SEARCH
        </button>
      </div>

      {/* ── Log panel (selected food) ── */}
      {selectedFood && (
        <div style={{ marginTop: 16 }}>
          <FoodLogPanel selected={selectedFood} onLog={handleLog} onCancel={() => setSelectedFood(null)} />
        </div>
      )}

      {/* ── Recents drawer ── */}
      {mode === 'recents' && !selectedFood && (
        <div style={{ margin: '12px 20px 0', background: 'var(--surface)', borderRadius: 'var(--r)', padding: '0 16px', boxShadow: 'var(--ring)' }}>
          {recentFoods.length === 0 ? (
            <p style={{ padding: '24px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-4)' }}>No recent foods — search to add</p>
          ) : recentFoods.map(food => (
            <FoodRow key={food.id} food={food} onSelect={() => setSelectedFood(food)} />
          ))}
        </div>
      )}

      {/* ── Search drawer ── */}
      {mode === 'search' && !selectedFood && (
        <div style={{ margin: '12px 20px 0' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search food…" autoFocus
              style={{
                flex: 1, background: 'var(--surface)', border: '1px solid var(--border-2)',
                borderRadius: 'var(--r)', padding: '0.75rem 1rem',
                color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font)',
                outline: 'none',
              }}
            />
            <button onClick={doSearch} disabled={searching} style={{
              flexShrink: 0, padding: '0.75rem 1.25rem', borderRadius: 'var(--r)',
              background: 'var(--cta-bg)', color: 'var(--cta-fg)',
              border: 'none', fontSize: '0.7rem', fontWeight: 510, cursor: 'pointer',
              opacity: searching ? 0.5 : 1, letterSpacing: '0.06em',
            }}>
              {searching ? '…' : 'GO'}
            </button>
          </div>
          {searchError && <p style={{ fontSize: '0.8rem', color: 'var(--negative)', margin: '0 0 8px' }}>{searchError}</p>}
          {results.length > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '0 16px', boxShadow: 'var(--ring)' }}>
              {results.map((r, i) => <FoodRow key={i} food={r} onSelect={() => setSelectedFood(r)} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Meal sections ── */}
      <div style={{ padding: '24px 20px 0' }}>
        {MEAL_ORDER.map(mt => {
          const mealLogs = grouped[mt];
          const mealTotals = calcTotals(mealLogs);
          const mealCal = Math.round(mealTotals.calories);
          return (
            <div key={mt} style={{ marginBottom: 24 }}>
              {/* Meal header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
                  {MEAL_LABELS[mt].toUpperCase()}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {mealCal > 0 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
                      {mealCal} kcal
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setMode('recents');
                      setSelectedFood(null);
                    }}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border-2)',
                      borderRadius: 'var(--r-sm)', padding: '0.25rem 0.6rem',
                      fontSize: '0.55rem', letterSpacing: '0.06em', color: 'var(--text-4)',
                      cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 510,
                    }}
                  >
                    + ADD
                  </button>
                </div>
              </div>

              {/* Log entries */}
              {mealLogs.length > 0 ? (
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '0 16px', boxShadow: 'var(--ring)' }}>
                  {mealLogs.map(log => (
                    <LogEntry
                      key={log.id}
                      log={log}
                      expanded={expandedLogs.has(log.id)}
                      onToggleExpand={() => {
                        setExpandedLogs(prev => {
                          const next = new Set(prev);
                          if (next.has(log.id)) next.delete(log.id);
                          else next.add(log.id);
                          return next;
                        });
                      }}
                      onDelete={async () => {
                        await deleteMealLog(log.id);
                        toast('Removed', 'info');
                        await reloadAndScore();
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{
                  background: 'var(--surface)', borderRadius: 'var(--r)',
                  padding: '16px', boxShadow: 'var(--ring)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.01em' }}>
                    NOTHING LOGGED
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>LOADING…</p>
      </div>
    }>
      <NutritionContent />
    </Suspense>
  );
}
