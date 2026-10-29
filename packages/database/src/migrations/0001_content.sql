CREATE TABLE content (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK (kind IN ('projects','experiences','notes','profile')),
 slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), draft jsonb NOT NULL, published jsonb, published_slug text,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')), version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
 CHECK (draft->>'kind' = kind AND draft->>'slug' = slug),
 CHECK ((published IS NULL AND published_slug IS NULL AND published_at IS NULL) OR (published IS NOT NULL AND published_slug = published->>'slug' AND published->>'kind' = kind AND published_at IS NOT NULL)),
 CHECK ((status = 'published') = (published IS NOT NULL)),
 CHECK (kind <> 'profile' OR slug = 'profile')
);
CREATE UNIQUE INDEX content_kind_slug ON content(kind,slug);
CREATE UNIQUE INDEX content_published_slug ON content(kind,published_slug);
CREATE INDEX content_kind_status ON content(kind,status);
CREATE TABLE revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_id uuid NOT NULL, content jsonb NOT NULL,
 version integer NOT NULL, action text NOT NULL, actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
-- Deliberately retain revisions after deletion for audit and recovery.
CREATE INDEX revisions_content ON revisions(content_id);
CREATE INDEX revisions_recent ON revisions(created_at DESC);
CREATE TABLE media (
 id uuid PRIMARY KEY, path text NOT NULL UNIQUE, mime text NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp')),
 size integer NOT NULL CHECK (size > 0 AND size <= 10485760), alt text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE content_media (
 content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
 media_id uuid NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
 PRIMARY KEY(content_id,media_id)
);
CREATE INDEX content_media_asset ON content_media(media_id);
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_media ENABLE ROW LEVEL SECURITY;
-- No Data API policies: all content access goes through the authorized backend.
