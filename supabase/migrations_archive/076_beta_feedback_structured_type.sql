-- Structured beta feedback: bug vs idea, optional title and steps.

alter table public.beta_feedback
  add column if not exists feedback_type text;

update public.beta_feedback
set feedback_type = case
  when coalesce(trim(bug_report), '') <> '' then 'bug'
  else 'idea'
end
where feedback_type is null;

alter table public.beta_feedback alter column feedback_type set default 'idea';
alter table public.beta_feedback alter column feedback_type set not null;

alter table public.beta_feedback drop constraint if exists beta_feedback_feedback_type_check;

alter table public.beta_feedback
  add constraint beta_feedback_feedback_type_check
  check (feedback_type in ('bug', 'idea'));

comment on column public.beta_feedback.feedback_type is 'User-selected intake: bug report or product idea.';

alter table public.beta_feedback
  add column if not exists title text;

comment on column public.beta_feedback.title is 'Short summary line for the submission.';

alter table public.beta_feedback
  add column if not exists steps_to_reproduce text;

comment on column public.beta_feedback.steps_to_reproduce is 'Optional steps to reproduce (bug reports).';

-- Admin list: include structured fields.
create or replace function public.admin_user_list_beta_feedback()
returns table (
  id uuid,
  user_id uuid,
  username text,
  email text,
  feedback_type text,
  title text,
  rating integer,
  confusion_point text,
  feature_request text,
  bug_report text,
  steps_to_reproduce text,
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
    bf.feedback_type,
    bf.title,
    bf.rating,
    bf.confusion_point,
    bf.feature_request,
    bf.bug_report,
    bf.steps_to_reproduce,
    bf.admin_status,
    bf.created_at
  from public.beta_feedback bf
  inner join public.profiles p on p.id = bf.user_id
  order by bf.created_at desc;
end;
$$;
