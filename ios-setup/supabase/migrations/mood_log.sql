create table if not exists mood_log (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  date date not null default current_date,
  context text not null, -- 'pre_meditation' | 'post_meditation' | 'manual'
  mood int not null check (mood between 1 and 5),
  stress int check (stress between 1 and 5),
  logged_at timestamptz not null default now()
);
alter table mood_log enable row level security;
create policy "Users own mood logs" on mood_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
