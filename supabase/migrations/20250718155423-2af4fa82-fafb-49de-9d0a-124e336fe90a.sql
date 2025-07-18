-- First, update existing null values to have a proper created_by value
UPDATE public.projects 
SET created_by = (
  SELECT pm.user_id 
  FROM project_memberships pm 
  WHERE pm.project_id = projects.id 
  AND pm.role = 'owner'
  LIMIT 1
) 
WHERE created_by IS NULL;

-- For any projects that still have null created_by (no owner membership), 
-- we'll need to handle them manually or set to a default user
-- Let's set them to the first user we can find for now
UPDATE public.projects 
SET created_by = (
  SELECT id FROM auth.users LIMIT 1
) 
WHERE created_by IS NULL;