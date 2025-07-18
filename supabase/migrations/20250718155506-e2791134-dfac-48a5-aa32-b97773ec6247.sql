-- Now set the NOT NULL constraint and default value
ALTER TABLE public.projects ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE public.projects ALTER COLUMN created_by SET DEFAULT auth.uid();