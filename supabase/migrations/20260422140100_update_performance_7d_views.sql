-- Rolling 7-day aggregates for update performance dashboard.

create or replace view public.update_cta_click_counts_7d as
select
  update_id,
  count(*)::bigint as click_count_7d
from public.update_cta_clicks
where created_at >= now() - interval '7 days'
group by update_id;

create or replace view public.update_conversion_counts_7d as
select
  update_id,
  count(*)::bigint as conversion_count_7d
from public.update_conversions
where created_at >= now() - interval '7 days'
group by update_id;

create or replace view public.update_impression_counts_7d as
select
  update_id,
  count(*)::bigint as impression_count_7d
from public.update_impressions
where created_at >= now() - interval '7 days'
group by update_id;

comment on view public.update_cta_click_counts_7d is 'CTA clicks per update in the last 7 days.';
comment on view public.update_conversion_counts_7d is 'Signup conversions per update in the last 7 days.';
comment on view public.update_impression_counts_7d is 'Impressions per update in the last 7 days.';
