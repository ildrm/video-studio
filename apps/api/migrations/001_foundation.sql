BEGIN;
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY, email text NOT NULL, display_name text NOT NULL, password_hash text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
  workspace_id uuid NOT NULL REFERENCES workspaces(id), user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('owner','admin','editor','contributor','viewer','reviewer','billing')),
  revoked_at timestamptz, PRIMARY KEY (workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS projects (
  workspace_id uuid NOT NULL REFERENCES workspaces(id), id uuid NOT NULL, name text NOT NULL,
  current_revision integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, PRIMARY KEY (workspace_id,id)
);
CREATE TABLE IF NOT EXISTS project_revisions (
  workspace_id uuid NOT NULL, project_id uuid NOT NULL, revision integer NOT NULL, document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (workspace_id,project_id,revision),
  FOREIGN KEY (workspace_id,project_id) REFERENCES projects(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS projects_workspace_created ON projects(workspace_id,created_at,id);
CREATE TABLE IF NOT EXISTS idempotency_records (
  actor_id uuid NOT NULL REFERENCES users(id), scope text NOT NULL, key_hash text NOT NULL, request_hash text NOT NULL,
  status integer NOT NULL, payload jsonb NOT NULL, headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', PRIMARY KEY(actor_id,scope,key_hash)
);
CREATE TABLE IF NOT EXISTS media_assets (
  workspace_id uuid NOT NULL REFERENCES workspaces(id), id uuid NOT NULL, version_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id), kind text NOT NULL CHECK (kind IN ('video','audio','image','font')),
  state text NOT NULL CHECK (state IN ('quarantined','inspecting','processing','ready','failed','deleted')),
  original_key text NOT NULL, filename text NOT NULL, mime_type text NOT NULL, size_bytes bigint NOT NULL,
  sha256 text NOT NULL, metadata jsonb, error_code text, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,version_id)
);
CREATE TABLE IF NOT EXISTS upload_sessions (
  workspace_id uuid NOT NULL REFERENCES workspaces(id), id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES users(id),
  filename text NOT NULL, size_bytes bigint NOT NULL, sha256 text NOT NULL, part_size integer NOT NULL,
  state text NOT NULL CHECK (state IN ('created','uploading','finalizing','completed','failed','expired','cancelled')),
  expires_at timestamptz NOT NULL, asset_id uuid, PRIMARY KEY (workspace_id,id)
);
CREATE TABLE IF NOT EXISTS upload_parts (
  workspace_id uuid NOT NULL, upload_id uuid NOT NULL, part_number integer NOT NULL, size_bytes integer NOT NULL,
  sha256 text NOT NULL, key text NOT NULL, PRIMARY KEY(workspace_id,upload_id,part_number),
  FOREIGN KEY(workspace_id,upload_id) REFERENCES upload_sessions(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS jobs (
  workspace_id uuid NOT NULL REFERENCES workspaces(id), id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES users(id),
  project_id uuid, snapshot_id uuid, snapshot jsonb, kind text NOT NULL CHECK (kind IN ('ingest','render')),
  state text NOT NULL CHECK (state IN ('created','validating','queued','preparing','running','verifying','uploading','completed','failed','cancel_requested','cancelled','retry_pending')),
  attempt integer NOT NULL DEFAULT 0, sequence integer NOT NULL DEFAULT 0, fraction numeric, error_code text,
  output_key text, output_metadata jsonb, lease_token uuid, lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,id),
  FOREIGN KEY(workspace_id,project_id) REFERENCES projects(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS job_events (
  workspace_id uuid NOT NULL, job_id uuid NOT NULL, sequence integer NOT NULL, payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,job_id,sequence),
  FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS render_artifacts (
  workspace_id uuid NOT NULL, id uuid NOT NULL, project_id uuid NOT NULL, job_id uuid NOT NULL, snapshot_id uuid NOT NULL, revision integer NOT NULL,
  object_key text NOT NULL, size_bytes bigint NOT NULL, sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,job_id),
  FOREIGN KEY(workspace_id,project_id,revision) REFERENCES project_revisions(workspace_id,project_id,revision),
  FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id)
);
COMMIT;
