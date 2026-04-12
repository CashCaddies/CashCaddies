-- Seed synthetic player pool for sim contests (idempotent: skip if sim_players already has rows).

do $seed$
begin
  if exists (select 1 from public.sim_players limit 1) then
    raise notice 'seed 20260421400000: sim_players non-empty; skipping seed';
    return;
  end if;

  insert into public.sim_players (name, salary, rating)
  values
    ('Scheffler', 13000, 10),
    ('Young', 12100, 9),
    ('Fleetwood', 11200, 8),
    ('Spaun', 10900, 8),
    ('Fitzpatrick', 10700, 8),
    ('Morikawa', 10500, 8),
    ('MacIntyre', 10300, 7),
    ('Rose', 10100, 7),
    ('Schauffele', 9900, 8),
    ('Gotterup', 9700, 7),
    ('Henley', 8900, 7),
    ('Straka', 8800, 7),
    ('Thomas', 8700, 7),
    ('Griffin', 8600, 6),
    ('Åberg', 8500, 7),
    ('Bridgeman', 8400, 6),
    ('Noren', 8300, 6),
    ('English', 8200, 6),
    ('Bhatia', 8100, 6),
    ('Hovland', 8000, 7),
    ('Lee', 7900, 6),
    ('Bradley', 7800, 6),
    ('McNealy', 7700, 6),
    ('Kim Si Woo', 7600, 6),
    ('Gerard', 7500, 5),
    ('Lowry', 7400, 6),
    ('Burns', 7300, 6),
    ('Kitayama', 7200, 6),
    ('Cantlay', 7100, 6),
    ('Højgaard', 7000, 6),
    ('Berger', 6900, 5),
    ('Echavarria', 6800, 5),
    ('Day', 6700, 5),
    ('Knapp', 6600, 5),
    ('Kim Michael', 6500, 5),
    ('Conners', 6400, 6),
    ('Stevens', 6300, 5),
    ('Brennan', 6200, 5),
    ('Novak', 6100, 4),
    ('McCarty', 6000, 4);
end;
$seed$;
