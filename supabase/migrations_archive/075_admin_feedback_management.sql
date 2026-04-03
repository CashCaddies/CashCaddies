-- Admin feedback management: profiles.admin_user, beta_feedback.admin_status, RPCs.

alter table public.profiles
  add column if not exists admin_user boolean not null default false;

comment on column public.profiles.admin_user is
  'When true, user may access admin-only tools (e.g. beta feedback review).';

alter table public.beta_feedback
  add column if not exists admin_status text;

update public.beta_feedback set admin_status = 'new' where admin_status is null;

alter table public.beta_feedback alter column admin_status set default 'new';
alter table public.beta_feedback alter column admin_status set not null;

alter table public.beta_feedback drop constraint if exists beta_feedback_admin_status_check;

alter table public.beta_feedback
  add constraint beta_feedback_admin_status_check
  check (admin_status in ('new', 'reviewed', 'planned', 'fixed'));

comment on column public.beta_feedback.admin_status is
  'Workflow status for admins: new, reviewed, planned, fixed.';

-- List all beta feedback with submitter handle and email (admin only).
create or replace function public.admin_user_list_beta_feedback()
returns table (
  id uuid,
  user_id uuid,
  username text,
  email text,
  rating integer,
  confusion_point text,
  feature_request text,
  bug_report text,
  admin_status text,
  created_at timestamptz
)
language plpgsql
stable
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

  return query
  select
    bf.id,
    bf.user_id,
    p.username,
    p.email,
    bf.rating,
    bf.confusion_point,
    bf.feature_request,
    bf.bug_report,
    bf.admin_status,
    bf.created_at
  from public.beta_feedback bf
  inner join public.profiles p on p.id = bf.user_id
  order by bf.created_at desc;
end;
$$;

-- Update feedback workflow status (admin only).
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
  set admin_status = p_status
  where id = p_feedback_id;

  if not found then
    raise exception 'feedback not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.admin_user_list_beta_feedback() to authenticated;
grant execute on function public.admin_user_update_beta_feedback_status(uuid, text) to authenticated;
