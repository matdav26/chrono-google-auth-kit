-- Create triggers to automatically log document activities
CREATE TRIGGER trigger_log_document_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.log_document_activity();

-- Create triggers to automatically log event activities  
CREATE TRIGGER trigger_log_event_activity
  AFTER INSERT OR DELETE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.log_event_activity();