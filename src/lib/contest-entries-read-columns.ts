/**
 * Minimal `contest_entries` read projection (no protection / insured / token columns).
 * Use for PostgREST selects to avoid schema drift 400s.
 */
export const CONTEST_ENTRIES_READ_BASE =
  "id,contest_id,user_id,lineup_id,entry_fee,total_paid,status,created_at,entry_number";
