import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors, Fonts, Spacing } from '../src/tokens';
import { getTodayNutrition, syncNutrition, postWeight, NutritionData } from '../src/api';

// expo-health may not be available on Android or in Expo Go without a dev client
let Health: typeof import('expo-health') | null = null;
try {
  // Dynamic require so the app doesn't crash when expo-health is unavailable
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Health = require('expo-health');
} catch {
  Health = null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return '--';
  return n.toFixed(decimals);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Divider() {
  return <View style={styles.divider} />;
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

interface MacroRowProps {
  label: string;
  value: number | null;
  target: number | null;
  unit: string;
  overTargetIsRed?: boolean;
}

function MacroRow({ label, value, target, unit, overTargetIsRed = false }: MacroRowProps) {
  const progress = value !== null && target !== null && target > 0
    ? clamp(value / target, 0, 1)
    : 0;

  const isOverTarget = value !== null && target !== null && value > target;
  const barColor = overTargetIsRed && isOverTarget ? '#FF3B30' : Colors.nutritionAccent;

  return (
    <View style={styles.macroRow}>
      {/* Label | Value | Target */}
      <View style={styles.macroMeta}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {fmt(value)}{unit}
        </Text>
        <Text style={styles.macroTarget}>
          / {fmt(target)}{unit}
        </Text>
      </View>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%`, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

interface PointPillProps {
  label: string;
  active: boolean;
}

function PointPill({ label, active }: PointPillProps) {
  return (
    <View
      style={[
        styles.pill,
        active && styles.pillActive,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          active && styles.pillTextActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [data, setData] = useState<NutritionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format today's date for display: "14 AUG 2026"
  const todayDisplay = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).toUpperCase();

  // ── HealthKit weight sync ──────────────────────────────────────────────
  const syncHealthKitWeight = useCallback(async () => {
    if (!Health || Platform.OS !== 'ios') return;

    try {
      const isAvailable = await Health.isAvailableAsync();
      if (!isAvailable) return;

      // Request permission to read body mass
      await Health.requestPermissionsAsync([
        { get: [Health.HealthDataType.BodyMass] },
      ]);

      // Read the most recent body mass sample
      const samples = await Health.getBodyMassSamplesAsync({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        limit: 1,
        ascending: false,
      });

      if (samples && samples.length > 0) {
        const latest = samples[0];
        // expo-health returns mass in the system's default unit; convert from lbs if needed
        // HKUnit for bodyMass defaults to kg on metric devices; check unit property if available
        const weightKg =
          (latest as { value: number; unit?: string }).unit === 'lb'
            ? (latest.value * 0.453592)
            : latest.value;

        const today = todayISO();
        await postWeight(today, Math.round(weightKg * 100) / 100);
      }
    } catch {
      // HealthKit errors are non-fatal — silently ignore
    }
  }, []);

  // ── Data fetch ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await getTodayNutrition();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await syncHealthKitWeight();
      await fetchData();
    })();
  }, [syncHealthKitWeight, fetchData]);

  // ── Sync handler ──────────────────────────────────────────────────────
  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncNutrition();
      await fetchData();
    } catch {
      setError('Sync failed — check connection');
    } finally {
      setSyncing(false);
    }
  };

  // ── Derived display values ────────────────────────────────────────────
  const macros = data?.macros ?? null;
  const targets = data?.targets ?? null;
  const weight = data?.weight ?? null;
  const projection = data?.projection ?? null;
  const points = data?.points ?? null;

  const etaDisplay = (() => {
    if (!projection) return '--';
    if (projection.eta_weeks === -1) return '∞';
    return projection.eta_weeks.toFixed(1);
  })();

  const rollingAvg = weight?.rolling_avg_kg ?? null;

  const adherenceActive = (points?.adherence ?? 0) > 0;
  const bonusActive = (points?.bonus ?? 0) > 0;
  const totalPoints = points?.total ?? 0;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* 1. Header strip */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PERSONAL OS</Text>
        <Text style={styles.headerDate}>{todayDisplay}</Text>
      </View>

      {/* 2. ETA block */}
      <View style={styles.etaBlock}>
        <Text style={styles.etaLabel}>WEEKS TO TARGET</Text>
        <Text style={styles.etaNumber}>{loading ? '--' : etaDisplay}</Text>
        <Text style={styles.etaSub}>recalculates weekly · 84kg midpoint</Text>
      </View>

      <Divider />

      {/* 3. Macros section */}
      <View style={styles.section}>
        <SectionLabel>TODAY</SectionLabel>

        {loading ? (
          <ActivityIndicator color={Colors.textMuted} style={{ marginTop: Spacing.sm }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <MacroRow
              label="CALORIES"
              value={macros?.calories ?? null}
              target={targets?.calories ?? null}
              unit=" kcal"
              overTargetIsRed
            />
            <MacroRow
              label="PROTEIN"
              value={macros?.protein_g ?? null}
              target={targets?.protein_g ?? null}
              unit="g"
            />
            <MacroRow
              label="CARBS"
              value={macros?.carbs_g ?? null}
              target={targets?.carbs_g ?? null}
              unit="g"
            />
            <MacroRow
              label="FAT"
              value={macros?.fat_g ?? null}
              target={targets?.fat_g ?? null}
              unit="g"
            />
          </>
        )}
      </View>

      <Divider />

      {/* 4. Weight section */}
      <View style={styles.section}>
        <SectionLabel>WEIGHT</SectionLabel>
        <View style={styles.weightRow}>
          <Text style={styles.weightValue}>
            {loading ? '--' : fmt(rollingAvg, 1)}
          </Text>
          <Text style={styles.weightUnit}>kg</Text>
        </View>
        <Text style={styles.weightSub}>7-day rolling avg</Text>
      </View>

      <Divider />

      {/* 5. Points strip */}
      <View style={styles.section}>
        <View style={styles.pointsRow}>
          <View style={styles.pillsRow}>
            <SectionLabel>TODAY'S POINTS</SectionLabel>
            <View style={styles.pills}>
              <PointPill label="LOG ✓" active={adherenceActive} />
              <PointPill label="TARGET ✓" active={bonusActive} />
            </View>
          </View>
          <Text style={styles.pointsTotal}>
            {loading ? '--' : totalPoints}
          </Text>
        </View>
      </View>

      <Divider />

      {/* 6. Sync button */}
      <View style={styles.syncContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.syncButton,
            pressed && styles.syncButtonPressed,
          ]}
          onPress={handleSync}
          disabled={syncing}
        >
          <Text style={styles.syncLabel}>
            {syncing ? 'SYNCING…' : 'SYNC FROM FATSECRET'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingTop: 56,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  headerDate: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textMuted,
  },

  // ETA block
  etaBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  etaLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  etaNumber: {
    fontFamily: Fonts.monoBold,
    fontSize: 88,
    color: Colors.accent,
    lineHeight: 96,
  },
  etaSub: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },

  // Sections
  section: {
    paddingVertical: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },

  // Macro rows
  macroRow: {
    marginBottom: Spacing.sm,
  },
  macroMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  macroLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
    width: 72,
  },
  macroValue: {
    fontFamily: Fonts.mono,
    fontSize: 22,
    color: Colors.textPrimary,
    flex: 1,
  },
  macroTarget: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Progress bar
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },

  // Weight
  weightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  weightValue: {
    fontFamily: Fonts.monoBold,
    fontSize: 32,
    color: Colors.textPrimary,
  },
  weightUnit: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.textMuted,
  },
  weightSub: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // Points
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillsRow: {
    flex: 1,
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    borderColor: Colors.nutritionAccent,
  },
  pillText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
  },
  pillTextActive: {
    color: Colors.textPrimary,
  },
  pointsTotal: {
    fontFamily: Fonts.mono,
    fontSize: 20,
    color: Colors.textPrimary,
  },

  // Sync button
  syncContainer: {
    marginTop: 'auto',
    paddingTop: Spacing.md,
  },
  syncButton: {
    height: 48,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonPressed: {
    opacity: 0.7,
  },
  syncLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },

  // Error
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#FF3B30',
    marginTop: Spacing.sm,
  },
});
