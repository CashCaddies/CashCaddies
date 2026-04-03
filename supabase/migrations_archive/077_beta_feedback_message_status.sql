-- beta_feedback: canonical columns message + status; optional issue_page; drop legacy columns.

alter table public.beta_feedback add column if not exists message text;
alter table public.beta_feedback add column if not exists issue_page text;
alter table public.beta_feedback add column if not exists status text;

-- Backfill message from legacy columns (072–076).
update public.beta_feedback
set message = trim(
  concat_ws(
    E'\n\n',
    case when coalesce(trim(bug_report), '') <> '' then bug_report end,
    case when coalesce(trim(feature_request), '') <> '' then feature_request end,
    case when coalesce(trim(confusion_point), '') <> '' then confusion_point end,
    case
      when coalesce(trim(steps_to_reproduce), '') <> ''
      then E'Steps to reproduce:\n' || trim(steps_to_reproduce)
    end
  )
)
where message is null;

update public.beta_feedback
set message = '(Legacy feedback)'
where message is null or trim(message) = '';

-- status: prefer admin_status (075) when present
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'beta_feedback'
      and column_name = 'admin_status'
  ) then
    execute $sql$
      update public.beta_feedback
      set status = coalesce(nullif(trim(admin_status), ''), 'new')
      where status is null
    $sql$;
  end if;
end $$;

update public.beta_feedback
set status = 'new'
where status is null or trim(status) = '';

alter table public.beta_feedback drop constraint if exists beta_feedback_status_check;

alter table public.beta_feedback
  add constraint beta_feedback_status_check
  check (status in ('new', 'reviewed', 'planned', 'fixed'));

alter table public.beta_feedback alter column status set default 'new';
alter table public.beta_feedback alter column status set not null;

-- title required
update public.beta_feedback
set title = left(regexp_replace(coalesce(trim(message), 'Feedback'), E'\\s+', ' ', 'g'), 200)
where title is null or trim(title) = '';

alter table public.beta_feedback alter column title set not null;

alter table public.beta_feedback alter column message set not null;

-- Drop legacy columns
alter table public.beta_feedback drop column if exists rating;
alter table public.beta_feedback drop column if exists confusion_point;
alter table public.beta_feedback drop column if exists feature_request;
alter table public.beta_feedback drop column if exists bug_report;
alter table public.beta_feedback drop column if exists steps_to_reproduce;
alter table public.beta_feedback drop column if exists admin_status;

-- Ensure feedback_type (076) before NOT NULL constraints
update public.beta_feedback
set feedback_type = 'idea'
where feedback_type is null;

comment on column public.beta_feedback.message is 'Main feedback body.';
comment on column public.beta_feedback.issue_page is 'Optional page, URL, or area where an issue occurred.';
comment on column public.beta_feedback.status is 'Workflow: new, reviewed, planned, fixed.';

create index if not exists beta_feedback_status_new_idx on public.beta_feedback (status)
  where status = 'new';

-- Count submissions with status = new (admin only).
create or replace function public.admin_user_new_feedback_count()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.admin_user is true
  ) then
    return 0;
  end if;

  select count(*)::bigint into n from public.beta_feedback where status = 'new';
  return coalesce(n, 0);
end;
$$;

grant execute on function public.admin_user_new_feedback_count() to authenticated;

drop function if exists public.admin_user_list_beta_feedback();

-- List feedback for admin; p_filter: 'all' | 'new'
create or replace function public.admin_user_list_beta_feedback(p_filter text default 'all')
returns table (
  id uuid,
  user_id uuid,
  username text,
  email text,
  feedback_type text,
  title text,
  message text,
  issue_page text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f text := lower(trim(coalesce(p_filter, 'all')));
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.admin_user is true
  ) then
    raise exception 'not an admin user' using errcode = '42501';
  end if;

  return query
  select
    bf.id,
    bf.user_id,
    p.username,
    p.email,
    bf.feedback_type,
    bf.title,
    bf.message,
    bf.issue_page,
    bf.status,
    bf.created_at
  from public.beta_feedback bf
  inner join public.profiles p on p.id = bf.user_id
  where case
    when f in ('', 'all') then true
    when f = 'new' then bf.status = 'new'
    else true
  end
  order by bf.created_at desc;
end;
$$;

grant execute on function public.admin_user_list_beta_feedback(text) to authenticated;

-- Update workflow status (column status)
create or replace function public.admin_user_update_beta_feedback_status(
  p_feedback_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.admin_user is true
  ) then
    raise exception 'not an admin user' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('new', 'reviewed', 'planned', 'fixed') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  update public.beta_feedback
  set status = p_status
  where id = p_feedback_id;

  if not found then
    raise exception 'feedback not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.admin_user_update_beta_feedback_status(uuid, text) to authenticated;
