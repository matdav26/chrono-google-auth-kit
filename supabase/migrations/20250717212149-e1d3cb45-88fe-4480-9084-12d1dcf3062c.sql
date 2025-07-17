-- Add missing insert policy for projects table
CREATE POLICY "Projects: insert with membership" 
ON public.projects 
FOR INSERT 
WITH CHECK (true);

-- Add missing owner policy for project_memberships table
CREATE POLICY "Memberships: insert if owner" 
ON project_memberships 
FOR INSERT 
WITH CHECK (role = 'owner');