'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getRecentFoods, addMealLog, todayISO,
  type FoodItem,
} from '@/lib/db';
import { haptic } from '@/lib/haptic';
import { toast } from './Toast';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};

function currentMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 19) return 'dinner';
  return 'snack';
}

interface Props {
  open: boolean;
  onClose: () => void;
  onLogged: () => void;
}

export default function QuickLogSheet({ open, onClose, onLogged }: Props) {
  const [foods, setFoods]         = useState<FoodItem[]>([]);
  const [selected, setSelected]   = useState<FoodItem | null>(null);
  const [qty, setQty]             = useState('100');
  const [meal, setMeal]           = useState<MealType>(currentMealType());
  const [logging, setLogging]     = useState(false);

  const load = useCallback(async () => {
    const recents = await getRecentFoods(8);
    setFoods(recents);
  }, []);

  useEffect(() => { if (open) { load(); setSelected(null); setQty('100'); setMeal(currentMealType()); } }, [open, load]);

  const handleLog = async () => {
    if (!selected) return;
    setLogging(true);
    haptic('medium');
    await addMealLog({
      date: todayISO(), meal_type: meal,
      food_item_id: selected.id,
      quantity: parseFloat(qty) || 100,
      logged_at: new Date().toISOString(),
      source: 'manual',
    });
    toast(`${selected.name} logged ✓`);
    setLogging(false);
    onLogged();
    onClose();
  };

  const r = (parseFloat(qty) || 0) / (selected?.serving_size || 100);
  const previewCal = selected ? Math.round(selected.calories * r) : 0;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(8,9,10,0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 401,
        background: 'var(--color-carbon)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.80), 0 1px 3px rgba(0,0,0,0.80)',
        borderRadius: '16px 16px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        animation: 'sheet-up 0.22s cubic-bezier(0.4,0,0.2,1)',
        maxHeight: '85dvh',
        display: 'flex', flexDirection: 'column',
      }}>
        <style>{`
          @keyframes sheet-up {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
        `}</style>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--color-graphite)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 12px' }}>
          <p style={{ fontSize: 15, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text)', margin: 0 }}>
            Quick log
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '4px 6px' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Meal type selector */}
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {(Object.keys(MEAL_LABELS) as MealType[]).map(m => (
              <button
                key={m}
                onClick={() => setMeal(m)}
                style={{
                  flex: '0 0 auto',
                  padding: '4px 12px',
                  borderRadius: 9999,
                  border: 'none',
                  background: meal === m ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                  color: meal === m ? '#fff' : 'rgba(255,255,255,0.40)',
                  fontSize: 12, fontWeight: 400, letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Recent foods */}
          {!selected && (
            <div>
              <p className="label" style={{ padding: '0 16px', marginBottom: 4 }}>Recent</p>
              {foods.length === 0 ? (
                <p style={{ padding: '20px 16px', fontSize: 13, color: 'var(--text-4)', letterSpacing: '-0.011em' }}>
                  No recent foods — log from Nutrition first.
                </p>
              ) : foods.map(f => (
                <button
                  key={f.id}
                  onClick={() => { haptic('light'); setSelected(f); }}
                  style={{
                    display: 'flex', width: '100%', alignItems: 'center',
                    padding: '11px 16px',
                    background: 'transparent', border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer', textAlign: 'left',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 400, letterSpacing: '-0.011em', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.name}
                    </p>
                    {f.brand && <p className="label" style={{ margin: 0 }}>{f.brand}</p>}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 510, color: 'var(--text-3)', letterSpacing: '-0.011em', marginLeft: 12 }}>
                    {f.calories} kcal
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Selected food — qty picker */}
          {selected && (
            <div style={{ padding: '0 16px 16px' }}>
              {/* Food info */}
              <div style={{
                background: 'var(--color-obsidian)',
                borderRadius: 12, padding: '12px 14px', marginBottom: 14,
                boxShadow: 'var(--shadow-card)',
              }}>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 510, letterSpacing: '-0.011em', color: 'var(--text)' }}>{selected.name}</p>
                {selected.brand && <p className="label" style={{ margin: 0 }}>{selected.brand}</p>}
              </div>

              {/* Qty */}
              <p className="label" style={{ marginBottom: 6 }}>Grams</p>
              <input
                type="number"
                value={qty}
                onChange={e => setQty(e.target.value)}
                style={{ marginBottom: 8, fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em', textAlign: 'center' }}
                autoFocus
              />

              {/* Quick qty */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {['50','100','150','200'].map(q => (
                  <button
                    key={q}
                    onClick={() => setQty(q)}
                    className={qty === q ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                    style={{ flex: 1 }}
                  >
                    {q}g
                  </button>
                ))}
              </div>

              {/* Macro preview */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
                gap: 8, marginBottom: 16,
                background: 'var(--color-obsidian)',
                borderRadius: 12, padding: '12px',
              }}>
                {[
                  { label: 'kcal', val: previewCal },
                  { label: 'pro',  val: `${Math.round(selected.protein * r * 10) / 10}g` },
                  { label: 'carb', val: `${Math.round(selected.carbs * r * 10) / 10}g` },
                  { label: 'fat',  val: `${Math.round(selected.fat * r * 10) / 10}g` },
                ].map(({ label, val }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <p className="label" style={{ marginBottom: 4 }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.011em', color: '#fff' }}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <button
                className="btn btn-primary btn-block"
                onClick={handleLog}
                disabled={logging}
                style={{ marginBottom: 8 }}
              >
                {logging ? '…' : `Log to ${MEAL_LABELS[meal]} →`}
              </button>
              <button
                className="btn btn-outline btn-block"
                onClick={() => setSelected(null)}
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
