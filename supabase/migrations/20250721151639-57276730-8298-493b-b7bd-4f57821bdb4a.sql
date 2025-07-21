-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);

-- Create RLS policies for documents bucket
CREATE POLICY "Users can upload documents to their projects" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' 
  AND EXISTS (
    SELECT 1 FROM project_memberships pm 
    WHERE pm.project_id::text = (storage.foldername(name))[1] 
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view documents from their projects" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'documents' 
  AND EXISTS (
    SELECT 1 FROM project_memberships pm 
    WHERE pm.project_id::text = (storage.foldername(name))[1] 
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete documents from their projects" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'documents' 
  AND EXISTS (
    SELECT 1 FROM project_memberships pm 
    WHERE pm.project_id::text = (storage.foldername(name))[1] 
    AND pm.user_id = auth.uid()
  )
);