-- Improve the rag_context table structure
ALTER TABLE public.rag_context 
ADD COLUMN IF NOT EXISTS chunk_index integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS parent_id uuid,
ADD COLUMN IF NOT EXISTS relevance_score float DEFAULT 1.0;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_rag_context_embedding ON public.rag_context 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create a function to automatically chunk long documents
CREATE OR REPLACE FUNCTION public.chunk_document_content()
RETURNS trigger AS $$
DECLARE
  chunk_size integer := 500; -- words per chunk
  text_chunks text[];
  chunk text;
  i integer;
BEGIN
  -- Only process documents with raw_text
  IF NEW.raw_text IS NOT NULL AND length(NEW.raw_text) > 1000 THEN
    -- Split text into chunks (simplified - in production use better chunking)
    text_chunks := string_to_array(NEW.raw_text, E'\n\n');
    
    -- Create parent entry
    INSERT INTO rag_context (project_id, source_type, source_id, content, metadata, chunk_index)
    VALUES (
      NEW.project_id,
      'document',
      NEW.id,
      concat_ws(' ', 'Document:', NEW.filename, 'Summary:', NEW.summary),
      jsonb_build_object('filename', NEW.filename, 'doc_type', NEW.doc_type),
      0
    );
    
    -- Create child chunks
    FOR i IN 1..array_length(text_chunks, 1) LOOP
      IF length(text_chunks[i]) > 50 THEN -- Skip very short chunks
        INSERT INTO rag_context (project_id, source_type, source_id, content, metadata, chunk_index, parent_id)
        VALUES (
          NEW.project_id,
          'document_chunk',
          NEW.id,
          text_chunks[i],
          jsonb_build_object('filename', NEW.filename, 'chunk_number', i),
          i,
          NEW.id
        );
      END IF;
    END LOOP;
  ELSE
    -- For short documents, just create a single entry
    INSERT INTO rag_context (project_id, source_type, source_id, content, metadata)
    VALUES (
      NEW.project_id,
      'document',
      NEW.id,
      concat_ws(' ', 'Document:', NEW.filename, NEW.summary, NEW.raw_text),
      jsonb_build_object('filename', NEW.filename, 'doc_type', NEW.doc_type)
    )
    ON CONFLICT (source_id, source_type) DO UPDATE
      SET content = excluded.content,
          metadata = excluded.metadata,
          created_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the document trigger to use the new chunking function
DROP TRIGGER IF EXISTS update_rag_on_document_trigger ON public.documents;
CREATE TRIGGER update_rag_on_document_trigger
AFTER INSERT OR UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.chunk_document_content();

-- Improve the match_rag_context function to include metadata
CREATE OR REPLACE FUNCTION public.match_rag_context(
  query_embedding vector,
  match_project_id uuid,
  match_count integer DEFAULT 10,
  similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE(
  id uuid,
  project_id uuid,
  source_type text,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity double precision,
  chunk_index integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id,
    rc.project_id,
    rc.source_type,
    rc.source_id,
    rc.content,
    rc.metadata,
    1 - (rc.embedding <=> query_embedding) AS similarity,
    rc.chunk_index
  FROM rag_context rc
  WHERE rc.project_id = match_project_id
    AND rc.embedding IS NOT NULL
    AND 1 - (rc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add a table for storing chat sessions
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  summary text
);

-- Add RLS policies for chat_sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat sessions" 
ON public.chat_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat sessions" 
ON public.chat_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions" 
ON public.chat_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add a table for storing chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  sources jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add RLS policies for chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their sessions" 
ON public.chat_messages 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.chat_sessions 
  WHERE chat_sessions.id = chat_messages.session_id 
  AND chat_sessions.user_id = auth.uid()
));

CREATE POLICY "Users can create messages in their sessions" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.chat_sessions 
  WHERE chat_sessions.id = chat_messages.session_id 
  AND chat_sessions.user_id = auth.uid()
));