-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_memberships ENABLE ROW LEVEL SECURITY;

-- RLS policies for users table
CREATE POLICY "Users can view their own row" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);

-- RLS policies for projects table
CREATE POLICY "Users can view projects they are members of" 
ON public.projects 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM project_memberships 
    WHERE project_memberships.project_id = projects.id 
    AND project_memberships.user_id = auth.uid()
  )
);

-- RLS policies for project_memberships table
CREATE POLICY "Users can view their own memberships" 
ON public.project_memberships 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own memberships" 
ON public.project_memberships 
FOR INSERT 
WITH CHECK (user_id = auth.uid());