-- Create action_items table
CREATE TABLE public.action_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    owner_id UUID NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on action_items
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for action_items
CREATE POLICY "Users can view action items in their projects"
    ON public.action_items
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM project_memberships pm
        WHERE pm.project_id = action_items.project_id
        AND pm.user_id = auth.uid()
    ));

CREATE POLICY "Users can create action items in their projects"
    ON public.action_items
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM project_memberships pm
        WHERE pm.project_id = action_items.project_id
        AND pm.user_id = auth.uid()
    ));

CREATE POLICY "Users can update action items in their projects"
    ON public.action_items
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM project_memberships pm
        WHERE pm.project_id = action_items.project_id
        AND pm.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete action items in their projects"
    ON public.action_items
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM project_memberships pm
        WHERE pm.project_id = action_items.project_id
        AND pm.user_id = auth.uid()
    ));

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_action_items_updated_at
    BEFORE UPDATE ON public.action_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();