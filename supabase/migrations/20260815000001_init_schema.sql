-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- profile
create table if not exists profile (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  calorie_target integer not null default 2000,
  macro_protein integer not null default 150,
  macro_carbs integer not null default 200,
  macro_fat integer not null default 65,
  weight_goal numeric,
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  non_numeric_mode boolean not null default false,
  timezone text not null default 'UTC',
  created_at timestamptz default now()
);

-- food_item
create table if not exists food_item (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  external_id text,
  name text not null,
  brand text,
  barcode text,
  serving_unit text not null default 'g',
  serving_size numeric not null default 100,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  is_favorite boolean not null default false,
  created_at timestamptz default now()
);

-- meal_log
create table if not exists meal_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_item_id uuid references food_item(id) on delete cascade not null,
  quantity numeric not null default 1,
  logged_at timestamptz default now(),
  source text not null default 'manual' check (source in ('barcode', 'photo', 'search', 'manual'))
);

-- workout_template
create table if not exists workout_template (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null default 'General',
  default_duration_min integer not null default 30,
  default_intensity text not null default 'moderate' check (default_intensity in ('low', 'moderate', 'high')),
  created_at timestamptz default now()
);

-- workout_log
create table if not exists workout_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  template_id uuid references workout_template(id) on delete set null,
  name text not null,
  duration_min integer not null default 30,
  intensity text not null default 'moderate' check (intensity in ('low', 'moderate', 'high')),
  calories_burned numeric,
  source text not null default 'manual',
  logged_at timestamptz default now()
);

-- habit
create table if not exists habit (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  active boolean not null default true,
  stacked_after_habit_id uuid references habit(id) on delete set null,
  streak_freeze_available integer not null default 0,
  created_at timestamptz default now()
);

-- habit_completion
create table if not exists habit_completion (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  habit_id uuid references habit(id) on delete cascade not null,
  date date not null,
  completed_at timestamptz,
  unique(habit_id, date)
);

-- meditation_session (global seed data — no user_id)
create table if not exists meditation_session (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null,
  duration_min integer not null,
  instructions text,
  audio_url text,
  created_at timestamptz default now()
);

-- meditation_log
create table if not exists meditation_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  session_id uuid references meditation_session(id) on delete cascade not null,
  date date not null,
  completed boolean not null default false,
  duration_actual_min integer not null default 0,
  logged_at timestamptz default now()
);

-- insight
create table if not exists insight (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  metric_a text not null,
  metric_b text not null,
  relationship text not null,
  data_points integer not null default 0,
  confidence numeric not null default 0,
  generated_at timestamptz default now(),
  shown boolean not null default true
);

-- RLS
alter table profile enable row level security;
alter table food_item enable row level security;
alter table meal_log enable row level security;
alter table workout_template enable row level security;
alter table workout_log enable row level security;
alter table habit enable row level security;
alter table habit_completion enable row level security;
alter table meditation_log enable row level security;
alter table insight enable row level security;
alter table meditation_session enable row level security;

create policy "own profile" on profile for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own food_item" on food_item for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own meal_log" on meal_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workout_template" on workout_template for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workout_log" on workout_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own habit" on habit for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own habit_completion" on habit_completion for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own meditation_log" on meditation_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own insight" on insight for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public meditation sessions" on meditation_session for select using (true);
create policy "service can insert sessions" on meditation_session for insert with check (true);

-- Seed meditation sessions
insert into meditation_session (name, category, duration_min, instructions) values
('Box breathing', 'Breathing', 4, 'Sit upright, feet flat, hands resting on your knees.
Breathe in through the nose for 4 counts.
Hold for 4 counts.
Breathe out through the mouth for 4 counts.
Hold for 4 counts.
Repeat. If your mind wanders, just come back to the count — that''s the whole practice, not a failure of it.'),
('4-7-8 wind-down', 'Breathing', 5, 'Exhale completely through your mouth.
Inhale through the nose for 4 counts.
Hold for 7 counts.
Exhale through the mouth for 8 counts, with a soft whoosh sound.
Repeat for 4 full rounds, then let your breath return to normal and sit in the stillness for the rest of the time.'),
('Full body scan', 'Body scan', 10, 'Lie down or sit back. Close your eyes.
Bring attention to your feet — just notice, don''t change anything.
Move slowly upward: ankles, calves, knees, thighs, hips.
Continue through your stomach, chest, hands, arms, shoulders.
Notice your neck, jaw, face, scalp.
Take one full breath, scanning the whole body at once.
Open your eyes when ready — no need to rush it.'),
('Quick tension release', 'Body scan', 6, 'Starting at your shoulders, tense them up toward your ears for 5 seconds, then release.
Do the same with your hands (clench, then open), your jaw (clench, then soften), and your legs (press feet into the floor, then let go).
Finish with one slow breath through the whole body, top to bottom.'),
('Wind-down for sleep', 'Sleep', 8, 'Lie down, lights off or dim.
Let your breath slow on its own — don''t force it.
Picture your body getting heavier, part by part, starting at your feet.
If a thought shows up, picture setting it down beside the bed — you can pick it back up tomorrow.
No need to finish this session awake. Falling asleep partway through is a success, not an interruption.'),
('3am reset', 'Sleep', 5, 'If you''ve woken in the night: don''t check the time again.
Breathe in for 4, out for 6 — the longer exhale signals your body to settle.
Keep your eyes closed even if you don''t feel sleepy yet. Rest is still rest.'),
('Between-meetings reset', 'Stress release', 3, 'Feet flat on the floor. Unclench your jaw.
Take one breath and notice where you''re holding tension right now.
Breathe into that spot for 5 breaths.
Roll your shoulders back once. Open your eyes. Go.'),
('Naming the noise', 'Stress release', 7, 'Sit and let your mind run without steering it.
When a thought arrives, silently label it: ''planning,'' ''worry,'' ''memory,'' ''nothing.''
Don''t argue with it — just name it and let it pass.
By the end, most of what felt urgent will have quieted on its own.'),
('Pre-work primer', 'Focus', 5, 'Sit with your work already in view, but don''t start yet.
Three breaths, counting each exhale.
State (silently or out loud) the one thing you''re about to focus on.
Begin.'),
('Single-point focus', 'Focus', 10, 'Pick one object in the room, or your own breath.
Hold attention there. When it drifts — and it will — bring it back without judgment.
This is a rep, not a failure state. Ten minutes of drifting-and-returning is the actual workout.')
on conflict do nothing;
