-- First, let's check if the trigger exists and remove the manual activity_logs insert conflict
-- We need to modify the trigger to handle backend context properly

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS log_document_activity_trigger ON public.documents;

-- Create updated trigger function that doesn't conflict with manual logging
CREATE OR REPLACE FUNCTION public.log_document_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only auto-log if not called from backend (backend will handle manually)
  -- We can detect backend calls by checking if auth.uid() is null
  IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.activity_logs (project_id, user_id, action, resource_type, resource_name, details)
    VALUES (
      NEW.project_id,
      auth.uid(),
      'uploaded',
      CASE WHEN NEW.doc_type = 'url' THEN 'url' ELSE 'file' END,
      NEW.filename,
      jsonb_build_object('doc_type', NEW.doc_type, 'raw_text', NEW.raw_text)
    );
    RETURN NEW;
  END IF;
  
  -- Handle DELETE (document deletion) - only for frontend
  IF TG_OP = 'DELETE' AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.activity_logs (project_id, user_id, action, resource_type, resource_name, details)
    VALUES (
      OLD.project_id,
      auth.uid(),
      'deleted',
      CASE WHEN OLD.doc_type = 'url' THEN 'url' ELSE 'file' END,
      OLD.filename,
      jsonb_build_object('doc_type', OLD.doc_type)
    );
    RETURN OLD;
  END IF;
  
  -- Handle UPDATE (document rename) - only for frontend
  IF TG_OP = 'UPDATE' AND OLD.filename != NEW.filename AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.activity_logs (project_id, user_id, action, resource_type, resource_name, details)
    VALUES (
      NEW.project_id,
      auth.uid(),
      'renamed',
      CASE WHEN NEW.doc_type = 'url' THEN 'url' ELSE 'file' END,
      NEW.filename,
      jsonb_build_object('old_name', OLD.filename, 'new_name', NEW.filename, 'doc_type', NEW.doc_type)
    );
    RETURN NEW;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER log_document_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.log_document_activity();