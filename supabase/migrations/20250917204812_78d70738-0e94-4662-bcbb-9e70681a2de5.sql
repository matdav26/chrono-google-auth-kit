-- Add event_date column to events table
ALTER TABLE public.events 
ADD COLUMN event_date TIMESTAMP WITH TIME ZONE;

-- Update existing events to use their created_at as event_date
UPDATE public.events 
SET event_date = created_at 
WHERE event_date IS NULL;