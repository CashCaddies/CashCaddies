alter table founder_updates
add column if not exists visibility text default 'public';

-- optional: backfill existing rows
update founder_updates
set visibility = 'public'
where visibility is null;
