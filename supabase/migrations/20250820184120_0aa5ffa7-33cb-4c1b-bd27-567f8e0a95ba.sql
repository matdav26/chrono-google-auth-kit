-- Add download_path column to documents table
ALTER TABLE public.documents 
ADD COLUMN download_path text;