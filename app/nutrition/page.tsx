'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getMealLogs, addFoodItem, addMealLog, deleteMealLog,
  getProfile, getRecentFoods,
  computeDailyScore, getDailyScore, getDailyScores,
  getGroceryItems, addGroceryItem, toggleGroceryItem, clearPurchasedGroceries,
  currentWeekOf, todayISO,
  type FoodItem, type MealLog, type DailyScore, type GroceryItem, type Profile,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';
import { toast } from '@/components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MealLogWithFood extends MealLog { food: FoodItem | null; }
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type MainTab = 'log' | 'trends' | 'grocery';
type LogMode = 'recents' | 'search';
type TrendsTab = 'day' | 'week' | 'year';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Sticky macro bar ─────────────────────────────────────────────────────────
function MacroBar({ logs, profile }: { logs: MealLogWithFood[]; profile: Profile | null }) {
  const totals = calcTotals(logs);
  const ct  = profile?.calorie_target ?? 2000;
  const pt  = profile?.macro_targets?.protein ?? 150;
  const cbt = profile?.macro_targets?.carbs ?? 200;
  const ft  = profile?.macro_targets?.fat ?? 65;

  const calPct  = Math.min((totals.calories / ct)  * 100, 100);
  const protPct = Math.min((totals.protein  / pt)  * 100, 100);
  const carbPct = Math.min((totals.carbs    / cbt) * 100, 100);
  const fatPct  = Math.min((totals.fat      / ft)  * 100, 100);

  const over = totals.calories > ct;

  const macros = [
    { label: 'Calories', val: Math.round(totals.calories), target: ct,  unit: 'kcal', pct: calPct,  over: over },
    { label: 'Protein',  val: Math.round(totals.protein),  target: pt,  unit: 'g',    pct: protPct, over: totals.protein > pt },
    { label: 'Carbs',    val: Math.round(totals.carbs),    target: cbt, unit: 'g',    pct: carbPct, over: totals.carbs > cbt },
    { label: 'Fat',      val: Math.round(totals.fat),      target: ft,  unit: 'g',    pct: fatPct,  over: totals.fat > ft },
  ];

  return (
    <div style={{
      background: 'var(--color-carbon)',
      boxShadow: 'var(--shadow-card)',
      padding: '14px 16px',
    }}>
      {macros.map(m => (
        <div key={m.label} style={{ marginBottom: m.label === 'Fat' ? 0 : 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
            <span className="label">{m.label}</span>
            <span style={{ fontSize: 13, letterSpacing: '-0.011em', color: m.over ? 'var(--color-coral-red)' : 'var(--text-3)' }}>
              <span style={{ fontWeight: 510, color: m.over ? 'var(--color-coral-red)' : 'var(--text)' }}>{m.val}</span>
              {' / '}{m.target} {m.unit}
            </span>
          </div>
          <div className="progress" style={{ height: 3 }}>
            <div
              className="progress-fill"
              style={{
                width: `${m.pct}%`,
                background: m.over ? 'var(--color-coral-red)' : m.pct >= 90 ? 'var(--accent)' : 'var(--text)',
                transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Log panel (bottom sheet style inline) ────────────────────────────────────
function FoodLogPanel({
  selected, onLog, onCancel,
}: {
  selected: FoodResult | FoodItem;
  onLog: (qty: number, mt: MealType) => void;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState('100');
  const [mealType, setMealType] = useState<MealType>(currentMealType());
  const prevQty = useRef('100');

  const qty = parseFloat(quantity) || 0;
  const ss  = (selected as FoodItem).serving_size ?? 100;
  const r   = qty / ss;

  const pCal  = Math.round(selected.calories * r);
  const pProt = Math.round(selected.protein  * r * 10) / 10;
  const pCarb = Math.round(selected.carbs    * r * 10) / 10;
  const pFat  = Math.round(selected.fat      * r * 10) / 10;

  const handleQtyChange = (val: string) => { prevQty.current = val; setQuantity(val); };

  return (
    <div style={{
      margin: '0 0 1px',
      background: 'var(--color-obsidian)',
      borderBottom: '1px solid var(--border)',
      animation: 'panel-in 0.18s ease',
    }}>
      <style>{`@keyframes panel-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Food name + back */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 16px 10px' }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
          <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected.name}
          </p>
          {'brand' in selected && (selected as FoodResult).brand && (
            <p className="label" style={{ margin: 0 }}>{(selected as FoodResult).brand}</p>
          )}
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}>✕</button>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        {/* Meal type pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {MEAL_ORDER.map(mt => (
            <button
              key={mt}
              onClick={() => setMealType(mt)}
              style={{
                flex: '0 0 auto', padding: '4px 12px', borderRadius: 9999,
                border: `1px solid ${mealType === mt ? 'var(--accent)' : 'var(--border)'}`,
                background: mealType === mt ? 'rgba(228,242,34,0.08)' : 'transparent',
                color: mealType === mt ? 'var(--accent)' : 'var(--text-3)',
                fontSize: 12, fontWeight: 400, letterSpacing: '-0.01em', cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent', transition: 'all 0.15s',
              }}
            >
              {MEAL_LABELS[mt]}
            </button>
          ))}
        </div>

        {/* Grams input */}
        <p className="label" style={{ marginBottom: 6 }}>Grams</p>
        <input
          type="number"
          value={quantity}
          onChange={e => handleQtyChange(e.target.value)}
          style={{ fontSize: 28, fontWeight: 510, letterSpacing: '-0.022em', textAlign: 'center', marginBottom: 8 }}
          autoFocus
        />

        {/* Quick qty */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {['50','100','150','200'].map(q => (
            <button
              key={q}
              onClick={() => handleQtyChange(q)}
              className={quantity === q ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              style={{ flex: 1 }}
            >
              {q}g
            </button>
          ))}
        </div>

        {/* Macro preview */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8,
          background: 'var(--color-graphite)',
          borderRadius: 8, padding: '10px 12px', marginBottom: 14,
        }}>
          {[
            { l: 'kcal', v: pCal },
            { l: 'pro',  v: `${pProt}g` },
            { l: 'carb', v: `${pCarb}g` },
            { l: 'fat',  v: `${pFat}g` },
          ].map(({ l, v }) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <p className="label" style={{ marginBottom: 3 }}>{l}</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--accent)' }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Log button */}
        <button
          className="btn btn-primary btn-block"
          onClick={() => onLog(qty, mealType)}
        >
          Log to {MEAL_LABELS[mealType]} →
        </button>
      </div>
    </div>
  );
}

// ─── Food row ─────────────────────────────────────────────────────────────────
function FoodRow({ food, onSelect }: { food: FoodItem | FoodResult; onSelect: () => void }) {
  const name = food.name;
  const brand = 'brand' in food ? food.brand : null;
  const cal = food.calories;

  return (
    <button
      onClick={() => { haptic('light'); onSelect(); }}
      style={{
        display: 'flex', width: '100%', alignItems: 'center',
        padding: '13px 16px',
        background: 'transparent', border: 'none',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer', textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 400, letterSpacing: '-0.011em', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </p>
        {brand && <p className="label" style={{ margin: 0 }}>{brand}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0, marginLeft: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--accent)' }}>{cal}</span>
        <span className="label">kcal</span>
      </div>
    </button>
  );
}

// ─── Meal group in log ─────────────────────────────────────────────────────────
function MealGroup({ type, logs, onDelete }: {
  type: MealType; logs: MealLogWithFood[]; onDelete: (id: number) => void;
}) {
  const totals = calcTotals(logs);
  const cal = Math.round(totals.calories);
  const prot = Math.round(totals.protein * 10) / 10;
  if (logs.length === 0) return null;

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Meal header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px',
        background: 'var(--color-obsidian)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 510, letterSpacing: '0.01em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          {MEAL_LABELS[type]}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--accent)', letterSpacing: '-0.01em', fontWeight: 510 }}>{cal} kcal</span>
          <span style={{ fontSize: 12, color: 'var(--text-4)', letterSpacing: '-0.01em' }}>{prot}g protein</span>
        </div>
      </div>

      {/* Log entries */}
      {logs.map(log => {
        if (!log.food) return null;
        const r = log.quantity / log.food.serving_size;
        const logCal  = Math.round(log.food.calories * r);
        const logProt = Math.round(log.food.protein  * r * 10) / 10;
        return (
          <div
            key={log.id}
            style={{
              display: 'flex', alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 400, letterSpacing: '-0.011em', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {log.food.name}
              </p>
              <p className="label" style={{ margin: 0 }}>
                {log.quantity}{log.food.serving_unit} · {logProt}g protein
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text-2)' }}>
                {logCal}
              </span>
              <button
                onClick={() => { haptic('light'); onDelete(log.id); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 14, padding: '4px 2px', lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Week grid ────────────────────────────────────────────────────────────────
function WeekGrid({ scores }: { scores: DailyScore[] }) {
  const today = todayISO();
  const DAY_LABELS = ['M','T','W','T','F','S','S'];
  const weekDays: string[] = [];
  const d = new Date();
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  for (let i = 0; i < 7; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + offset + i);
    weekDays.push(day.toISOString().slice(0, 10));
  }
  const scoreMap = new Map(scores.map(s => [s.date, s.total_score]));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
      {weekDays.map((date, i) => {
        const score = scoreMap.get(date) ?? null;
        const isToday = date === today;
        return (
          <div key={date} style={{
            padding: '14px 4px', textAlign: 'center',
            borderRight: i < 6 ? '1px solid var(--border)' : 'none',
            background: isToday ? 'rgba(228,242,34,0.05)' : 'transparent',
            borderBottom: isToday ? '2px solid var(--accent)' : '2px solid transparent',
          }}>
            <p className="label" style={{ marginBottom: 8 }}>{DAY_LABELS[i]}</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: score !== null ? (score >= 75 ? 'var(--accent)' : 'var(--text-2)') : 'var(--text-4)' }}>
              {score !== null ? score : '—'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Year grid ────────────────────────────────────────────────────────────────
function YearGrid({ scores }: { scores: DailyScore[] }) {
  const scoreMap = new Map(scores.map(s => [s.date, s.total_score]));
  const sorted = [...scores].sort((a,b) => a.date.localeCompare(b.date));
  let threshold = 75;
  if (sorted.length >= 14) {
    const last30 = sorted.slice(-30);
    threshold = Math.round(last30.reduce((s,x) => s + x.total_score, 0) / last30.length);
  }
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  const startDay = new Date(today);
  const dow = startDay.getDay();
  startDay.setDate(startDay.getDate() - (dow === 0 ? 6 : dow - 1) - 51 * 7);
  const weeks: string[][] = [];
  let cur = new Date(startDay);
  for (let w = 0; w < 52; w++) {
    const week: string[] = [];
    for (let dd = 0; dd < 7; dd++) { week.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1); }
    weeks.push(week);
  }

  return (
    <div style={{ padding: '16px', overflowX: 'auto' }}>
      <p className="label" style={{ marginBottom: 12 }}>Past 52 weeks · threshold {threshold}</p>
      <div style={{ display: 'flex', gap: 3 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {week.map(date => {
              const score = scoreMap.get(date) ?? null;
              const isFuture = date > todayStr;
              const isAbove = score !== null && score >= threshold;
              return (
                <div key={date} title={score !== null ? `${date}: ${score}` : date} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: isFuture ? 'transparent' : score === null ? 'var(--color-graphite)' : isAbove ? 'var(--accent)' : 'var(--color-smoke)',
                  border: date === todayStr ? '1px solid var(--accent)' : 'none',
                }} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Grocery tab ──────────────────────────────────────────────────────────────
function GroceryTab() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newGrams, setNewGrams] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => { setItems(await getGroceryItems()); }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true); haptic('light');
    await addGroceryItem(newName.trim(), newGrams ? parseFloat(newGrams) : null);
    setNewName(''); setNewGrams('');
    await load(); setAdding(false);
  };

  const handleToggle = async (id: number) => { haptic('light'); await toggleGroceryItem(id); await load(); };
  const handleClear = async () => { haptic('medium'); await clearPurchasedGroceries(); await load(); };
  const hasPurchased = items.some(i => i.purchased);

  return (
    <div>
      {/* Add row */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 2 }}>
          <p className="label" style={{ marginBottom: 6 }}>Item</p>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="Chicken breast" />
        </div>
        <div style={{ flex: 1 }}>
          <p className="label" style={{ marginBottom: 6 }}>Grams</p>
          <input type="number" value={newGrams} onChange={e => setNewGrams(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="500" />
        </div>
        <button className="btn btn-primary" onClick={handleAdd} disabled={adding || !newName.trim()} style={{ flexShrink: 0 }}>Add</button>
      </div>

      {/* Week header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--color-obsidian)' }}>
        <p className="label" style={{ margin: 0 }}>Week of {currentWeekOf()}</p>
        <p className="label" style={{ margin: 0 }}>{items.length} items</p>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-4)', letterSpacing: '-0.011em' }}>Nothing this week</p>
        </div>
      ) : items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => handleToggle(item.id)}
            style={{
              width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginRight: 12,
              border: `1px solid ${item.purchased ? 'var(--color-pulse-green)' : 'var(--border-2)'}`,
              background: item.purchased ? 'var(--color-pulse-green)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              color: 'var(--color-void)', fontSize: 11, fontWeight: 510,
            }}
          >
            {item.purchased ? '✓' : ''}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 2px', fontSize: 14, letterSpacing: '-0.011em', color: item.purchased ? 'var(--text-4)' : 'var(--text-2)', textDecoration: item.purchased ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.name}
            </p>
            {item.quantity_grams && <p className="label" style={{ margin: 0 }}>{item.quantity_grams}g</p>}
          </div>
          <button onClick={async () => { haptic('light'); await toggleGroceryItem(item.id); await load(); }} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 14, padding: '4px 6px', lineHeight: 1 }}>✕</button>
        </div>
      ))}

      {hasPurchased && (
        <div style={{ padding: 16 }}>
          <button className="btn btn-outline btn-block" onClick={handleClear}>Clear purchased</button>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function NutritionContent() {
  useSearchParams();

  const [mainTab, setMainTab]     = useState<MainTab>('log');
  const [logMode, setLogMode]     = useState<LogMode>('recents');
  const [trendsTab, setTrendsTab] = useState<TrendsTab>('week');

  const [logs, setLogs]               = useState<MealLogWithFood[]>([]);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [todayScore, setTodayScore]   = useState<DailyScore | null>(null);
  const [allScores, setAllScores]     = useState<DailyScore[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodResult | FoodItem | null>(null);

  // Search
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<FoodResult[]>([]);
  const [searching, setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');

  const load = useCallback(async () => {
    const [rawLogs, prof, recents, score, scores] = await Promise.all([
      getMealLogs(todayISO()), getProfile(), getRecentFoods(12),
      getDailyScore(todayISO()), getDailyScores(400),
    ]);
    setLogs(rawLogs); setProfile(prof); setRecentFoods(recents);
    setTodayScore(score); setAllScores(scores);
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = MEAL_ORDER.reduce((acc, mt) => {
    acc[mt] = logs.filter(l => l.meal_type === mt);
    return acc;
  }, {} as Record<MealType, MealLogWithFood[]>);

  const reloadAndScore = async () => {
    await load();
    const score = await computeDailyScore(todayISO());
    setTodayScore(score);
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setSearchError(''); setResults([]); setSelectedFood(null);
    try {
      const r = await searchFood(query.trim());
      if (r.length === 0) setSearchError('No results found');
      setResults(r);
    } catch { setSearchError('Search failed — check connection'); }
    finally { setSearching(false); }
  };

  const logFoodItem = async (food: FoodItem, qty: number, mt: MealType) => {
    haptic('medium');
    await addMealLog({ date: todayISO(), meal_type: mt, food_item_id: food.id, quantity: qty, logged_at: new Date().toISOString(), source: 'search' });
    toast(`${food.name} logged ✓`);
    setSelectedFood(null); setResults([]); setQuery('');
    await reloadAndScore();
  };

  const logFoodResult = async (food: FoodResult, qty: number, mt: MealType) => {
    haptic('medium');
    const foodId = await addFoodItem({
      external_id: null, name: food.name, brand: food.brand || null,
      barcode: null, serving_unit: food.serving_unit, serving_size: food.serving_size,
      calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, is_favorite: false,
    });
    await addMealLog({ date: todayISO(), meal_type: mt, food_item_id: foodId, quantity: qty, logged_at: new Date().toISOString(), source: 'search' });
    toast(`${food.name} logged ✓`);
    setSelectedFood(null); setResults([]); setQuery('');
    await reloadAndScore();
  };

  const handleLog = async (qty: number, mt: MealType) => {
    if (!selectedFood) return;
    const asItem = selectedFood as FoodItem;
    if (typeof asItem.id === 'number' && !('isGeneric' in selectedFood)) {
      await logFoodItem(asItem, qty, mt); return;
    }
    await logFoodResult(selectedFood as FoodResult, qty, mt);
  };

  const totalCal = Math.round(calcTotals(logs).calories);
  const target   = profile?.calorie_target ?? 2000;
  const remaining = Math.max(target - totalCal, 0);
  const dateStr  = new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '5rem' }}>

      {/* ── Header ── */}
      <div style={{ padding: '16px 16px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <p className="label" style={{ marginBottom: 4 }}>Eat · {dateStr}</p>
            <h1 style={{ fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1.13, color: 'var(--text)', margin: 0 }}>Fuel</h1>
          </div>
          {/* Remaining kcal callout */}
          <div style={{ textAlign: 'right' }}>
            <p className="label" style={{ marginBottom: 4 }}>Remaining</p>
            <p style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em', lineHeight: 1, margin: 0, color: remaining === 0 ? 'var(--accent)' : 'var(--text)' }}>
              {remaining === 0 ? '✓' : remaining.toLocaleString()}
            </p>
            {remaining > 0 && <p className="label" style={{ margin: 0 }}>kcal left</p>}
          </div>
        </div>

        {/* Main tabs */}
        <div className="tab-bar" style={{ margin: '0 -16px', borderBottom: 'none' }}>
          {(['log', 'trends', 'grocery'] as MainTab[]).map(t => (
            <button key={t} className={`tab ${mainTab === t ? 'active' : ''}`} onClick={() => setMainTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sticky macro bar ── */}
      <MacroBar logs={logs} profile={profile} />

      {/* ══ LOG TAB ══ */}
      {mainTab === 'log' && (
        <div>
          {/* Log/Search sub-tabs */}
          {!selectedFood && (
            <div className="tab-bar" style={{ borderTop: 'none' }}>
              <button className={`tab ${logMode === 'recents' ? 'active' : ''}`} onClick={() => { setLogMode('recents'); setSelectedFood(null); }}>
                Recents
              </button>
              <button className={`tab ${logMode === 'search' ? 'active' : ''}`} onClick={() => { setLogMode('search'); setSelectedFood(null); }}>
                Search
              </button>
            </div>
          )}

          {/* Log panel */}
          {selectedFood && (
            <FoodLogPanel
              selected={selectedFood}
              onLog={handleLog}
              onCancel={() => setSelectedFood(null)}
            />
          )}

          {/* Recents list */}
          {!selectedFood && logMode === 'recents' && (
            recentFoods.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 16, letterSpacing: '-0.011em' }}>No recent foods yet</p>
                <button className="btn btn-primary btn-sm" onClick={() => setLogMode('search')}>Search food →</button>
              </div>
            ) : recentFoods.map(food => (
              <FoodRow key={food.id} food={food} onSelect={() => setSelectedFood(food)} />
            ))
          )}

          {/* Search */}
          {!selectedFood && logMode === 'search' && (
            <div>
              <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch()}
                  placeholder="Search food…"
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary btn-sm" onClick={doSearch} disabled={searching} style={{ flexShrink: 0 }}>
                  {searching ? '…' : 'Go'}
                </button>
              </div>
              {searchError && (
                <div style={{ padding: '12px 16px' }}>
                  <p style={{ fontSize: 13, color: 'var(--color-coral-red)', letterSpacing: '-0.011em', margin: 0 }}>{searchError}</p>
                </div>
              )}
              {results.map((r, i) => (
                <FoodRow key={i} food={r} onSelect={() => setSelectedFood(r)} />
              ))}
            </div>
          )}

          {/* Today's meal log — grouped by meal type */}
          {!selectedFood && (
            <div style={{ marginTop: 8 }}>
              {logs.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-4)', letterSpacing: '-0.011em' }}>Nothing logged today</p>
                </div>
              ) : MEAL_ORDER.map(mt => (
                <MealGroup
                  key={mt}
                  type={mt}
                  logs={grouped[mt]}
                  onDelete={async id => {
                    haptic('light');
                    await deleteMealLog(id);
                    toast('Entry removed', 'info');
                    await reloadAndScore();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TRENDS TAB ══ */}
      {mainTab === 'trends' && (
        <div>
          <div className="tab-bar">
            {(['day', 'week', 'year'] as TrendsTab[]).map(t => (
              <button key={t} className={`tab ${trendsTab === t ? 'active' : ''}`} onClick={() => setTrendsTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {trendsTab === 'day' && (
            <div style={{ padding: 16 }}>
              <p className="label" style={{ marginBottom: 12 }}>Today vs targets</p>
              <MacroBar logs={logs} profile={profile} />
            </div>
          )}
          {trendsTab === 'week' && (
            <div>
              <p className="label" style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', margin: 0 }}>This week</p>
              <WeekGrid scores={allScores} />
            </div>
          )}
          {trendsTab === 'year' && <YearGrid scores={allScores} />}
        </div>
      )}

      {/* ══ GROCERY TAB ══ */}
      {mainTab === 'grocery' && <GroceryTab />}
    </div>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-4)', letterSpacing: '-0.011em' }}>Loading…</p>
      </div>
    }>
      <NutritionContent />
    </Suspense>
  );
}
