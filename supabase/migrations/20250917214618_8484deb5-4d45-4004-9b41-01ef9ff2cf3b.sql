-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert the new user into the public.users table
  INSERT INTO public.users (id, email, signup_method)
  VALUES (
    new.id,
    new.email,
    CASE 
      WHEN new.raw_app_meta_data->>'provider' = 'google' THEN 'google'
      ELSE 'email'
    END
  )
  ON CONFLICT (id) DO UPDATE 
  SET email = EXCLUDED.email; -- Update email if user already exists
  
  RETURN new;
END;
$$;

-- Create a trigger to automatically insert users after signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();