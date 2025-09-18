-- Add the missing created_at column to rag_context table
ALTER TABLE public.rag_context 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add RLS policies for rag_context table (system-managed table)
-- Since this is a system table for RAG indexing, we'll allow the system to manage it
-- but restrict direct access from users
CREATE POLICY "System can manage rag_context" 
ON public.rag_context 
FOR ALL 
USING (false)
WITH CHECK (false);

-- Allow triggers and functions to work with the table
ALTER TABLE public.rag_context ENABLE ROW LEVEL SECURITY;