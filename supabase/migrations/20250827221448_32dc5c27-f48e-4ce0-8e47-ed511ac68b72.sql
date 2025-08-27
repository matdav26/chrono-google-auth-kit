-- Drop existing policies and recreate them properly
DROP POLICY IF EXISTS "Users can insert action items if project member" ON public.action_items;
DROP POLICY IF EXISTS "Users can view action items in their projects" ON public.action_items;
DROP POLICY IF EXISTS "Users can create action items in their projects" ON public.action_items;
DROP POLICY IF EXISTS "Users can update action items in their projects" ON public.action_items;
DROP POLICY IF EXISTS "Users can delete action items in their projects" ON public.action_items;

-- Create comprehensive RLS policies for action_items
CREATE POLICY "action_items_select_policy"
    ON public.action_items
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM project_memberships pm
        WHERE pm.project_id = action_items.project_id
        AND pm.user_id = auth.uid()
    ));

CREATE POLICY "action_items_insert_policy"
    ON public.action_items
    FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM project_memberships pm
        WHERE pm.project_id = action_items.project_id
        AND pm.user_id = auth.uid()
    ));

CREATE POLICY "action_items_update_policy"
    ON public.action_items
    FOR UPDATE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM project_memberships pm
        WHERE pm.project_id = action_items.project_id
        AND pm.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM project_memberships pm
        WHERE pm.project_id = action_items.project_id
        AND pm.user_id = auth.uid()
    ));

CREATE POLICY "action_items_delete_policy"
    ON public.action_items
    FOR DELETE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM project_memberships pm
        WHERE pm.project_id = action_items.project_id
        AND pm.user_id = auth.uid()
    ));