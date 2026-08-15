'use client';

import { useEffect, useState, useCallback } from 'react';
import { db, type Profile } from '@/lib/db';

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // Form state
  const [calorieTarget, setCalorieTarget] = useState('2000');
  const [proteinTarget, setProteinTarget] = useState('150');
  const [carbsTarget, setCarbsTarget] = useState('200');
  const [fatTarget, setFatTarget] = useState('65');
  const [weightGoal, setWeightGoal] = useState('');
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [nonNumericMode, setNonNumericMode] = useState(false);
  const [reminderMorning, setReminderMorning] = useState('07:00');
  const [reminderEvening, setReminderEvening] = useState('20:00');

  const loadData = useCallback(async () => {
    const prof = await db.profile.get(1);
    if (prof) {
      setProfile(prof);
      setCalorieTarget(String(prof.calorie_target));
      setProteinTarget(String(prof.macro_targets.protein));
      setCarbsTarget(String(prof.macro_targets.carbs));
      setFatTarget(String(prof.macro_targets.fat));
      setWeightGoal(prof.weight_goal != null ? String(prof.weight_goal) : '');
      setUnits(prof.units);
      setNonNumericMode(prof.non_numeric_mode);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    const update: Partial<Profile> = {
      calorie_target: parseInt(calorieTarget) || 2000,
      macro_targets: {
        protein: parseInt(proteinTarget) || 150,
        carbs: parseInt(carbsTarget) || 200,
        fat: parseInt(fatTarget) || 65,
      },
      weight_goal: weightGoal ? parseFloat(weightGoal) : null,
      units,
      non_numeric_mode: nonNumericMode,
    };

    if (profile) {
      await db.profile.update(1, update);
    } else {
      await db.profile.add({
        id: 1,
        calorie_target: update.calorie_target!,
        macro_targets: update.macro_targets!,
        weight_goal: update.weight_goal!,
        units: update.units!,
        non_numeric_mode: update.non_numeric_mode!,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await loadData();
  };

  const handleExport = async () => {
    const [prof, foods, meals, workouts, habits, completions, medSessions, medLogs, insights] =
      await Promise.all([
        db.profile.toArray(),
        db.food_item.toArray(),
        db.meal_log.toArray(),
        db.workout_log.toArray(),
        db.habit.toArray(),
        db.habit_completion.toArray(),
        db.meditation_session.toArray(),
        db.meditation_log.toArray(),
        db.insight.toArray(),
      ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      version: 1,
      profile: prof,
      food_items: foods,
      meal_logs: meals,
      workout_logs: workouts,
      habits,
      habit_completions: completions,
      meditation_sessions: medSessions,
      meditation_logs: medLogs,
      insights,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personal-os-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearData = async () => {
    if (!confirm('DELETE ALL DATA? THIS CANNOT BE UNDONE.')) return;
    await Promise.all([
      db.meal_log.clear(),
      db.workout_log.clear(),
      db.habit_completion.clear(),
      db.meditation_log.clear(),
      db.insight.clear(),
    ]);
    alert('DATA CLEARED.');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', fontFamily: "'IBM Plex Mono', monospace", color: '#444', fontSize: '0.75rem' }}>
        LOADING...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '2px solid #444' }}>
        <p className="label" style={{ marginBottom: '0.25rem' }}>SETTINGS</p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', fontFamily: "'IBM Plex Mono', monospace" }}>SET</h1>
      </div>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Goals */}
        <section>
          <p className="label" style={{ marginBottom: '0.75rem', color: '#888' }}>DAILY GOALS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <p className="label" style={{ marginBottom: '0.25rem' }}>CALORIE TARGET (KCAL)</p>
              <input
                type="number"
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(e.target.value)}
                min="500"
                max="10000"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>PROTEIN (g)</p>
                <input type="number" value={proteinTarget} onChange={(e) => setProteinTarget(e.target.value)} min="0" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>CARBS (g)</p>
                <input type="number" value={carbsTarget} onChange={(e) => setCarbsTarget(e.target.value)} min="0" />
              </div>
              <div>
                <p className="label" style={{ marginBottom: '0.25rem' }}>FAT (g)</p>
                <input type="number" value={fatTarget} onChange={(e) => setFatTarget(e.target.value)} min="0" />
              </div>
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.25rem' }}>WEIGHT GOAL ({units === 'metric' ? 'KG' : 'LBS'}) — OPTIONAL</p>
              <input
                type="number"
                value={weightGoal}
                onChange={(e) => setWeightGoal(e.target.value)}
                placeholder="LEAVE BLANK TO SKIP"
                min="0"
              />
            </div>
          </div>
        </section>

        {/* Units */}
        <section>
          <p className="label" style={{ marginBottom: '0.75rem', color: '#888' }}>UNITS</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={units === 'metric' ? 'btn-primary btn' : 'btn btn-ghost'}
              onClick={() => setUnits('metric')}
              style={{ flex: 1, fontSize: '0.7rem' }}
            >
              METRIC (KG, CM)
            </button>
            <button
              className={units === 'imperial' ? 'btn-primary btn' : 'btn btn-ghost'}
              onClick={() => setUnits('imperial')}
              style={{ flex: 1, fontSize: '0.7rem' }}
            >
              IMPERIAL (LBS, IN)
            </button>
          </div>
        </section>

        {/* Non-numeric mode */}
        <section>
          <p className="label" style={{ marginBottom: '0.75rem', color: '#888' }}>DISPLAY MODE</p>
          <button
            onClick={() => setNonNumericMode(!nonNumericMode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              width: '100%',
              padding: '0.875rem 1rem',
              background: nonNumericMode ? '#111' : '#000',
              border: '2px solid #444',
              cursor: 'pointer',
              fontFamily: "'IBM Plex Mono', monospace",
              textAlign: 'left',
            }}
          >
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '0.875rem', color: nonNumericMode ? '#fff' : '#444' }}>
              {nonNumericMode ? '[X]' : '[ ]'}
            </span>
            <div>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: '0.875rem', color: '#fff' }}>
                NON-NUMERIC MODE
              </p>
              <p style={{ fontSize: '0.65rem', color: '#888', fontFamily: "'IBM Plex Mono', monospace", marginTop: '0.1rem' }}>
                HIDE CALORIE NUMBERS, SHOW QUALITATIVE LABELS INSTEAD
              </p>
            </div>
          </button>
        </section>

        {/* Reminder windows */}
        <section>
          <p className="label" style={{ marginBottom: '0.75rem', color: '#888' }}>REMINDER WINDOWS</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <p className="label" style={{ marginBottom: '0.25rem' }}>MORNING FROM</p>
              <input type="time" value={reminderMorning} onChange={(e) => setReminderMorning(e.target.value)} />
            </div>
            <div>
              <p className="label" style={{ marginBottom: '0.25rem' }}>EVENING FROM</p>
              <input type="time" value={reminderEvening} onChange={(e) => setReminderEvening(e.target.value)} />
            </div>
          </div>
          <p style={{ fontSize: '0.65rem', color: '#444', marginTop: '0.5rem', fontFamily: "'IBM Plex Mono', monospace" }}>
            REMINDER SCHEDULING AVAILABLE IN PHASE 2.
          </p>
        </section>

        {/* Save button */}
        <div>
          <button
            className="btn-primary btn"
            onClick={handleSave}
            style={{ width: '100%', fontSize: '0.75rem' }}
          >
            {saved ? '[X] SAVED' : 'SAVE SETTINGS'}
          </button>
        </div>

        {/* Data section */}
        <section style={{ borderTop: '2px solid #444', paddingTop: '1rem' }}>
          <p className="label" style={{ marginBottom: '0.75rem', color: '#888' }}>DATA</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className="btn" onClick={handleExport} style={{ width: '100%', fontSize: '0.7rem' }}>
              EXPORT ALL DATA AS JSON
            </button>
            <button
              onClick={handleClearData}
              style={{
                width: '100%',
                padding: '0.6rem 1rem',
                background: '#000',
                border: '2px solid #111',
                color: '#444',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              CLEAR ACTIVITY DATA
            </button>
          </div>
        </section>

        {/* About */}
        <section style={{ borderTop: '2px solid #111', paddingTop: '1rem' }}>
          <p className="label" style={{ marginBottom: '0.5rem', color: '#444' }}>ABOUT</p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#444', lineHeight: 1.8 }}>
            PERSONAL OS — PHASE 1{'\n'}
            LOCAL-FIRST · NO ACCOUNTS · NO TRACKING{'\n'}
            ALL DATA STORED ON THIS DEVICE
          </p>
        </section>
      </div>
    </div>
  );
}
