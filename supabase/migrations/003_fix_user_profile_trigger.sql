-- Fix: SECURITY DEFINER function needs explicit search_path to find public.user_profiles
-- Without SET search_path = public, the trigger fails with "relation user_profiles does not exist"
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles(id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
