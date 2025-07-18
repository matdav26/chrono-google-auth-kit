-- Remove the database default for created_by (it doesn't work with auth.uid() in INSERT context)
ALTER TABLE public.projects ALTER COLUMN created_by DROP DEFAULT;