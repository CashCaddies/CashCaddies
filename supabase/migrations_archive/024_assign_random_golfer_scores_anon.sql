-- Local dev: allow simulate scoring via anon/authenticated RPC (security definer updates golfers).

grant execute on function public.assign_random_golfer_scores() to anon, authenticated;
