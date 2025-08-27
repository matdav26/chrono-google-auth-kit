-- Fix the deadline column type from time to timestamp with explicit casting
ALTER TABLE public.action_items 
ALTER COLUMN deadline TYPE TIMESTAMP WITH TIME ZONE 
USING deadline::timestamp with time zone;