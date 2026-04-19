-- Ensure every auth.users row has a public.profiles row: new signups via trigger, backfill missing.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Replaces legacy on_auth_user_created_profile wiring; keeps email sync trigger unchanged.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_local text;
  v_username text;
BEGIN
  -- Optional handle from email local-part when it satisfies profiles_username_format (3–20, a-z0-9_).
  v_local := lower(replace(split_part(coalesce(NEW.email, ''), '@', 1), '.', '_'));
  v_local := regexp_replace(v_local, '[^a-z0-9_]', '_', 'g');
  IF length(v_local) > 20 THEN
    v_local := left(v_local, 20);
  END IF;

  IF length(v_local) >= 3
     AND v_local ~ '^[a-z0-9_]{3,20}$'
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE lower(p.username) = v_local
         AND p.id IS DISTINCT FROM NEW.id
     ) THEN
    v_username := v_local;
  ELSE
    v_username := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, v_username)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

COMMENT ON FUNCTION public.handle_new_user() IS
  'After insert on auth.users: ensure public.profiles row (id, email, username or NULL for temp username).';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Backfill: any auth user without a profile
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
