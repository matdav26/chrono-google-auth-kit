-- Enable RLS on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for events table
CREATE POLICY "Events: insert if project member" 
ON public.events 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM project_memberships pm 
    WHERE pm.project_id = events.project_id 
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Events: select if project member" 
ON public.events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM project_memberships pm 
    WHERE pm.project_id = events.project_id 
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Events: update if project member" 
ON public.events 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM project_memberships pm 
    WHERE pm.project_id = events.project_id 
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Events: delete if project member" 
ON public.events 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM project_memberships pm 
    WHERE pm.project_id = events.project_id 
    AND pm.user_id = auth.uid()
  )
);

-- Create trigger to log event activities
CREATE OR REPLACE FUNCTION public.log_event_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger
CREATE TRIGGER log_event_activity_trigger
  AFTER INSERT OR DELETE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.log_event_activity();