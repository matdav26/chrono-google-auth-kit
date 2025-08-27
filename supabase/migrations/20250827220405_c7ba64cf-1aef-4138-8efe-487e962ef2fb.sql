-- Fix the deadline column type from time to timestamp
ALTER TABLE public.action_items 
ALTER COLUMN deadline TYPE TIMESTAMP WITH TIME ZONE;