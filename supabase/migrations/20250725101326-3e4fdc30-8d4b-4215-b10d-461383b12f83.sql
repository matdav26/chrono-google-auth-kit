-- Create a function that calls the Edge Function for new documents
CREATE OR REPLACE FUNCTION public.trigger_on_new_document()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Only trigger for documents that are unprocessed and have no summary
  IF NEW.processed = false AND NEW.summary IS NULL THEN
    -- Call the Edge Function via HTTP
    SELECT net.http_post(
      url := 'https://tsppmmsxscprihjabvvn.supabase.co/functions/v1/on_new_document',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcHBtbXN4c2NwcmloamFidnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NDY0MjcsImV4cCI6MjA2NzEyMjQyN30.a9-6JuwwIseWS920Ecfa-0v_jA1kQgARjqJSY3N4gdY"}'::jsonb,
      body := json_build_object('record', row_to_json(NEW))::text
    ) INTO request_id;
    
    -- Log the request
    RAISE LOG 'Called on_new_document Edge Function for document %, request_id: %', NEW.id, request_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the documents table
CREATE TRIGGER on_new_document_trigger
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_on_new_document();