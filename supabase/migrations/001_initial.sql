-- daily_logs: one row per day
CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  weight_kg numeric(5,2),
  calories integer NOT NULL DEFAULT 0,
  protein_g numeric(6,1) NOT NULL DEFAULT 0,
  carbs_g numeric(6,1) NOT NULL DEFAULT 0,
  fat_g numeric(6,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- targets: append-only history, never overwrite
CREATE TABLE IF NOT EXISTS targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  calorie_target integer NOT NULL,
  protein_target_g numeric(6,1) NOT NULL,
  carbs_target_g numeric(6,1) NOT NULL,
  fat_target_g numeric(6,1) NOT NULL,
  effective_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- phase_state: single-row state machine
CREATE TABLE IF NOT EXISTS phase_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_phase text NOT NULL CHECK (current_phase IN ('fat_loss','recomp')),
  phase_started_at timestamptz NOT NULL DEFAULT now(),
  transitioned_at timestamptz
);

-- points_ledger: daily scoring
CREATE TABLE IF NOT EXISTS points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  adherence_points integer NOT NULL DEFAULT 0,
  bonus_points integer NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed: Phase 1 targets
INSERT INTO targets (phase, calorie_target, protein_target_g, carbs_target_g, fat_target_g, effective_date)
VALUES ('fat_loss', 1800, 185, 45, 98, CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Seed: initial phase state
INSERT INTO phase_state (current_phase, phase_started_at)
SELECT 'fat_loss', now()
WHERE NOT EXISTS (SELECT 1 FROM phase_state);
