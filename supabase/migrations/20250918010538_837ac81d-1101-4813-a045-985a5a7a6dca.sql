-- Drop the restrictive policy
DROP POLICY IF EXISTS "System can manage rag_context" ON public.rag_context;

-- Disable RLS on rag_context as it's a system table managed by triggers
ALTER TABLE public.rag_context DISABLE ROW LEVEL SECURITY;