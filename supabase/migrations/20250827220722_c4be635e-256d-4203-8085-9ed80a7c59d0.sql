-- Fix the action_items table structure
ALTER TABLE public.action_items 
    ALTER COLUMN project_id DROP DEFAULT,
    ALTER COLUMN project_id SET NOT NULL,
    ALTER COLUMN owner_id DROP DEFAULT,
    ALTER COLUMN owner_id SET NOT NULL,
    ALTER COLUMN description SET NOT NULL;