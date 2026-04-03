-- restore correct profile linkage
UPDATE profiles
SET id = auth.users.id
FROM auth.users
WHERE profiles.email = auth.users.email;

UPDATE profiles
SET role = 'senior_admin'
WHERE email = 'cashcaddies@outlook.com';

UPDATE profiles
SET beta_status = 'approved'
WHERE email = 'cashcaddies@outlook.com';

-- Future safety:
-- NEVER manually change profiles.id again.
