-- Drop the foreign key constraint on owner_id
ALTER TABLE public.action_items 
DROP CONSTRAINT IF EXISTS action_items_owner_id_fkey;

-- Make owner_id nullable since it's just for tracking the creator
ALTER TABLE public.action_items 
ALTER COLUMN owner_id DROP NOT NULL;

-- Add a comment to clarify the column purposes
COMMENT ON COLUMN public.action_items.owner_id IS 'ID of the user who created this action item (for tracking purposes)';
COMMENT ON COLUMN public.action_items.owner_name IS 'Name of the person responsible for this action item (manually entered)';