-- Enable RLS on rag_context table
ALTER TABLE public.rag_context ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rag_context table
-- Allow users to insert rag_context for projects they're members of
CREATE POLICY "rag_context_insert_policy" 
ON public.rag_context 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM project_memberships pm 
    WHERE pm.project_id = rag_context.project_id 
    AND pm.user_id = auth.uid()
  )
);

-- Allow users to view rag_context for projects they're members of
CREATE POLICY "rag_context_select_policy" 
ON public.rag_context 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM project_memberships pm 
    WHERE pm.project_id = rag_context.project_id 
    AND pm.user_id = auth.uid()
  )
);

-- Allow users to update rag_context for projects they're members of
CREATE POLICY "rag_context_update_policy" 
ON public.rag_context 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM project_memberships pm 
    WHERE pm.project_id = rag_context.project_id 
    AND pm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM project_memberships pm 
    WHERE pm.project_id = rag_context.project_id 
    AND pm.user_id = auth.uid()
  )
);

-- Allow users to delete rag_context for projects they're members of
CREATE POLICY "rag_context_delete_policy" 
ON public.rag_context 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM project_memberships pm 
    WHERE pm.project_id = rag_context.project_id 
    AND pm.user_id = auth.uid()
  )
);