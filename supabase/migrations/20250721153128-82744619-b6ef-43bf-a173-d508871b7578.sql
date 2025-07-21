-- Create activity_logs table for project timeline
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_name TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for activity logs
CREATE POLICY "Activity logs: select if project member" 
ON public.activity_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM project_memberships pm 
  WHERE pm.project_id = activity_logs.project_id 
  AND pm.user_id = auth.uid()
));

CREATE POLICY "Activity logs: insert if project member" 
ON public.activity_logs 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND 
  EXISTS (
    SELECT 1 FROM project_memberships pm 
    WHERE pm.project_id = activity_logs.project_id 
    AND pm.user_id = auth.uid()
  )
);

-- Add index for better performance
CREATE INDEX idx_activity_logs_project_created ON public.activity_logs(project_id, created_at DESC);

-- Add delete policy for document operations 
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Documents: delete if member" 
ON public.documents 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM project_memberships pm 
  WHERE pm.project_id = documents.project_id 
  AND pm.user_id = auth.uid()
));

CREATE POLICY "Documents: update if member" 
ON public.documents 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM project_memberships pm 
  WHERE pm.project_id = documents.project_id 
  AND pm.user_id = auth.uid()
));

-- Function to log document activities
CREATE OR REPLACE FUNCTION public.log_document_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT (document upload)
  IF TG_OP = 'INSERT' THEN
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
  
  -- Handle DELETE (document deletion)
  IF TG_OP = 'DELETE' THEN
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
  
  -- Handle UPDATE (document rename)
  IF TG_OP = 'UPDATE' AND OLD.filename != NEW.filename THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic activity logging
CREATE TRIGGER trigger_log_document_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.log_document_activity();