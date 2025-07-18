-- Fix the RLS policy to be more robust and set a default value for created_by
ALTER TABLE public.projects ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.projects ALTER COLUMN created_by SET NOT NULL;

-- Update the RLS policy to be more explicit
DROP POLICY IF EXISTS "Projects: insert with membership" ON public.projects;
CREATE POLICY "Projects: insert with membership" 
ON public.projects 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

-- Update existing null values to have a proper created_by value
UPDATE public.projects 
SET created_by = (
  SELECT pm.user_id 
  FROM project_memberships pm 
  WHERE pm.project_id = projects.id 
  AND pm.role = 'owner'
  LIMIT 1
) 
WHERE created_by IS NULL;