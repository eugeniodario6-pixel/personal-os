-- Add routine column to habit table
-- Values: 'morning' | 'evening' (default morning for existing habits)

alter table habit
  add column if not exists routine text not null default 'morning'
  check (routine in ('morning', 'evening'));

-- Assign existing habits to sensible defaults based on name
update habit set routine = 'evening'
where lower(name) ilike any(array[
  '%sleep%', '%bed%', '%night%', '%evening%', '%wind%', '%screen%', '%journal%', '%gratitude%', '%read%', '%reading%', '%reflect%'
]);
