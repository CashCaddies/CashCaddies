-- CONTESTS TABLE
create table if not exists contests (
  id uuid primary key default gen_random_uuid(),
  name text,
  entry_fee numeric,
  max_entries int,
  current_entries int default 0,
  start_date timestamp,
  created_at timestamp default now()
);

-- CONTEST ENTRIES TABLE
create table if not exists contest_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  contest_id uuid,
  created_at timestamp default now()
);

-- SEED DATA
insert into contests (name, entry_fee, max_entries, current_entries, start_date)
values
  ('RBC $500 High Roller', 500, 2, 0, now() + interval '1 day'),
  ('RBC $5 Single Entry', 5, 1, 0, now() + interval '1 day'),
  ('RBC $20 3-Max', 20, 3, 0, now() + interval '1 day');
