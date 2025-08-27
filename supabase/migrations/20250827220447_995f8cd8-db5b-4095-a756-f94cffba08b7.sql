-- Drop the incorrect deadline column and recreate it with the correct type
ALTER TABLE public.action_items DROP COLUMN deadline;
ALTER TABLE public.action_items ADD COLUMN deadline TIMESTAMP WITH TIME ZONE;