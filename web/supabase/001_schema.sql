-- meals: food log entries
CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  name text NOT NULL,
  calories integer NOT NULL DEFAULT 0,
  protein_g numeric(6,1) NOT NULL DEFAULT 0,
  carbs_g numeric(6,1) NOT NULL DEFAULT 0,
  fat_g numeric(6,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- daily_targets: single row of targets
CREATE TABLE IF NOT EXISTS daily_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calories integer NOT NULL DEFAULT 1800,
  protein_g numeric(6,1) NOT NULL DEFAULT 185,
  carbs_g numeric(6,1) NOT NULL DEFAULT 45,
  fat_g numeric(6,1) NOT NULL DEFAULT 98
);

-- exercise_log: ticked exercises per day
CREATE TABLE IF NOT EXISTS exercise_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  exercise_key text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, exercise_key)
);

-- Seed targets
INSERT INTO daily_targets (calories, protein_g, carbs_g, fat_g)
SELECT 1800, 185, 45, 98
WHERE NOT EXISTS (SELECT 1 FROM daily_targets);
