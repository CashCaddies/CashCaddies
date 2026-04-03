-- Golfers pool: run in Supabase SQL Editor or `supabase db push` after linking the project.

create table if not exists public.golfers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  salary integer not null,
  pga_id text not null unique,
  image_url text,
  created_at timestamptz not null default now(),
  constraint golfers_salary_range check (salary >= 6000 and salary <= 11000)
);

create index if not exists golfers_salary_desc_idx on public.golfers (salary desc);
create index if not exists golfers_name_idx on public.golfers (name);

alter table public.golfers enable row level security;

drop policy if exists "Anyone can read golfers" on public.golfers;
create policy "Anyone can read golfers"
  on public.golfers
  for select
  to anon, authenticated
  using (true);

-- Older DBs may have been created without the pga_id unique constraint; required for ON CONFLICT below.
create unique index if not exists golfers_pga_id_key on public.golfers (pga_id);

-- Seed: 30 sample golfers — salaries between 6000 and 11000 (mock PGA IDs + avatar URLs).
-- Query params use %26 for & so URL literals stay inside single quotes without ambiguous parsing.
insert into public.golfers (name, salary, pga_id, image_url) values
  ('Scottie Scheffler', 11000, '46046', 'https://ui-avatars.com/api/?name=Scottie+Scheffler%26size=256%26background=1f8a3b%26color=fff'),
  ('Rory McIlroy', 10900, '28237', 'https://ui-avatars.com/api/?name=Rory+McIlroy%26size=256%26background=1f8a3b%26color=fff'),
  ('Jon Rahm', 10850, '49771', 'https://ui-avatars.com/api/?name=Jon+Rahm%26size=256%26background=1f8a3b%26color=fff'),
  ('Xander Schauffele', 10700, '48081', 'https://ui-avatars.com/api/?name=Xander+Schauffele%26size=256%26background=1f8a3b%26color=fff'),
  ('Viktor Hovland', 10600, '54628', 'https://ui-avatars.com/api/?name=Viktor+Hovland%26size=256%26background=1f8a3b%26color=fff'),
  ('Collin Morikawa', 10500, '50525', 'https://ui-avatars.com/api/?name=Collin+Morikawa%26size=256%26background=1f8a3b%26color=fff'),
  ('Patrick Cantlay', 10400, '34098', 'https://ui-avatars.com/api/?name=Patrick+Cantlay%26size=256%26background=1f8a3b%26color=fff'),
  ('Ludvig Aberg', 10300, '59866', 'https://ui-avatars.com/api/?name=Ludvig+Aberg%26size=256%26background=1f8a3b%26color=fff'),
  ('Wyndham Clark', 10200, '51070', 'https://ui-avatars.com/api/?name=Wyndham+Clark%26size=256%26background=1f8a3b%26color=fff'),
  ('Hideki Matsuyama', 10100, '32839', 'https://ui-avatars.com/api/?name=Hideki+Matsuyama%26size=256%26background=1f8a3b%26color=fff'),
  ('Brian Harman', 10000, '27644', 'https://ui-avatars.com/api/?name=Brian+Harman%26size=256%26background=1f8a3b%26color=fff'),
  ('Tommy Fleetwood', 9900, '36689', 'https://ui-avatars.com/api/?name=Tommy+Fleetwood%26size=256%26background=1f8a3b%26color=fff'),
  ('Max Homa', 9800, '39977', 'https://ui-avatars.com/api/?name=Max+Homa%26size=256%26background=1f8a3b%26color=fff'),
  ('Sahith Theegala', 9700, '51634', 'https://ui-avatars.com/api/?name=Sahith+Theegala%26size=256%26background=1f8a3b%26color=fff'),
  ('Sam Burns', 9600, '48119', 'https://ui-avatars.com/api/?name=Sam+Burns%26size=256%26background=1f8a3b%26color=fff'),
  ('Tony Finau', 9500, '40098', 'https://ui-avatars.com/api/?name=Tony+Finau%26size=256%26background=1f8a3b%26color=fff'),
  ('Matt Fitzpatrick', 9400, '46970', 'https://ui-avatars.com/api/?name=Matt+Fitzpatrick%26size=256%26background=1f8a3b%26color=fff'),
  ('Russell Henley', 9300, '34099', 'https://ui-avatars.com/api/?name=Russell+Henley%26size=256%26background=1f8a3b%26color=fff'),
  ('Cameron Young', 9200, '57362', 'https://ui-avatars.com/api/?name=Cameron+Young%26size=256%26background=1f8a3b%26color=fff'),
  ('Justin Thomas', 9100, '33448', 'https://ui-avatars.com/api/?name=Justin+Thomas%26size=256%26background=1f8a3b%26color=fff'),
  ('Jason Day', 9000, '28089', 'https://ui-avatars.com/api/?name=Jason+Day%26size=256%26background=1f8a3b%26color=fff'),
  ('Sungjae Im', 8900, '52820', 'https://ui-avatars.com/api/?name=Sungjae+Im%26size=256%26background=1f8a3b%26color=fff'),
  ('Shane Lowry', 8800, '33204', 'https://ui-avatars.com/api/?name=Shane+Lowry%26size=256%26background=1f8a3b%26color=fff'),
  ('Keegan Bradley', 8700, '29478', 'https://ui-avatars.com/api/?name=Keegan+Bradley%26size=256%26background=1f8a3b%26color=fff'),
  ('Byeong Hun An', 8600, '33948', 'https://ui-avatars.com/api/?name=Byeong+Hun+An%26size=256%26background=1f8a3b%26color=fff'),
  ('Corey Conners', 8500, '39997', 'https://ui-avatars.com/api/?name=Corey+Conners%26size=256%26background=1f8a3b%26color=fff'),
  ('Harris English', 8000, '50102', 'https://ui-avatars.com/api/?name=Harris+English%26size=256%26background=1f8a3b%26color=fff'),
  ('Taylor Pendrith', 7500, '51635', 'https://ui-avatars.com/api/?name=Taylor+Pendrith%26size=256%26background=1f8a3b%26color=fff'),
  ('J.T. Poston', 6800, '49766', 'https://ui-avatars.com/api/?name=JT+Poston%26size=256%26background=1f8a3b%26color=fff'),
  ('Nick Taylor', 6000, '29420', 'https://ui-avatars.com/api/?name=Nick+Taylor%26size=256%26background=1f8a3b%26color=fff')
on conflict (pga_id) do nothing;
