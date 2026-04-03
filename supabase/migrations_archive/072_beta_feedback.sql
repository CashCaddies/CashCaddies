-- Beta tester feedback intake (additive). RLS: users insert/select own rows only.

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  confusion_point text,
  feature_request text,
  bug_report text,
  created_at timestamptz not null default now()
);

create index if not exists beta_feedback_user_id_idx on public.beta_feedback (user_id);
create index if not exists beta_feedback_created_at_desc_idx on public.beta_feedback (created_at desc);

comment on table public.beta_feedback is 'Private beta product feedback; one row per submit from authenticated users.';

alter table public.beta_feedback enable row level security;

drop policy if exists "Users insert own beta feedback" on public.beta_feedback;
create policy "Users insert own beta feedback"
  on public.beta_feedback
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users select own beta feedback" on public.beta_feedback;
create policy "Users select own beta feedback"
  on public.beta_feedback
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert on table public.beta_feedback to authenticated;
