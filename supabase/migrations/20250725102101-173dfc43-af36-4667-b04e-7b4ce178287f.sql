-- Drop the trigger first
DROP TRIGGER IF EXISTS on_new_document_trigger ON public.documents;

-- Drop the function
DROP FUNCTION IF EXISTS public.trigger_on_new_document();