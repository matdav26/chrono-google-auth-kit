-- Add unique constraint on rag_context for source_id and source_type
ALTER TABLE public.rag_context 
ADD CONSTRAINT rag_context_source_unique UNIQUE (source_id, source_type);

-- Now the triggers should work properly with ON CONFLICT