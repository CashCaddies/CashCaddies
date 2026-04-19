-- Pre-aggregated counts for admin update performance (avoid scanning full click/conversion tables).

create or replace view public.update_cta_click_counts as
select
  update_id,
  count(*)::bigint as click_count
from public.update_cta_clicks
group by update_id;

create or replace view public.update_conversion_counts as
select
  update_id,
  count(*)::bigint as conversion_count
from public.update_conversions
group by update_id;

comment on view public.update_cta_click_counts is 'Grouped CTA click counts per founder update (admin metrics).';
comment on view public.update_conversion_counts is 'Grouped signup conversion counts per founder update (admin metrics).';
