-- Device tokens table for APNs push notifications
-- Run this in Supabase SQL editor when dev account is active

create table if not exists device_tokens (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null,
  platform    text not null default 'ios',
  updated_at  timestamptz not null default now(),
  unique (user_id, platform)
);

alter table device_tokens enable row level security;

create policy "Users manage own tokens"
  on device_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
