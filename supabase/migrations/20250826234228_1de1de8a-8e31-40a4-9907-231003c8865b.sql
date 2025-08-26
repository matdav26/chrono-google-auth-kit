-- Add signup_method column to track how users registered
ALTER TABLE public.users 
ADD COLUMN signup_method text DEFAULT 'email';

-- Update existing users to have 'email' as signup method (assuming they signed up properly)
UPDATE public.users 
SET signup_method = 'email' 
WHERE signup_method IS NULL;