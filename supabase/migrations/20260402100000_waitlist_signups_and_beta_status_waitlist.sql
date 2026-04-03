-- Prelaunch waitlist signups + profiles.beta_status = 'waitlist'

-- ---------------------------------------------------------------------------
-- Extend beta_status on profiles
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists beta_status_check;

alter table public.profiles
  add constraint beta_status_check check (
    beta_status = any (
      array['pending'::text, 'approved'::text, 'rejected'::text, 'waitlist'::text]
    )
  );

-- ---------------------------------------------------------------------------
-- Prelaunch signups (no auth user yet)
-- ---------------------------------------------------------------------------
create table if not exists public.waitlist_signups (
  id uuid not null default gen_random_uuid(),
  email text not null,
  username text not null,
  source text not null default 'early_access',
  status text not null default 'pending',
  created_at timestamp with time zone not null default now(),
  constraint waitlist_signups_status_check check (
    status = any (
      array['pending'::text, 'kept_waiting'::text, 'approved'::text, 'removed'::text]
    )
  )
);

comment on table public.waitlist_signups is 'Prelaunch email/handle signups; managed by admins.';

create unique index if not exists waitlist_signups_active_email_uidx
  on public.waitlist_signups (lower(trim(email)))
  where status in ('pending', 'kept_waiting');

create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);

create index if not exists waitlist_signups_status_idx
  on public.waitlist_signups (status);

alter table public.waitlist_signups enable row level security;

create policy waitlist_signups_select_staff
  on public.waitlist_signups
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) in ('admin', 'senior_admin')
    )
  );

create policy waitlist_signups_update_staff
  on public.waitlist_signups
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) in ('admin', 'senior_admin')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) in ('admin', 'senior_admin')
    )
  );

grant select, update on table public.waitlist_signups to authenticated;
grant all on table public.waitlist_signups to service_role;

-- ---------------------------------------------------------------------------
-- New auth users: match early-access waitlist → beta_status waitlist
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta text;
  v_norm text;
  v_username text;
  v_use_generated boolean;
  v_beta_status text;
begin
  v_meta := nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), '');
  v_use_generated := true;
  v_username := null;

  if v_meta is not null then
    v_norm := lower(regexp_replace(v_meta, '[^a-z0-9_]', '_', 'g'));
    if length(v_norm) > 20 then
      v_norm := left(v_norm, 20);
    end if;
    if length(v_norm) >= 3 and v_norm ~ '^[a-z0-9_]{3,20}$' then
      if not exists (
        select 1
        from public.profiles p
        where lower(p.username) = lower(v_norm)
          and p.id is distinct from new.id
      ) then
        v_username := v_norm;
        v_use_generated := false;
      end if;
    end if;
  end if;

  v_beta_status := 'pending';
  if new.email is not null and trim(new.email) <> '' then
    if exists (
      select 1
      from public.waitlist_signups w
      where lower(trim(w.email)) = lower(trim(new.email))
        and w.status in ('pending', 'kept_waiting')
    ) then
      v_beta_status := 'waitlist';
    end if;
  end if;

  insert into public.profiles (
    id,
    email,
    username,
    account_balance,
    beta_status,
    beta_user,
    created_at
  )
  values (
    new.id,
    new.email,
    case when v_use_generated then null else v_username end,
    0,
    v_beta_status,
    false,
    now()
  )
  on conflict (id) do update set
    email = coalesce(profiles.email, excluded.email);

  update public.profiles p
  set email = au.email
  from auth.users au
  where au.id = new.id
    and p.id = new.id
    and p.email is null
    and au.email is not null;

  update public.profiles p
  set
    beta_status = 'waitlist',
    beta_user = false
  where p.id = new.id
    and lower(coalesce(trim(p.beta_status::text), '')) = 'pending'
    and p.email is not null
    and trim(p.email) <> ''
    and exists (
      select 1
      from public.waitlist_signups w
      where lower(trim(w.email)) = lower(trim(p.email))
        and w.status in ('pending', 'kept_waiting')
    );

  return new;
end;
$$;

alter function public.handle_new_user_profile() owner to postgres;
