-- Add unique constraint on rag_context table for source_id and source_type
ALTER TABLE public.rag_context 
ADD CONSTRAINT rag_context_source_unique UNIQUE (source_id, source_type);