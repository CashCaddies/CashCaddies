-- Fix profile row so profiles.id matches auth.users.id for the founder account.
-- Resolves admin/senior_admin detection when profile was created with a mismatched id.

UPDATE profiles
SET id = (
  SELECT id FROM auth.users WHERE email = 'cashcaddies@outlook.com'
)
WHERE email = 'cashcaddies@outlook.com';

UPDATE profiles
SET role = 'senior_admin'
WHERE email = 'cashcaddies@outlook.com';

UPDATE profiles
SET beta_status = 'approved'
WHERE email = 'cashcaddies@outlook.com';
