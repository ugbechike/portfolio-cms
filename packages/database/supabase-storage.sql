-- Run once in Supabase SQL editor after database migrations.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('portfolio-media','portfolio-media',false,10485760,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
-- Private bucket. No anon/authenticated policies. Only the API's server-side
-- service-role client uploads/downloads, after application authorization.
REVOKE ALL ON public.content, public.revisions, public.media, public.content_media FROM anon, authenticated;
