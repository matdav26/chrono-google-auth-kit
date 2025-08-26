-- Fix search_path for existing functions to prevent security issues
CREATE OR REPLACE FUNCTION public.log_event_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Handle INSERT (event creation)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (project_id, user_id, action, resource_type, resource_name, details)
    VALUES (
      NEW.project_id,
      NEW.created_by,
      'created',
      'event',
      NEW.event_name,
      jsonb_build_object('event_description', NEW.event_description)
    );
    RETURN NEW;
  END IF;
  
  -- Handle DELETE (event deletion)
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (project_id, user_id, action, resource_type, resource_name, details)
    VALUES (
      OLD.project_id,
      OLD.created_by,
      'deleted',
      'event',
      OLD.event_name,
      jsonb_build_object('event_description', OLD.event_description)
    );
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_project()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  insert into project_memberships (user_id, project_id, role)
  values (new.created_by, new.id, 'owner');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_document_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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